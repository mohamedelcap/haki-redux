// Podcast-follow API (compatibility layer).
// Follow/unfollow/myFollows live in podcastFollows.ts (single source of truth,
// also used by adminContent for new-episode notifications).
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { enrichContent } from "./lib";

export { follow, unfollow, myFollows } from "./podcastFollows";

/** Is the current user following this podcast/show? */
export const isFollowing = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const row = await ctx.db
      .query("podcast_follows")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .first();
    return row !== null;
  },
});

/** Toggle follow for a show. */
export const toggleFollow = mutation({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("سجّل الدخول لمتابعة هذا البرنامج");

    const existing = await ctx.db
      .query("podcast_follows")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { following: false };
    }

    await ctx.db.insert("podcast_follows", {
      userId,
      contentId: args.contentId,
      followedAt: Date.now(),
    });
    return { following: true };
  },
});

/** Followed shows for the current user (with enriched content). */
export const myFollowedShows = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("podcast_follows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.followedAt - a.followedAt);
    const contents = await Promise.all(rows.map((r) => ctx.db.get(r.contentId)));
    const valid = contents.filter(Boolean) as NonNullable<(typeof contents)[number]>[];
    return await enrichContent(ctx, valid);
  },
});
