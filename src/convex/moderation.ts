import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib";
import { maskProfanity, sanitizeText } from "./importSources";

/**
 * Submit (or update) the current user's rating with automatic profanity
 * filtering. Returns whether the review was auto-masked.
 */
export const submit = mutation({
  args: {
    contentId: v.id("content"),
    value: v.number(),
    review: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("سجّل الدخول لتقييم هذا العمل");
    const value = Math.max(1, Math.min(5, Math.round(args.value)));
    const now = Date.now();
    const raw = args.review?.trim() ? args.review.trim().slice(0, 500) : undefined;
    const review = raw ? maskProfanity(sanitizeText(raw)) : undefined;

    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentId", args.contentId))
      .collect();

    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, {
        value,
        review,
        isHidden: undefined,
        updatedAt: now,
      });
      return { masked: raw !== review };
    }
    await ctx.db.insert("ratings", {
      contentId: args.contentId,
      userId,
      value,
      review,
      createdAt: now,
      updatedAt: now,
    });
    return { masked: raw !== review };
  },
});

/** Flag a review for moderator attention. One open report per user per review. */
export const report = mutation({
  args: { ratingId: v.id("ratings"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("سجّل الدخول للإبلاغ");
    const rating = await ctx.db.get(args.ratingId);
    if (!rating) throw new Error("التقييم غير موجود");

    const existing = await ctx.db
      .query("review_reports")
      .withIndex("by_rating", (q) => q.eq("ratingId", args.ratingId))
      .collect();
    if (existing.some((r) => r.reporterId === userId && r.status === "pending")) {
      return { ok: true, duplicate: true };
    }
    await ctx.db.insert("review_reports", {
      ratingId: args.ratingId,
      reporterId: userId,
      reason: args.reason?.slice(0, 300),
      status: "pending",
      createdAt: Date.now(),
    });
    return { ok: true, duplicate: false };
  },
});

/** Admin: pending reports queue with review + reporter details. */
export const listPendingReports = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const reports = await ctx.db
      .query("review_reports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    reports.sort((a, b) => b.createdAt - a.createdAt);

    return await Promise.all(
      reports.slice(0, 100).map(async (r) => {
        const rating = await ctx.db.get(r.ratingId);
        const [reviewer, reporter, content] = await Promise.all([
          rating ? ctx.db.get(rating.userId) : null,
          ctx.db.get(r.reporterId),
          rating ? ctx.db.get(rating.contentId) : null,
        ]);
        return {
          _id: r._id,
          ratingId: r.ratingId,
          reason: r.reason,
          createdAt: r.createdAt,
          value: rating?.value ?? 0,
          review: rating?.review ?? "",
          isHidden: rating?.isHidden ?? false,
          reviewText: rating?.review,
          reviewerName: (reviewer as { name?: string } | null)?.name ?? "—",
          reporterName: (reporter as { name?: string } | null)?.name ?? "—",
          contentTitle: content?.title ?? "—",
        };
      }),
    );
  },
});

/** Admin: hide/show a review (hidden reviews leave the public list). */
export const setHidden = mutation({
  args: { ratingId: v.id("ratings"), hidden: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.ratingId, { isHidden: args.hidden ? true : undefined });
  },
});

/** Admin: delete a review outright. */
export const adminDelete = mutation({
  args: { ratingId: v.id("ratings") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const reports = await ctx.db
      .query("review_reports")
      .withIndex("by_rating", (q) => q.eq("ratingId", args.ratingId))
      .collect();
    for (const r of reports) await ctx.db.delete(r._id);
    await ctx.db.delete(args.ratingId);
  },
});

/** Admin: resolve a report (after hiding/deleting or dismissing). */
export const resolveReport = mutation({
  args: { reportId: v.id("review_reports") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.reportId, { status: "resolved", resolvedAt: Date.now() });
  },
});
