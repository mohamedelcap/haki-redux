import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireStaff, requireContentAccess } from "./lib";
import { recurrenceValidator, contentTypeValidator } from "./schema";
import {
  DEFAULT_TIMEZONE,
  MAX_PUBLISH_ATTEMPTS,
  isBlockingScheduleStatus,
  isValidTimezone,
  nextOccurrenceUtc,
  parseFormDateTime,
  retryDelayMs,
  scheduleStatusAr,
  utcToZonedParts,
  validateContentForPublish,
  zonedDateStr,
  zonedTimeStr,
  zonedToUtc,
  type RecurrenceLike,
} from "./scheduleLogic";

/**
 * Content scheduling & automatic publishing (dashboard section «جدولة المحتوى»).
 *
 * Design:
 * - Every schedule row points at a REAL content row (no duplicate store).
 * - Publishing reuses the platform's existing mechanism: patching
 *   content.status to "published" (same as the admin quick action).
 * - A Convex cron sweeps every minute. The transition
 *   scheduled → publishing happens inside a single mutation (atomic under
 *   Convex's optimistic concurrency), then executePublish re-checks the
 *   status — concurrent sweeps can never publish the same row twice.
 * - Times are stored in UTC ms; wall-clock values are interpreted in the
 *   schedule's IANA timezone (default Africa/Cairo).
 */

// ---------------- internal helpers ----------------

async function insertEvent(
  ctx: MutationCtx,
  scheduleId: Id<"content_schedules">,
  action: string,
  opts?: {
    actor?: { _id: Id<"users">; name?: string };
    detail?: string;
    success?: boolean;
    error?: string;
  },
) {
  await ctx.db.insert("content_schedule_events", {
    scheduleId,
    action,
    actorId: opts?.actor?._id,
    actorName: opts?.actor?.name,
    detail: opts?.detail?.slice(0, 500),
    success: opts?.success ?? true,
    error: opts?.error?.slice(0, 500),
    createdAt: Date.now(),
  });
}

/** Notify all admins/super_admins plus the schedule creator. */
async function notifyStaffUsers(
  ctx: MutationCtx,
  title: string,
  body: string,
  extraUserIds?: (Id<"users"> | undefined)[],
) {
  const users = await ctx.db.query("users").collect();
  const ids = new Set<string>();
  for (const u of users) {
    if (u.role === "admin" || u.role === "super_admin") ids.add(u._id as string);
  }
  for (const id of extraUserIds ?? []) {
    if (id) ids.add(id as string);
  }
  const now = Date.now();
  for (const id of ids) {
    await ctx.db.insert("notifications", {
      userId: id as Id<"users">,
      title,
      body,
      isRead: false,
      createdAt: now,
    });
  }
}

function normalizeRecurrence(
  rec: RecurrenceLike | undefined,
  scheduledAt: number,
): RecurrenceLike | undefined {
  if (!rec || rec.freq === "none") return undefined;
  if (!/^\d{2}:\d{2}$/.test(rec.timeOfDay ?? "")) {
    throw new Error("وقت التكرار غير صالح — استخدم صيغة HH:mm");
  }
  if (rec.freq === "weekly") {
    const days = rec.weekdays ?? [];
    if (days.length === 0) throw new Error("اختر يومًا واحدًا على الأقل من أيام الأسبوع");
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new Error("أيام الأسبوع غير صالحة");
    }
  }
  if (rec.freq === "interval_days") {
    const n = rec.intervalDays ?? 0;
    if (!Number.isInteger(n) || n < 2 || n > 30) {
      throw new Error("التكرار كل عدة أيام يتطلب عددًا بين 2 و30");
    }
  }
  if (rec.freq === "monthly") {
    const d = rec.monthDay ?? 0;
    if (!Number.isInteger(d) || d < 1 || d > 28) {
      throw new Error("يوم الشهر يجب أن يكون بين 1 و28");
    }
  }
  if (rec.endsAt !== undefined && rec.endsAt <= scheduledAt) {
    throw new Error("تاريخ نهاية التكرار يجب أن يكون بعد أول موعد نشر");
  }
  return rec;
}

/** Insert a fresh content row (the form's «إنشاء محتوى جديد» path). */
async function insertNewContent(
  ctx: MutationCtx,
  caller: Doc<"users">,
  nc: {
    title: string;
    slug: string;
    description: string;
    coverImage?: string;
    contentType: Doc<"content">["contentType"];
    categoryIds?: Id<"categories">[];
    keywords?: string[];
  },
): Promise<Id<"content">> {
  if (!nc.title.trim()) throw new Error("أدخل عنوان المحتوى");
  if (!nc.description.trim()) throw new Error("أدخل وصف المحتوى");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(nc.slug)) {
    throw new Error("الرابط المختصر (slug) يقبل أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط");
  }
  const dup = await ctx.db
    .query("content")
    .withIndex("by_slug", (q) => q.eq("slug", nc.slug))
    .first();
  if (dup) throw new Error("الرابط المختصر مستخدم بالفعل — اختر slug مختلفًا");

  // Ownership model mirrors adminContent.upsertContent: publishers/authors
  // create content owned by their entity.
  let publisherId: Id<"publishers"> | undefined;
  let authorId: Id<"authors"> | undefined;
  if (caller.role === "publisher") {
    const entity = await ctx.db
      .query("publishers")
      .filter((q) => q.eq(q.field("name"), caller.name ?? ""))
      .first();
    if (!entity) throw new Error("لم يتم ربط حسابك بدار نشر — تواصل مع الإدارة");
    publisherId = entity._id;
  } else if (caller.role === "author") {
    const entity = await ctx.db
      .query("authors")
      .filter((q) => q.eq(q.field("name"), caller.name ?? ""))
      .first();
    if (!entity) throw new Error("لم يتم ربط حسابك بملف مؤلف — تواصل مع الإدارة");
    authorId = entity._id;
  }

  const now = Date.now();
  const id = await ctx.db.insert("content", {
    title: nc.title.trim(),
    slug: nc.slug,
    description: nc.description.trim(),
    coverImage: nc.coverImage || undefined,
    contentType: nc.contentType,
    authorId,
    publisherId,
    duration: 0,
    releaseDate: new Date(now).toISOString().slice(0, 10),
    status: "draft",
    isFeatured: false,
    isTrending: false,
    isNew: true,
    playCount: 0,
    keywords: nc.keywords && nc.keywords.length > 0 ? nc.keywords : undefined,
    createdAt: now,
    updatedAt: now,
  });
  for (const categoryId of nc.categoryIds ?? []) {
    await ctx.db.insert("content_categories", { contentId: id, categoryId });
  }
  return id;
}

/** Replace a content row's categories/keywords from the schedule form. */
async function applyContentMeta(
  ctx: MutationCtx,
  contentId: Id<"content">,
  categoryIds?: Id<"categories">[],
  keywords?: string[],
) {
  const patch: Record<string, unknown> = {};
  if (keywords !== undefined) {
    patch.keywords = keywords.length > 0 ? keywords : undefined;
  }
  if (Object.keys(patch).length > 0) {
    patch.updatedAt = Date.now();
    await ctx.db.patch(contentId, patch);
  }
  if (categoryIds !== undefined) {
    const links = await ctx.db
      .query("content_categories")
      .withIndex("by_content", (q) => q.eq("contentId", contentId))
      .collect();
    for (const link of links) await ctx.db.delete(link._id);
    for (const categoryId of categoryIds) {
      await ctx.db.insert("content_categories", { contentId, categoryId });
    }
  }
}

async function getScheduleForWrite(
  ctx: MutationCtx,
  scheduleId: Id<"content_schedules">,
): Promise<{ schedule: Doc<"content_schedules">; caller: Doc<"users"> }> {
  const schedule = await ctx.db.get(scheduleId);
  if (!schedule) throw new Error("الجدولة غير موجودة");
  const content = await ctx.db.get(schedule.contentId);
  const caller = await requireContentAccess(ctx, content);
  return { schedule, caller };
}

/** Create the next occurrence row for a recurring series (if any). */
async function createNextOccurrence(
  ctx: MutationCtx,
  schedule: Doc<"content_schedules">,
): Promise<Id<"content_schedules"> | null> {
  const rec = schedule.recurrence;
  if (!rec || rec.freq === "none") return null;
  const next = nextOccurrenceUtc(
    schedule.scheduledAt,
    rec as RecurrenceLike,
    schedule.timezone,
  );
  if (next === null) return null;
  const now = Date.now();
  return await ctx.db.insert("content_schedules", {
    contentId: schedule.contentId,
    scheduledAt: next,
    timezone: schedule.timezone,
    status: "scheduled",
    recurrence: rec,
    recurrenceOf: schedule.recurrenceOf ?? schedule._id,
    attempts: 0,
    maxAttempts: MAX_PUBLISH_ATTEMPTS,
    createdBy: schedule.createdBy,
    createdByName: schedule.createdByName,
    createdAt: now,
    updatedAt: now,
  });
}

// ---------------- queries ----------------

/**
 * All schedules with joined content info, newest occurrence first.
 * The dashboard filters (search/type/date) run client-side on this list.
 */
export const listSchedules = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("content_schedules")
      .withIndex("by_scheduled")
      .order("desc")
      .take(300);
    const out = [];
    for (const row of rows) {
      const content = await ctx.db.get(row.contentId);
      out.push({
        ...row,
        content: content
          ? {
              _id: content._id,
              title: content.title,
              slug: content.slug,
              contentType: content.contentType,
              coverImage: content.coverImage ?? null,
              status: content.status,
            }
          : null,
      });
    }
    return out;
  },
});

/** Mini dashboard counters (requirement 16). */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const all = await ctx.db.query("content_schedules").collect();
    const now = Date.now();
    const tz = DEFAULT_TIMEZONE;
    const todayStart = zonedToUtc(zonedDateStr(now, tz), "00:00", tz);
    const todayEnd = todayStart + 86_400_000;
    const weekEnd = todayStart + 7 * 86_400_000;
    const scheduled = all.filter((s) => s.status === "scheduled");
    const needsAttention = all.filter(
      (s) => s.status === "failed" || (s.status === "scheduled" && (s.attempts ?? 0) > 0),
    ).length;
    return {
      totalScheduled: scheduled.length,
      dueToday: scheduled.filter(
        (s) => s.scheduledAt >= todayStart && s.scheduledAt < todayEnd,
      ).length,
      dueThisWeek: scheduled.filter(
        (s) => s.scheduledAt >= todayStart && s.scheduledAt < weekEnd,
      ).length,
      succeeded: all.filter((s) => s.status === "published").length,
      failed: all.filter((s) => s.status === "failed").length,
      needsAttention,
      timezone: tz,
    };
  },
});

/** Activity + error log (requirements 10 & 21). */
export const listEvents = query({
  args: {
    scheduleId: v.optional(v.id("content_schedules")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 300);
    const rows = args.scheduleId
      ? await ctx.db
          .query("content_schedule_events")
          .withIndex("by_schedule", (q) => q.eq("scheduleId", args.scheduleId!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("content_schedule_events")
          .withIndex("by_created")
          .order("desc")
          .take(limit);
    const out = [];
    for (const e of rows) {
      const schedule = await ctx.db.get(e.scheduleId);
      const content = schedule ? await ctx.db.get(schedule.contentId) : null;
      out.push({
        ...e,
        scheduleStatus: schedule?.status ?? null,
        scheduleAt: schedule?.scheduledAt ?? null,
        contentTitle: content?.title ?? null,
        contentType: content?.contentType ?? null,
      });
    }
    return out;
  },
});

/** Conflict info shown when the admin picks a content item in the form. */
export const checkConflict = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const content = await ctx.db.get(args.contentId);
    if (!content) return { exists: false as const };
    const rows = await ctx.db
      .query("content_schedules")
      .withIndex("by_content", (q) => q.eq("contentId", args.contentId))
      .collect();
    const blocking = rows
      .filter((r) => isBlockingScheduleStatus(r.status))
      .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
    return {
      exists: true as const,
      contentStatus: content.status,
      title: content.title,
      slug: content.slug,
      coverImage: content.coverImage ?? null,
      blocking: blocking
        ? {
            _id: blocking._id,
            status: blocking.status,
            scheduledAt: blocking.scheduledAt,
            timezone: blocking.timezone,
          }
        : null,
    };
  },
});

/** The current staff member's notification feed (notification center). */
export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const caller = await requireStaff(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", caller._id))
      .order("desc")
      .take(100);
  },
});

// ---------------- mutations ----------------

export const createSchedule = mutation({
  args: {
    contentId: v.optional(v.id("content")),
    newContent: v.optional(
      v.object({
        title: v.string(),
        slug: v.string(),
        description: v.string(),
        coverImage: v.optional(v.string()),
        contentType: contentTypeValidator,
        categoryIds: v.optional(v.array(v.id("categories"))),
        keywords: v.optional(v.array(v.string())),
      }),
    ),
    date: v.string(),
    time: v.string(),
    timezone: v.optional(v.string()),
    status: v.union(v.literal("scheduled"), v.literal("draft")),
    recurrence: v.optional(recurrenceValidator),
    /** Explicit confirmation required to (re)publish an already published item. */
    allowRepublish: v.optional(v.boolean()),
    /** Meta edits for an existing content row (categories / keywords). */
    categoryIds: v.optional(v.array(v.id("categories"))),
    keywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaff(ctx);
    if (!args.contentId && !args.newContent) {
      throw new Error("اختر محتوى موجودًا أو أنشئ محتوى جديدًا");
    }
    if (args.contentId && args.newContent) {
      throw new Error("اختر أحد الخيارين: محتوى موجود أو محتوى جديد — وليس الاثنين");
    }

    const tz = (args.timezone ?? DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
    if (!isValidTimezone(tz)) throw new Error("المنطقة الزمنية غير صالحة");
    const dt = parseFormDateTime(args.date, args.time);
    if ("error" in dt) throw new Error(dt.error);
    const scheduledAt = zonedToUtc(dt.date, dt.time, tz);
    const recurrence = normalizeRecurrence(
      args.recurrence as RecurrenceLike | undefined,
      scheduledAt,
    );

    let contentId: Id<"content">;
    if (args.newContent) {
      contentId = await insertNewContent(ctx, caller, args.newContent);
    } else {
      contentId = args.contentId!;
      const content = await ctx.db.get(contentId);
      await requireContentAccess(ctx, content);

      // Conflict prevention (requirement 13): no duplicate active schedules.
      const rows = await ctx.db
        .query("content_schedules")
        .withIndex("by_content", (q) => q.eq("contentId", contentId))
        .collect();
      const blocking = rows.find((r) => isBlockingScheduleStatus(r.status));
      if (blocking) {
        throw new Error(
          `هذا المحتوى مجدول بالفعل (${scheduleStatusAr(blocking.status)}) — عدّل الجدولة القائمة أو ألغِها أولًا`,
        );
      }
      if (content && content.status === "published" && !args.allowRepublish) {
        throw new Error(
          "المحتوى منشور بالفعل. لا تُنشأ نسخة مكررة — نفس المحتوى سيُعاد نشره في الموعد الجديد. أكّد «إعادة الجدولة» للمتابعة أو اختر محتوى آخر.",
        );
      }
      if (args.categoryIds !== undefined || args.keywords !== undefined) {
        await applyContentMeta(ctx, contentId, args.categoryIds, args.keywords);
      }
    }

    const now = Date.now();
    const scheduleId = await ctx.db.insert("content_schedules", {
      contentId,
      scheduledAt,
      timezone: tz,
      status: args.status,
      recurrence,
      attempts: 0,
      maxAttempts: MAX_PUBLISH_ATTEMPTS,
      createdBy: caller._id,
      createdByName: caller.name,
      createdAt: now,
      updatedAt: now,
    });
    await insertEvent(ctx, scheduleId, "create", {
      actor: caller,
      detail: `${args.status === "draft" ? "مسودة" : "مجدول"} · ${dt.date} ${dt.time} (${tz})${recurrence ? ` · تكرار: ${recurrence.freq}` : ""}`,
    });
    return { scheduleId };
  },
});

export const updateSchedule = mutation({
  args: {
    id: v.id("content_schedules"),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    timezone: v.optional(v.string()),
    recurrence: v.optional(recurrenceValidator),
    categoryIds: v.optional(v.array(v.id("categories"))),
    keywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { schedule, caller } = await getScheduleForWrite(ctx, args.id);
    if (schedule.status === "publishing") {
      throw new Error("الجدولة قيد التنفيذ الآن — لا يمكن تعديلها");
    }
    const patch: Partial<Doc<"content_schedules">> = {};
    const details: string[] = [];
    if (args.date !== undefined || args.time !== undefined) {
      const tz = (args.timezone ?? schedule.timezone).trim() || schedule.timezone;
      if (!isValidTimezone(tz)) throw new Error("المنطقة الزمنية غير صالحة");
      const cur = utcToZonedParts(schedule.scheduledAt, tz);
      const date = args.date ?? `${String(cur.y).padStart(4, "0")}-${String(cur.m).padStart(2, "0")}-${String(cur.d).padStart(2, "0")}`;
      const time = args.time ?? `${String(cur.hh).padStart(2, "0")}:${String(cur.mm).padStart(2, "0")}`;
      const dt = parseFormDateTime(date, time);
      if ("error" in dt) throw new Error(dt.error);
      const newAt = zonedToUtc(dt.date, dt.time, tz);
      if (newAt !== schedule.scheduledAt) {
        details.push(`الموعد: ${dt.date} ${dt.time} (${tz})`);
      }
      patch.scheduledAt = newAt;
      patch.timezone = tz;
      patch.reminderSentAt = undefined;
    }
    if (args.recurrence !== undefined) {
      const base = patch.scheduledAt ?? schedule.scheduledAt;
      const normalized = normalizeRecurrence(args.recurrence as RecurrenceLike, base);
      patch.recurrence = normalized;
      details.push(normalized ? `تكرار: ${normalized.freq}` : "إيقاف التكرار");
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedBy = caller._id;
      patch.updatedAt = Date.now();
      await ctx.db.patch(args.id, patch);
    }
    if (args.categoryIds !== undefined || args.keywords !== undefined) {
      await applyContentMeta(ctx, schedule.contentId, args.categoryIds, args.keywords);
      details.push("تحديث التصنيفات/الوسوم");
    }
    await insertEvent(ctx, args.id, "update", {
      actor: caller,
      detail: details.join(" · ") || "تعديل الجدولة",
    });
    return { ok: true };
  },
});

/** Drag & drop / quick reschedule: new wall-clock date+time in a timezone. */
export const reschedule = mutation({
  args: {
    id: v.id("content_schedules"),
    date: v.string(),
    time: v.string(),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { schedule, caller } = await getScheduleForWrite(ctx, args.id);
    if (schedule.status === "publishing") {
      throw new Error("الجدولة قيد التنفيذ الآن — لا يمكن تغيير موعدها");
    }
    if (schedule.status === "published" || schedule.status === "cancelled") {
      throw new Error(`لا يمكن تغيير موعد جدولة ${scheduleStatusAr(schedule.status)}`);
    }
    const tz = (args.timezone ?? schedule.timezone).trim() || schedule.timezone;
    if (!isValidTimezone(tz)) throw new Error("المنطقة الزمنية غير صالحة");
    const dt = parseFormDateTime(args.date, args.time);
    if ("error" in dt) throw new Error(dt.error);
    const newAt = zonedToUtc(dt.date, dt.time, tz);
    const oldAt = schedule.scheduledAt;
    const now = Date.now();
    // A failed occurrence rescheduled becomes a fresh scheduled attempt.
    await ctx.db.patch(args.id, {
      scheduledAt: newAt,
      timezone: tz,
      status: schedule.status === "draft" ? "draft" : "scheduled",
      attempts: schedule.status === "failed" ? 0 : schedule.attempts,
      lastError: schedule.status === "failed" ? undefined : schedule.lastError,
      reminderSentAt: undefined,
      updatedBy: caller._id,
      updatedAt: now,
    });
    await insertEvent(ctx, args.id, "reschedule", {
      actor: caller,
      detail: `من ${zonedDateStr(oldAt, tz)} ${zonedTimeStr(oldAt, tz)} إلى ${dt.date} ${dt.time} (${tz})`,
    });
    return { ok: true };
  },
});

/** Cancel («ملغي») or convert back to draft («مسودة»). */
export const setScheduleStatus = mutation({
  args: {
    id: v.id("content_schedules"),
    status: v.union(v.literal("draft"), v.literal("cancelled")),
  },
  handler: async (ctx, args) => {
    const { schedule, caller } = await getScheduleForWrite(ctx, args.id);
    if (schedule.status === "publishing") {
      throw new Error("الجدولة قيد التنفيذ الآن — لا يمكن تغيير حالتها");
    }
    if (schedule.status === "published") {
      throw new Error("الجدولة نُشرت بالفعل — لا يمكن تغيير حالتها");
    }
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedBy: caller._id,
      updatedAt: Date.now(),
    });
    await insertEvent(
      ctx,
      args.id,
      args.status === "cancelled" ? "cancel" : "convert_draft",
      { actor: caller, detail: args.status === "cancelled" ? "إلغاء الجدولة" : "تحويل إلى مسودة" },
    );
    return { ok: true };
  },
});

export const deleteSchedule = mutation({
  args: { id: v.id("content_schedules") },
  handler: async (ctx, args) => {
    const { schedule, caller } = await getScheduleForWrite(ctx, args.id);
    if (schedule.status === "publishing") {
      throw new Error("الجدولة قيد التنفيذ الآن — انتظر انتهاء النشر ثم احذف");
    }
    // Remove the schedule's event trail too (no orphaned rows).
    const events = await ctx.db
      .query("content_schedule_events")
      .withIndex("by_schedule", (q) => q.eq("scheduleId", args.id))
      .collect();
    for (const e of events) await ctx.db.delete(e._id);
    await ctx.db.delete(args.id);
    await ctx.db.insert("admin_audit", {
      actorId: caller._id,
      actorName: caller.name,
      actorRole: caller.role,
      action: "delete_schedule",
      entity: "content_schedules",
      entityId: args.id,
      detail: `حذف جدولة (${scheduleStatusAr(schedule.status)})`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Publish immediately (requirement 8): same guarded path as the cron. */
export const publishNow = mutation({
  args: { id: v.id("content_schedules") },
  handler: async (ctx, args) => {
    const { schedule, caller } = await getScheduleForWrite(ctx, args.id);
    if (schedule.status === "publishing") {
      throw new Error("الجدولة قيد النشر بالفعل");
    }
    if (schedule.status === "published") {
      throw new Error("الجدولة نُشرت بالفعل");
    }
    const now = Date.now();
    // Atomic transition — executePublish re-checks this status.
    await ctx.db.patch(args.id, {
      status: "publishing",
      lastAttemptAt: now,
      updatedBy: caller._id,
      updatedAt: now,
    });
    await insertEvent(ctx, args.id, "publish_now", {
      actor: caller,
      detail: "نشر فوري يدوي",
    });
    await ctx.scheduler.runAfter(0, internal.scheduler.executePublish, {
      scheduleId: args.id,
    });
    return { ok: true };
  },
});

/** Retry a failed publish: resets attempts and schedules for the next sweep. */
export const retrySchedule = mutation({
  args: { id: v.id("content_schedules") },
  handler: async (ctx, args) => {
    const { schedule, caller } = await getScheduleForWrite(ctx, args.id);
    if (schedule.status !== "failed") {
      throw new Error("إعادة المحاولة متاحة فقط للجدولة التي فشل نشرها");
    }
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "scheduled",
      scheduledAt: now,
      attempts: 0,
      lastError: undefined,
      reminderSentAt: undefined,
      updatedBy: caller._id,
      updatedAt: now,
    });
    await insertEvent(ctx, args.id, "retry", {
      actor: caller,
      detail: "إعادة محاولة النشر بعد الفشل",
    });
    return { ok: true };
  },
});

/** Duplicate a schedule as a new draft occurrence (requirement 7 «نسخ»). */
export const duplicateSchedule = mutation({
  args: { id: v.id("content_schedules") },
  handler: async (ctx, args) => {
    const { schedule, caller } = await getScheduleForWrite(ctx, args.id);
    const now = Date.now();
    const newId = await ctx.db.insert("content_schedules", {
      contentId: schedule.contentId,
      scheduledAt: schedule.scheduledAt,
      timezone: schedule.timezone,
      status: "draft",
      recurrence: schedule.recurrence,
      attempts: 0,
      maxAttempts: MAX_PUBLISH_ATTEMPTS,
      createdBy: caller._id,
      createdByName: caller.name,
      createdAt: now,
      updatedAt: now,
    });
    await insertEvent(ctx, newId, "duplicate", {
      actor: caller,
      detail: "نسخة من جدولة قائمة (مسودة — حدّد الموعد ثم جدولها)",
    });
    return { newId };
  },
});

/** Bulk actions on selected schedules (requirement 12). */
export const bulkAction = mutation({
  args: {
    ids: v.array(v.id("content_schedules")),
    action: v.union(
      v.literal("cancel"),
      v.literal("delete"),
      v.literal("publishNow"),
      v.literal("reschedule"),
      v.literal("setStatus"),
    ),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    timezone: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("scheduled"), v.literal("cancelled"))),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaff(ctx);
    if (args.ids.length === 0) throw new Error("لم يتم تحديد أي جدولة");
    if (args.ids.length > 100) throw new Error("الحد الأقصى 100 جدولة في العملية الواحدة");
    let ok = 0;
    const failed: { id: string; error: string }[] = [];
    const now = Date.now();

    for (const id of args.ids) {
      try {
        const schedule = await ctx.db.get(id);
        if (!schedule) throw new Error("الجدولة غير موجودة");
        const content = await ctx.db.get(schedule.contentId);
        await requireContentAccess(ctx, content);

        if (args.action === "cancel") {
          if (schedule.status === "publishing" || schedule.status === "published") {
            throw new Error(`لا يمكن إلغاء جدولة ${scheduleStatusAr(schedule.status)}`);
          }
          await ctx.db.patch(id, { status: "cancelled", updatedBy: caller._id, updatedAt: now });
          await insertEvent(ctx, id, "bulk_cancel", { actor: caller, detail: "إلغاء جماعي" });
        } else if (args.action === "delete") {
          if (schedule.status === "publishing") throw new Error("الجدولة قيد التنفيذ الآن");
          const events = await ctx.db
            .query("content_schedule_events")
            .withIndex("by_schedule", (q) => q.eq("scheduleId", id))
            .collect();
          for (const e of events) await ctx.db.delete(e._id);
          await ctx.db.delete(id);
          await ctx.db.insert("admin_audit", {
            actorId: caller._id,
            actorName: caller.name,
            actorRole: caller.role,
            action: "bulk_delete_schedule",
            entity: "content_schedules",
            entityId: id,
            detail: `حذف جماعي (${scheduleStatusAr(schedule.status)})`,
            createdAt: now,
          });
        } else if (args.action === "publishNow") {
          if (schedule.status === "publishing") throw new Error("قيد النشر بالفعل");
          if (schedule.status === "published") throw new Error("منشور بالفعل");
          await ctx.db.patch(id, { status: "publishing", lastAttemptAt: now, updatedBy: caller._id, updatedAt: now });
          await insertEvent(ctx, id, "bulk_publish_now", { actor: caller, detail: "نشر فوري جماعي" });
          await ctx.scheduler.runAfter(0, internal.scheduler.executePublish, { scheduleId: id });
        } else if (args.action === "reschedule") {
          if (schedule.status === "publishing" || schedule.status === "published" || schedule.status === "cancelled") {
            throw new Error(`لا يمكن تغيير موعد جدولة ${scheduleStatusAr(schedule.status)}`);
          }
          if (!args.date || !args.time) throw new Error("حدّد التاريخ والوقت الجديدين");
          const tz = (args.timezone ?? schedule.timezone).trim() || schedule.timezone;
          if (!isValidTimezone(tz)) throw new Error("المنطقة الزمنية غير صالحة");
          const dt = parseFormDateTime(args.date, args.time);
          if ("error" in dt) throw new Error(dt.error);
          await ctx.db.patch(id, {
            scheduledAt: zonedToUtc(dt.date, dt.time, tz),
            timezone: tz,
            status: schedule.status === "failed" ? "scheduled" : schedule.status,
            attempts: schedule.status === "failed" ? 0 : schedule.attempts,
            lastError: schedule.status === "failed" ? undefined : schedule.lastError,
            reminderSentAt: undefined,
            updatedBy: caller._id,
            updatedAt: now,
          });
          await insertEvent(ctx, id, "bulk_reschedule", {
            actor: caller,
            detail: `تغيير موعد جماعي إلى ${dt.date} ${dt.time} (${tz})`,
          });
        } else if (args.action === "setStatus") {
          const target = args.status;
          if (!target) throw new Error("حدّد الحالة الجديدة");
          if (schedule.status === "publishing" || schedule.status === "published") {
            throw new Error(`لا يمكن تغيير حالة جدولة ${scheduleStatusAr(schedule.status)}`);
          }
          await ctx.db.patch(id, { status: target, updatedBy: caller._id, updatedAt: now });
          await insertEvent(ctx, id, "bulk_set_status", {
            actor: caller,
            detail: `تغيير الحالة جماعيًا إلى ${scheduleStatusAr(target)}`,
          });
        }
        ok += 1;
      } catch (e) {
        failed.push({ id, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return { ok, failed };
  },
});

/** Mark the caller's notifications read (notification center). */
export const markMyNotificationsRead = mutation({
  args: { ids: v.optional(v.array(v.id("notifications"))) },
  handler: async (ctx, args) => {
    const caller = await requireStaff(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", caller._id))
      .collect();
    const target = args.ids ? new Set(args.ids as string[]) : null;
    let patched = 0;
    for (const row of rows) {
      if (row.isRead) continue;
      if (target && !target.has(row._id as string)) continue;
      await ctx.db.patch(row._id, { isRead: true });
      patched += 1;
    }
    return { patched };
  },
});

// ---------------- cron worker ----------------

/**
 * Runs every minute (crons.ts). Three jobs:
 * 1. Flip due rows scheduled → publishing (atomic) and enqueue the publish.
 * 2. Reclaim rows stuck in "publishing" (worker crash) back to "scheduled".
 * 3. Send «اقتراب موعد النشر» reminders (≤30 min) once per occurrence.
 */
export const dueSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let started = 0;
    let reclaimed = 0;
    let reminded = 0;

    const scheduled = await ctx.db
      .query("content_schedules")
      .withIndex("by_status", (q) => q.eq("status", "scheduled"))
      .collect();

    for (const s of scheduled) {
      if (s.scheduledAt <= now) {
        if (started >= 25) continue; // rate-limit per tick
        // Re-read inside the transaction and verify — the guard against
        // duplicate publishing under concurrent sweeps.
        const fresh = await ctx.db.get(s._id);
        if (!fresh || fresh.status !== "scheduled") continue;
        await ctx.db.patch(s._id, {
          status: "publishing",
          lastAttemptAt: now,
          updatedAt: now,
        });
        await ctx.scheduler.runAfter(0, internal.scheduler.executePublish, {
          scheduleId: s._id,
        });
        started += 1;
      } else if (
        !s.reminderSentAt &&
        s.scheduledAt - now <= 30 * 60_000
      ) {
        const content = await ctx.db.get(s.contentId);
        const minutes = Math.max(1, Math.round((s.scheduledAt - now) / 60_000));
        await notifyStaffUsers(
          ctx,
          `⏰ اقتراب موعد نشر «${content?.title ?? "محتوى"}»`,
          `سيُنشر تلقائيًا خلال ${minutes} دقيقة`,
          [s.createdBy],
        );
        await ctx.db.patch(s._id, { reminderSentAt: now, updatedAt: now });
        reminded += 1;
      }
    }

    const publishing = await ctx.db
      .query("content_schedules")
      .withIndex("by_status", (q) => q.eq("status", "publishing"))
      .collect();
    for (const s of publishing) {
      if ((s.lastAttemptAt ?? 0) < now - 10 * 60_000) {
        await ctx.db.patch(s._id, { status: "scheduled", updatedAt: now });
        reclaimed += 1;
      }
    }

    return { started, reclaimed, reminded };
  },
});

/**
 * Executes one publish attempt for a schedule already in "publishing".
 * Re-checks the status first (duplicate-publishing guard), validates the
 * content, then publishes via the platform's existing mechanism
 * (content.status = "published"). Failures are logged with progressive
 * retries; permanent validation errors stop for manual intervention.
 */
export const executePublish = internalMutation({
  args: { scheduleId: v.id("content_schedules") },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduleId);
    if (!schedule) return { skipped: "missing" as const };
    // Duplicate guard: only a row this sweep flipped to "publishing" may run.
    if (schedule.status !== "publishing") return { skipped: "not-publishing" as const };

    const now = Date.now();
    const content = await ctx.db.get(schedule.contentId);
    if (!content) {
      const error = "المحتوى المرتبط بالجدولة لم يعد موجودًا";
      await ctx.db.patch(schedule._id, {
        status: "failed",
        attempts: (schedule.attempts ?? 0) + 1,
        lastError: error,
        lastAttemptAt: now,
        updatedAt: now,
      });
      await insertEvent(ctx, schedule._id, "publish_failed", {
        success: false,
        error,
        detail: "خطأ دائم — المحتوى محذوف",
      });
      await notifyStaffUsers(ctx, "❌ فشل نشر مجدول", error, [schedule.createdBy]);
      return { failed: "content-missing" as const };
    }

    const [chapters, episodes] = await Promise.all([
      ctx.db
        .query("chapters")
        .withIndex("by_content", (q) => q.eq("contentId", content._id))
        .collect(),
      ctx.db
        .query("episodes")
        .withIndex("by_content", (q) => q.eq("contentId", content._id))
        .collect(),
    ]);
    const check = validateContentForPublish(content, {
      chapters: chapters.length,
      episodes: episodes.length,
    });

    if (!check.ok) {
      // Permanent failure: data is incomplete. Manual fix + Retry.
      const error = check.error ?? "بيانات المحتوى غير مكتملة";
      await ctx.db.patch(schedule._id, {
        status: "failed",
        attempts: (schedule.attempts ?? 0) + 1,
        lastError: error,
        lastAttemptAt: now,
        updatedAt: now,
      });
      await insertEvent(ctx, schedule._id, "validation_error", {
        success: false,
        error,
        detail: "بيانات ناقصة — يتطلب تدخلًا يدويًا ثم إعادة المحاولة",
      });
      await notifyStaffUsers(
        ctx,
        `⚠️ جدولة «${content.title}» تحتاج مراجعة`,
        error,
        [schedule.createdBy],
      );
      return { failed: "validation" as const };
    }

    try {
      // The platform's publish mechanism (same as the admin quick action):
      // the latest saved version of the content row goes live.
      await ctx.db.patch(content._id, { status: "published", updatedAt: now });
      const startedAt = schedule.lastAttemptAt ?? now;
      await ctx.db.patch(schedule._id, {
        status: "published",
        publishedAt: now,
        publishDurationMs: Math.max(0, now - startedAt),
        publishInfo: check.info,
        lastError: undefined,
        updatedAt: now,
      });
      await insertEvent(ctx, schedule._id, "publish_success", {
        success: true,
        detail: check.info ?? "تم النشر",
      });
      await notifyStaffUsers(
        ctx,
        `✅ نُشر «${content.title}» في موعده`,
        "تم النشر التلقائي بنجاح",
        [schedule.createdBy],
      );
      // Recurring series → generate the next occurrence.
      const nextId = await createNextOccurrence(ctx, schedule);
      return { published: true as const, nextId };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      const attempt = (schedule.attempts ?? 0) + 1;
      const max = schedule.maxAttempts ?? MAX_PUBLISH_ATTEMPTS;
      if (attempt < max) {
        const delay = retryDelayMs(attempt);
        await ctx.db.patch(schedule._id, {
          status: "scheduled",
          scheduledAt: now + delay,
          attempts: attempt,
          lastError: error,
          lastAttemptAt: now,
          updatedAt: now,
        });
        await insertEvent(ctx, schedule._id, "publish_failed", {
          success: false,
          error,
          detail: `محاولة ${attempt} من ${max} — ستُعاد تلقائيًا بعد ${Math.round(delay / 60_000)} دقيقة`,
        });
        return { retryInMs: delay as number };
      }
      await ctx.db.patch(schedule._id, {
        status: "failed",
        attempts: attempt,
        lastError: error,
        lastAttemptAt: now,
        updatedAt: now,
      });
      await insertEvent(ctx, schedule._id, "publish_failed", {
        success: false,
        error,
        detail: `استنفدت المحاولات (${max}) — يتطلب إعادة محاولة يدوية`,
      });
      await notifyStaffUsers(
        ctx,
        `❌ فشل نشر «${content.title}» نهائيًا`,
        error,
        [schedule.createdBy],
      );
      return { failed: error as string };
    }
  },
});
