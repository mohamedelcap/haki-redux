import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Public, aggregated platform stats for the About page (live numbers).
 * No auth: only non-sensitive aggregates are returned.
 */
export const platformStats = query({
  args: {},
  returns: v.object({
    publishedCount: v.number(),
    audiobookCount: v.number(),
    ebookCount: v.number(),
    podcastCount: v.number(),
    authorCount: v.number(),
    narratorCount: v.number(),
    totalHours: v.number(),
    publicDomainCount: v.number(),
  }),
  handler: async (ctx) => {
    const [content, authors, narrators] = await Promise.all([
      ctx.db.query("content").withIndex("by_status", (q) => q.eq("status", "published")).collect(),
      ctx.db.query("authors").collect(),
      ctx.db.query("narrators").collect(),
    ]);
    const totalSeconds = content.reduce((acc, c) => acc + (c.duration ?? 0), 0);
    return {
      publishedCount: content.length,
      audiobookCount: content.filter((c) => c.contentType === "audiobook").length,
      ebookCount: content.filter((c) => c.contentType === "ebook").length,
      podcastCount: content.filter((c) => c.contentType === "podcast").length,
      authorCount: authors.length,
      narratorCount: narrators.length,
      totalHours: Math.round(totalSeconds / 3600),
      publicDomainCount: content.filter((c) => c.rightsStatus === "public_domain").length,
    };
  },
});
