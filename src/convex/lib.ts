import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { CONTENT_TYPES } from "./schema";

/** Get the current user doc or null. */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

/** Get current user id or null. */
export async function getUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

/** Throws unless the caller is admin or super_admin (content management, users). */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || !isAdminRole(user.role)) {
    throw new ConvexError("غير مصرح: هذه العملية تتطلب صلاحيات المدير");
  }
  return user;
}

/** Throws unless the caller is admin or super_admin (user management, system settings). */
export async function requireSuperAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    throw new ConvexError("غير مصرح: هذه العملية تتطلب صلاحيات مدير النظام");
  }
  return user;
}

/** Throws unless the caller is admin/super_admin/publisher/author. */
export async function requireStaff(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || !isStaff(user.role)) {
    throw new ConvexError("غير مصرح: هذه الصفحة لفريق الإدارة");
  }
  return user;
}

/** True for super_admin / admin / publisher / author (also legacy "member" → treated as user). */
export function isStaff(role?: string): boolean {
  return role === "super_admin" || role === "admin" || role === "publisher" || role === "author";
}

/** True for admin-level roles only. */
export function isAdminRole(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

/**
 * Content ownership check for the publisher/author content model:
 * - admin & super_admin: everything.
 * - publisher: content rows published by this publisher only.
 * - author: content authored by this author only.
 * Returns the caller (for owner ids) — throws when the caller lacks access to `contentId`.
 */
export async function requireContentAccess(
  ctx: QueryCtx | MutationCtx,
  contentRow: Doc<"content"> | null,
): Promise<Doc<"users">> {
  const user = await requireStaff(ctx);
  if (!contentRow) throw new ConvexError("المحتوى غير موجود");
  if (isAdminRole(user.role)) return user;

  // Resolve the caller's author/publisher entity
  if (user.role === "publisher") {
    const entity = await ctx.db
      .query("publishers")
      .filter((q) => q.eq(q.field("name"), user.name ?? ""))
      .first();
    if (entity && contentRow.publisherId === entity._id) return user;
  }
  if (user.role === "author") {
    const entity = await ctx.db
      .query("authors")
      .filter((q) => q.eq(q.field("name"), user.name ?? ""))
      .first();
    if (entity && contentRow.authorId === entity._id) return user;
  }
  throw new ConvexError("غير مصرح: لا تملك صلاحية تعديل هذا المحتوى");
}

export type PublicContent = Doc<"content">;

export type EnrichedContent = Omit<Doc<"content">, "authorId" | "narratorId" | "publisherId"> & {
  authorName: string | null;
  authorId: Id<"authors"> | null;
  authorImage: string | null;
  narratorName: string | null;
  narratorId: Id<"narrators"> | null;
  narratorImage: string | null;
  publisherName: string | null;
  publisherLogo: string | null;
  categories: { id: Id<"categories">; name: string; slug: string }[];
  chapterCount: number;
  episodeCount: number;
};

/** Attach author/narrator/publisher/category names to content rows. */
export async function enrichContent(
  ctx: QueryCtx,
  rows: Doc<"content">[],
): Promise<EnrichedContent[]> {
  const out: EnrichedContent[] = [];
  for (const row of rows) {
    const [author, narrator, publisher, cats, chapters, episodes] =
      await Promise.all([
        row.authorId ? ctx.db.get(row.authorId) : null,
        row.narratorId ? ctx.db.get(row.narratorId) : null,
        row.publisherId ? ctx.db.get(row.publisherId) : null,
        getContentCategories(ctx, row._id),
        ctx.db
          .query("chapters")
          .withIndex("by_content", (q) => q.eq("contentId", row._id))
          .collect(),
        ctx.db
          .query("episodes")
          .withIndex("by_content", (q) => q.eq("contentId", row._id))
          .collect(),
      ]);
    out.push({
      ...row,
      authorId: row.authorId ?? null,
      narratorId: row.narratorId ?? null,
      authorName: author?.name ?? null,
      authorImage: author?.image ?? null,
      narratorName: narrator?.name ?? null,
      narratorImage: narrator?.image ?? null,
      publisherName: publisher?.name ?? null,
      publisherLogo: publisher?.logo ?? null,
      categories: cats,
      chapterCount: chapters.length,
      episodeCount: episodes.length,
    });
  }
  return out;
}

async function getContentCategories(ctx: QueryCtx, contentId: Id<"content">) {
  const links = await ctx.db
    .query("content_categories")
    .withIndex("by_content", (q) => q.eq("contentId", contentId))
    .collect();
  const cats: { id: Id<"categories">; name: string; slug: string }[] = [];
  for (const link of links) {
    const cat = await ctx.db.get(link.categoryId);
    if (cat) cats.push({ id: cat._id, name: cat.name, slug: cat.slug });
  }
  return cats;
}

/** Format seconds as "3 س 24 د" or "45 د". */
export function formatDurationArabic(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} س ${minutes} د`;
  return `${minutes} د`;
}

// ---------------- Challenge goal helpers ----------------

const CONTENT_TYPE_SET = new Set<string>(CONTENT_TYPES);

/** Types counted as "finished works" for challenges: audiobooks + e-books. */
const FINISHABLE_TYPES = new Set<string>(["audiobook", "ebook"]);

/**
 * Listening minutes for one user since a given date (epoch ms).
 * Approximates daily totals: caps each session at its own duration and at 90
 * minutes/day to prevent idle playback from inflating the score.
 */
export async function listeningMinutesSince(
  ctx: QueryCtx,
  userId: Id<"users">,
  since: number,
): Promise<number> {
  const rows = await ctx.db
    .query("listening_history")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const perDay = new Map<string, number>();
  for (const r of rows) {
    if (r.playedAt < since) continue;
    const day = new Date(r.playedAt).toISOString().slice(0, 10);
    const dur = Math.min(
      r.duration || 0,
      r.position || 0,
      90 * 60,
    );
    perDay.set(day, (perDay.get(day) ?? 0) + dur);
  }
  let total = 0;
  for (const v of perDay.values()) total += Math.min(v, 90 * 60);
  return Math.round(total / 60);
}

/** Distinct finished works since a date (content rows with matching type). */
export async function finishedWorksSince(
  ctx: QueryCtx,
  userId: Id<"users">,
  since: number,
): Promise<number> {
  const rows = await ctx.db
    .query("listening_progress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let count = 0;
  for (const row of rows) {
    if (!row.duration || !row.position) continue;
    if (row.position / Math.max(row.duration, 1) < 0.95) continue;
  const content = await ctx.db.get(row.contentId);
    if (!content || !FINISHABLE_TYPES.has(content.contentType)) continue;
    if (row.updatedAt < since) continue;
    count += 1;
  }
  return count;
}

/** Ratings written since a date. */
export async function ratedItemsSince(
  ctx: QueryCtx,
  userId: Id<"users">,
  since: number,
): Promise<number> {
  const rows = await ctx.db
    .query("ratings")
    .withIndex("by_user_content", (q) => q.eq("userId", userId))
    .collect();
  return rows.filter((r) => r.createdAt >= since).length;
}

/**
 * Progress (0..target) of one user in one challenge, and completion state.
 * Never writes; completion is persisted by syncChallengeParticipation.
 */
export async function challengeProgressForUser(
  ctx: QueryCtx,
  challenge: { goalType?: string | null; goalTarget?: number | null; startDate: string; endDate: string },
  userId: Id<"users">,
): Promise<{ progress: number; target: number; completed: boolean }> {
  const startTs = Date.parse(`${challenge.startDate}T00:00:00Z`) || 0;
  const target = Math.max(1, Math.round(challenge.goalTarget ?? 1));
  const goalType = challenge.goalType ?? "listen_minutes";
  let progress = 0;
  if (goalType === "listen_minutes") {
    progress = await listeningMinutesSince(ctx, userId, startTs);
  } else if (goalType === "finished_works") {
    progress = await finishedWorksSince(
      ctx,
      userId,
      startTs,
    );
  } else {
    progress = await ratedItemsSince(ctx, userId, startTs);
  }
  return { progress, target, completed: progress >= target };
}

/**
 * Persist completion state for one participation row and fire a completion
 * notification when the goal is first reached. Safe to call repeatedly.
 */
export async function syncChallengeParticipation(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  participant: Doc<"challenge_participants">,
): Promise<{ progress: number; target: number; completed: boolean }> {
  const res = await challengeProgressForUser(ctx, challenge, participant.userId);
  if (res.completed && !participant.completedAt) {
    await ctx.db.patch(participant._id, { completedAt: Date.now() });
    await ctx.db.insert("notifications", {
      userId: participant.userId,
      title: `🏆 أكملت تحدي "${challenge.name}"`,
      body: challenge.reward
        ? `المكافأة: ${challenge.reward}`
        : "أحسنت! استمر في الاستماع.",
      isRead: false,
      createdAt: Date.now(),
    });
    // Completion email (no-op without RESEND_API_KEY).
    try {
      await ctx.scheduler.runAfter(0, api.email.sendToUser, {
        kind: "challenge" as const,
        userId: participant.userId,
        challengeName: challenge.name,
      });
    } catch {
      /* best-effort */
    }
  }
  return res;
}
