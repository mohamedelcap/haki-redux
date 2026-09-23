import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { enrichContent } from "./lib";

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

/** Followed shows for the current user (enriched content). */
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

/**
 * Notify all followers of a show that a new episode is out.
 * Called by admins/podcast owners when adding an episode.
 * Returns the number of notifications created.
 */
export const notifyFollowersOfNewEpisode = mutation({
  args: {
    contentId: v.id("content"),
    episodeTitle: v.string(),
    showTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("podcast_follows")
      .withIndex("by_content", (q) => q.eq("contentId", args.contentId))
      .collect();

    const now = Date.now();
    for (const f of followers) {
      // Skip a duplicate notification for the same episode (within 1 hour).
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", f.userId))
        .order("desc")
        .first();
      if (
        recent &&
        recent.title.includes(args.episodeTitle) &&
        now - recent.createdAt < 3600_000
      ) {
        continue;
      }
      await ctx.db.insert("notifications", {
        userId: f.userId,
        title: `حلقة جديدة في ${args.showTitle}`,
        body: args.episodeTitle,
        isRead: false,
        createdAt: now,
      });
    }
    return { notified: followers.length };
  },
});
