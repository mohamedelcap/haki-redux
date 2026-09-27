import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentUser, enrichContent } from "./lib";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * "Suggested for you": derives taste signals from the signed-in user's
 * listening history (favorite authors/categories/types), then fetches
 * published content matching those signals. Guests get the most played.
 */
export const recommendForUser = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 12, 24);
    const user = await getCurrentUser(ctx);

    // Guest fallback: most played published content.
    if (!user) {
      const rows = await ctx.db
        .query("content")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .collect();
      rows.sort((a, b) => b.playCount - a.playCount);
      return { personalized: false, items: await enrichContent(ctx, rows.slice(0, limit)) };
    }

    const history = await ctx.db
      .query("listening_history")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const seen = new Set<string>();
    const authorScore = new Map<string, number>();
    const typeScore = new Map<string, number>();
    for (const h of history) {
      seen.add(h.contentId);
    }
    // Resolve content rows for history (bounded by history length; users'
    // histories are capped by retention in practice).
    const historyContent: Doc<"content">[] = [];
    for (const contentId of seen) {
      const row = await ctx.db.get(contentId as Id<"content">);
      if (row) historyContent.push(row);
    }
    for (const row of historyContent) {
      if (row.authorId) authorScore.set(row.authorId, (authorScore.get(row.authorId) ?? 0) + 2);
      typeScore.set(row.contentType, (typeScore.get(row.contentType) ?? 0) + 1);
    }

    const topAuthors = [...authorScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
    const topTypes = [...typeScore.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

    // Candidate pool: published content, excluding already-listened.
    const published = await ctx.db
      .query("content")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    const scored = published
      .filter((c) => !seen.has(c._id))
      .map((c) => {
        let score = c.playCount / 1000; // mild popularity prior
        if (c.authorId && topAuthors.includes(c.authorId)) score += 10;
        if (topTypes.includes(c.contentType)) score += 4;
        if (c.isTrending) score += 2;
        if (c.isFeatured) score += 1;
        return { row: c, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.row);

    // Top up with popular content if signals are weak.
    if (scored.length < limit) {
      const taken = new Set(scored.map((s) => s._id));
      for (const row of published.sort((a, b) => b.playCount - a.playCount)) {
        if (scored.length >= limit) break;
        if (!seen.has(row._id) && !taken.has(row._id)) scored.push(row);
      }
    }

    return { personalized: scored.length > 0, items: await enrichContent(ctx, scored) };
  },
});
