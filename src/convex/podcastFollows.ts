import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Follow a podcast (content of type podcast). */
export const follow = mutation({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("سجّل الدخول لمتابعة البرنامج");
    const existing = await ctx.db
      .query("podcast_follows")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .collect();
    if (existing[0]) return existing[0]._id;
    return await ctx.db.insert("podcast_follows", {
      userId,
      contentId: args.contentId,
      followedAt: Date.now(),
    });
  },
});

/** Unfollow a podcast. */
export const unfollow = mutation({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const existing = await ctx.db
      .query("podcast_follows")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
  },
});

/** Is the current user following this podcast? */
export const isFollowing = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const rows = await ctx.db
      .query("podcast_follows")
      .withIndex("by_user_content", (q) =>
        q.eq("userId", userId).eq("contentId", args.contentId),
      )
      .collect();
    return rows.length > 0;
  },
});

/** Podcasts the current user follows (with enriched content). */
export const myFollows = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("podcast_follows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.followedAt - a.followedAt);
    const content = await Promise.all(rows.map((r) => ctx.db.get(r.contentId)));
    return content.filter(Boolean);
  },
});

/** Follower count for a podcast. */
export const followerCount = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("podcast_follows").collect();
    return all.filter((f) => f.contentId === args.contentId).length;
  },
});

/**
 * Notify all followers of a podcast that a new episode is out.
 * Called by admins/publishers after adding an episode.
 */
export const notifyFollowersInternal = internalMutation({
  args: { contentId: v.id("content"), episodeTitle: v.string() },
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.contentId);
    if (!show) return;
    // by_user index is on userId, so we scan and filter by contentId.
    const all = await ctx.db.query("podcast_follows").collect();
    const targets = all.filter((f) => f.contentId === args.contentId);
    const now = Date.now();
    for (const f of targets) {
      await ctx.db.insert("notifications", {
        userId: f.userId,
        title: `حلقة جديدة في ${show.title}`,
        body: args.episodeTitle,
        isRead: false,
        createdAt: now,
      });
    }
    return targets.length;
  },
});
