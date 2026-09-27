import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Aggregate rating for a piece of content. */
export const getSummary = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("ratings")
      .withIndex("by_content", (q) => q.eq("contentId", args.contentId))
      .collect();
    if (rows.length === 0) return { count: 0, average: 0 };
    const sum = rows.reduce((acc, r) => acc + r.value, 0);
    return {
      count: rows.length,
      average: Math.round((sum / rows.length) * 10) / 10,
    };
  },
});

/** Reviews for content (newest first) with the reviewer's name/image. */
export const listForContent = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("ratings")
      .withIndex("by_content", (q) => q.eq("contentId", args.contentId))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const visible = rows.filter((r) => !r.isHidden);

    return await Promise.all(
      visible.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        return {
          _id: row._id,
          value: row.value,
          review: row.review,
          createdAt: row.createdAt,
          userName: (user as any)?.name ?? "مستخدم حكي",
          userImage: (user as any)?.image,
          isMine: false,
        };
      }),
    );
  },
});

/** The current user's own rating for a piece of content. */
export const getMine = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("ratings")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .collect();
    return rows[0] ?? null;
  },
});

/** Submit or update the current user's rating (1..5) with optional review. */
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

    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .collect();

    if (existing[0]) {
      await ctx.db.patch(existing[0]._id, {
        value,
        review: args.review?.trim() || undefined,
        updatedAt: now,
      });
      return existing[0]._id;
    }
    return await ctx.db.insert("ratings", {
      contentId: args.contentId,
      userId,
      value,
      review: args.review?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Remove the current user's rating. */
export const remove = mutation({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const rows = await ctx.db
      .query("ratings")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});
