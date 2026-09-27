import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff, requireAdmin, getCurrentUser, isAdminRole } from "./lib";
import { contentTypeValidator } from "./schema";
import { api } from "./_generated/api";

/**
 * Publisher/author studio (/studio): self-service publishing.
 * Staff create a draft work, submit it for review, and an admin approval
 * flips the draft to published automatically (with a notification).
 */

/** My studio works (draft + published) with submission status. */
export const myWorks = query({
  args: {},
  handler: async (ctx) => {
    const caller = await requireStaff(ctx);
    const rows = await ctx.db.query("content").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    let scoped = rows;
    if (!isAdminRole(caller.role)) {
      if (caller.role === "publisher") {
        const entity = await ctx.db
          .query("publishers")
          .filter((q) => q.eq(q.field("name"), caller.name ?? ""))
          .first();
        scoped = entity ? rows.filter((r) => r.publisherId === entity._id) : [];
      } else if (caller.role === "author") {
        const entity = await ctx.db
          .query("authors")
          .filter((q) => q.eq(q.field("name"), caller.name ?? ""))
          .first();
        scoped = entity ? rows.filter((r) => r.authorId === entity._id) : [];
      } else {
        scoped = [];
      }
    }
    const submissions = await ctx.db.query("publisher_submissions").collect();
    return scoped.slice(0, 100).map((r) => {
      const sub = submissions
        .filter((s) => s.contentId === r._id)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      return {
        _id: r._id,
        title: r.title,
        slug: r.slug,
        contentType: r.contentType,
        status: r.status,
        duration: r.duration,
        coverImage: r.coverImage ?? null,
        createdAt: r.createdAt,
        submissionStatus: sub?.status ?? null,
        rejectionFree: sub?.message ?? null,
      };
    });
  },
});

/** Submit (or re-submit) a draft for review: creates/updates a submission. */
export const submitForReview = mutation({
  args: {
    contentId: v.id("content"),
    message: v.optional(v.string()),
    email: v.optional(v.string()),
    ownerType: v.optional(v.string()),
    publisherName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireStaff(ctx);
    const row = await ctx.db.get(args.contentId);
    if (!row) throw new Error("المحتوى غير موجود");
    // Only the owner (or an admin) can submit.
    if (!isAdminRole(caller.role)) {
      if (caller.role === "publisher") {
        const entity = await ctx.db
          .query("publishers")
          .filter((q) => q.eq(q.field("name"), caller.name ?? ""))
          .first();
        if (!entity || row.publisherId !== entity._id) throw new Error("غير مصرح");
      } else if (caller.role === "author") {
        const entity = await ctx.db
          .query("authors")
          .filter((q) => q.eq(q.field("name"), caller.name ?? ""))
          .first();
        if (!entity || row.authorId !== entity._id) throw new Error("غير مصرح");
      } else {
        throw new Error("غير مصرح");
      }
    }
    if (row.status === "published") throw new Error("هذا العمل منشور بالفعل");

    // Reuse an existing pending/reviewing submission for the same work.
    const subs = await ctx.db.query("publisher_submissions").collect();
    const existing = subs
      .filter((s) => s.contentId === args.contentId && (s.status === "pending" || s.status === "reviewing"))
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (existing) {
      await ctx.db.patch(existing._id, {
        message: args.message ?? existing.message,
        status: "pending",
      });
      return { ok: true, submissionId: existing._id, resubmitted: true };
    }

    const submissionId = await ctx.db.insert("publisher_submissions", {
      name: caller.name ?? "ناشر",
      email: args.email ?? caller.email ?? "no-email@haki.app",
      ownerType: args.ownerType ?? caller.role ?? "author",
      publisherName: args.publisherName,
      workTitle: row.title,
      contentType: row.contentType,
      message: args.message,
      contentId: args.contentId,
      submittedBy: caller._id,
      status: "pending",
      createdAt: Date.now(),
    });
    return { ok: true, submissionId };
  },
});

/** Admin: approve → publish the linked work automatically. */
export const approveSubmission = mutation({
  args: { id: v.id("publisher_submissions"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const sub = await ctx.db.get(args.id);
    if (!sub) throw new Error("الطلب غير موجود");
    if (sub.status === "accepted") throw new Error("تمت الموافقة مسبقًا");

    const now = Date.now();
    await ctx.db.patch(args.id, { status: "accepted" });

    if (sub.contentId) {
      await ctx.db.patch(sub.contentId, { status: "published", updatedAt: now });
      if (sub.submittedBy) {
        await ctx.db.insert("notifications", {
          userId: sub.submittedBy,
          title: "تم نشر عملك 🎉",
          body: `«${sub.workTitle}» أصبح متاحًا للجميع على حكي.`,
          isRead: false,
          createdAt: now,
        });
        try {
          await ctx.scheduler.runAfter(0, api.email.sendToUser, {
            kind: "welcome" as const,
            userId: sub.submittedBy,
          });
        } catch {
          /* best-effort */
        }
      }
    }
    void admin;
    void args.note;
    return { ok: true };
  },
});

/** Admin: reject with a reason (message field carries the reason). */
export const rejectSubmission = mutation({
  args: { id: v.id("publisher_submissions"), reason: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const sub = await ctx.db.get(args.id);
    if (!sub) throw new Error("الطلب غير موجود");
    await ctx.db.patch(args.id, { status: "rejected", message: args.reason.slice(0, 500) });
    if (sub.submittedBy) {
      await ctx.db.insert("notifications", {
        userId: sub.submittedBy,
        title: "لم يُعتمد عملك",
        body: `«${sub.workTitle}»: ${args.reason.slice(0, 300)}`,
        isRead: false,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

/** Public: my studio role for gating /studio in the UI. */
export const myRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return { role: user.role ?? "user", name: user.name ?? null };
  },
});
