import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { enrichContent } from "./lib";

// ---------------- User library (my list / saved / reading) ----------------

export const myLibrary = query({
  args: { kind: v.optional(v.union(v.literal("mylist"), v.literal("saved"), v.literal("reading"))) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    let rows;
    if (args.kind) {
      rows = await ctx.db
        .query("user_library")
        .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", args.kind!))
        .collect();
    } else {
      rows = await ctx.db
        .query("user_library")
        .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", "mylist"))
        .collect();
    }
    rows.sort((a, b) => b.addedAt - a.addedAt);
    const items = await Promise.all(
      rows.map(async (row) => {
        const content = await ctx.db.get(row.contentId);
        return content ? { ...row, content } : null;
      }),
    );
    const valid = items.filter(Boolean) as NonNullable<(typeof items)[number]>[];
    return await Promise.all(
      valid.map(async (row) => {
        const [enriched] = await enrichContent(ctx, [row.content]);
        return { ...row, content: enriched };
      }),
    );
  },
});

export const isInLibrary = query({
  args: { contentId: v.id("content"), kind: v.union(v.literal("mylist"), v.literal("saved"), v.literal("reading")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const rows = await ctx.db
      .query("user_library")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentId", args.contentId))
      .collect();
    return rows.some((r) => r.kind === args.kind);
  },
});

export const toggleLibrary = mutation({
  args: {
    contentId: v.id("content"),
    kind: v.union(v.literal("mylist"), v.literal("saved"), v.literal("reading")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");
    const rows = await ctx.db
      .query("user_library")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentId", args.contentId))
      .collect();
    const existing = rows.find((r) => r.kind === args.kind);
    if (existing) {
      await ctx.db.delete(existing._id);
      return { added: false };
    }
    await ctx.db.insert("user_library", {
      userId,
      contentId: args.contentId,
      kind: args.kind,
      addedAt: Date.now(),
    });
    return { added: true };
  },
});

export const removeFromLibrary = mutation({
  args: { id: v.id("user_library") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول أولاً");
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("غير مصرح");
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

// ---------------- Listening history & progress ----------------

export const recordListen = mutation({
  args: {
    contentId: v.id("content"),
    position: v.number(),
    duration: v.number(),
    chapterId: v.optional(v.id("chapters")),
    episodeId: v.optional(v.id("episodes")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false };
    const now = Date.now();

    // upsert progress
    const existing = await ctx.db
      .query("listening_progress")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentId", args.contentId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        position: args.position,
        duration: args.duration,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("listening_progress", {
        userId,
        contentId: args.contentId,
        position: args.position,
        duration: args.duration,
        updatedAt: now,
      });
    }

    // history entry (throttled to 1 per minute per content)
    const history = await ctx.db
      .query("listening_history")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const last = history
      .filter((h) => h.contentId === args.contentId)
      .sort((a, b) => b.playedAt - a.playedAt)[0];
    if (!last || now - last.playedAt > 60_000) {
      await ctx.db.insert("listening_history", {
        userId,
        contentId: args.contentId,
        episodeId: args.episodeId,
        chapterId: args.chapterId,
        position: args.position,
        duration: args.duration,
        playedAt: now,
      });
    } else {
      await ctx.db.patch(last._id, {
        position: args.position,
        playedAt: now,
      });
    }
    return { ok: true };
  },
});

export const getProgress = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("listening_progress")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentId", args.contentId))
      .first();
  },
});

export const getProgressMap = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return {} as Record<string, { position: number; duration: number }>;
    const rows = await ctx.db
      .query("listening_progress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const map: Record<string, { position: number; duration: number }> = {};
    for (const r of rows) map[r.contentId] = { position: r.position, duration: r.duration };
    return map;
  },
});

export const myHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("listening_history")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.playedAt - a.playedAt);
    const limited = rows.slice(0, args.limit ?? 50);
    const items = await Promise.all(
      limited.map(async (row) => {
        const content = await ctx.db.get(row.contentId);
        return content ? { ...row, content } : null;
      }),
    );
    const valid = items.filter(Boolean) as NonNullable<(typeof items)[number]>[];
    return await Promise.all(
      valid.map(async (row) => {
        const [enriched] = await enrichContent(ctx, [row.content]);
        return { ...row, content: enriched };
      }),
    );
  },
});

export const continueListening = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("listening_progress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    const items = await Promise.all(
      rows.slice(0, 10).map(async (row) => {
        const content = await ctx.db.get(row.contentId);
        return content ? { ...row, content } : null;
      }),
    );
    const valid = items.filter(Boolean) as NonNullable<(typeof items)[number]>[];
    return await Promise.all(
      valid.map(async (row) => {
        const [enriched] = await enrichContent(ctx, [row.content]);
        return { ...row, content: enriched };
      }),
    );
  },
});

// ---------------- Notifications ----------------

export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    // Indexed, newest-first, capped — no full user scan.
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
  },
});

/** Mark one notification as read. */
export const markNotificationRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("غير مصرح");
    if (!row.isRead) await ctx.db.patch(args.id, { isRead: true });
  },
});

/** Mark all of the current user's notifications as read. */
export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);
    for (const row of rows) {
      if (!row.isRead) await ctx.db.patch(row._id, { isRead: true });
    }
  },
});
