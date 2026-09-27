import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Reading progress + reader prefs for the current user on one book. */
export const getProgress = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("reading_progress")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .first();
  },
});

/** Save/patch reading progress. Silently ignored for guests. */
export const saveProgress = mutation({
  args: {
    contentId: v.id("content"),
    cfi: v.optional(v.string()),
    percent: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false };

    const now = Date.now();
    const existing = await ctx.db
      .query("reading_progress")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        cfi: args.cfi ?? existing.cfi,
        percent: args.percent,
        updatedAt: now,
      });
      return { ok: true };
    }
    await ctx.db.insert("reading_progress", {
      userId,
      contentId: args.contentId,
      cfi: args.cfi,
      percent: args.percent,
      updatedAt: now,
    });
    return { ok: true };
  },
});

/** Persist reader preferences (theme/font/size/flow) with progress. */
export const savePrefs = mutation({
  args: {
    contentId: v.id("content"),
    prefs: v.string(), // JSON
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false };
    const existing = await ctx.db
      .query("reading_progress")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { prefs: args.prefs, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("reading_progress", {
        userId,
        contentId: args.contentId,
        percent: 0,
        prefs: args.prefs,
        updatedAt: Date.now(),
      });
    }
    return { ok: true };
  },
});
