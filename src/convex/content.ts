import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { enrichContent, requireStaff, isAdminRole, canConsumeContent, type EnrichedContent } from "./lib";
import { stripMedia } from "./accessLogic";
import { CONTENT_TYPES, contentTypeValidator, contentStatusValidator } from "./schema";

/**
 * Public content queries used across the app.
 * All are read-only and safe to call without auth.
 */

export const listPublished = query({
  args: {
    contentType: v.optional(contentTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let rows: Doc<"content">[];
    if (args.contentType) {
      rows = await ctx.db
        .query("content")
        .withIndex("by_type_status", (q) =>
          q.eq("contentType", args.contentType!).eq("status", "published"),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("content")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .collect();
    }
    rows.sort((a, b) => b.createdAt - a.createdAt);
    if (args.limit) rows = rows.slice(0, args.limit);
    return await enrichContent(ctx, rows);
  },
});

export const listTrending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("content")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    const trending = rows.filter((r) => r.isTrending);
    trending.sort((a, b) => b.playCount - a.playCount);
    return await enrichContent(ctx, trending.slice(0, args.limit ?? 12));
  },
});

export const listFeatured = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("content")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    const featured = rows.filter((r) => r.isFeatured);
    return await enrichContent(ctx, featured.slice(0, args.limit ?? 10));
  },
});

export const listNew = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("content")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    const fresh = rows.filter((r) => r.isNew);
    fresh.sort((a, b) => b.createdAt - a.createdAt);
    return await enrichContent(ctx, fresh.slice(0, args.limit ?? 12));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("content")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!row) return null;
    const [enriched] = await enrichContent(ctx, [row]);
    return enriched;
  },
});

export const getById = query({
  args: { id: v.id("content") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const [enriched] = await enrichContent(ctx, [row]);
    return enriched;
  },
});

export const listChapters = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("chapters")
      .withIndex("by_content", (q) => q.eq("contentId", args.contentId))
      .collect();
    rows.sort((a, b) => a.number - b.number);
    // Never ship track media for premium works the viewer can't consume.
    const content = await ctx.db.get(args.contentId);
    const allowed = content ? await canConsumeContent(ctx, content) : false;
    return allowed ? rows : rows.map((r) => stripMedia(r));
  },
});

export const listEpisodes = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("episodes")
      .withIndex("by_content", (q) => q.eq("contentId", args.contentId))
      .collect();
    rows.sort((a, b) => a.number - b.number);
    const content = await ctx.db.get(args.contentId);
    const allowed = content ? await canConsumeContent(ctx, content) : false;
    return allowed ? rows : rows.map((r) => stripMedia(r));
  },
});

export const listAuthors = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("authors").collect();
  },
});

export const listNarrators = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("narrators").collect();
  },
});

export const listPublishers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("publishers").collect();
  },
});

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("categories").collect();
    rows.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return rows;
  },
});

export const search = query({
  args: {
    q: v.string(),
    type: v.optional(v.string()),
    /** How many matched items to return (powers the "load more" button). */
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const needle = args.q.trim().toLowerCase();
    if (!needle) {
      return { content: [], authors: [], narrators: [], podcasts: [] };
    }

    // content search
    const allContent = await ctx.db
      .query("content")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    const matchedContent = allContent.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        c.description.toLowerCase().includes(needle),
    );
    // author search
    const authors = (await ctx.db.query("authors").collect()).filter(
      (a) =>
        a.name.toLowerCase().includes(needle) ||
        (a.nameEn ?? "").toLowerCase().includes(needle),
    );
    const narrators = (await ctx.db.query("narrators").collect()).filter(
      (n) =>
        n.name.toLowerCase().includes(needle) ||
        (n.nameEn ?? "").toLowerCase().includes(needle),
    );

    // filter content by type group
    let filtered = matchedContent;
    if (args.type && args.type !== "all") {
      const groups: Record<string, string[]> = {
        books: ["ebook", "audiobook"],
        audiobooks: ["audiobook"],
        ebooks: ["ebook"],
        drama: ["audio_drama", "micro_drama"],
        micro_drama: ["micro_drama"],
        podcast: ["podcast"],
        magazine: ["magazine"],
        live: ["live"],
      };
      const allowed = groups[args.type];
      if (allowed) filtered = matchedContent.filter((c) => allowed.includes(c.contentType));
    }

    // enrich matched content (bounded for perf; the client can raise the
    // limit to page through more results)
    const limit = Math.min(Math.max(args.limit ?? 30, 10), 120);
    const enriched = await enrichContent(ctx, filtered.slice(0, limit));

    // also match content by author names
    const authorMatchedIds = new Set<Id<"content">>();
    for (const a of authors) {
      const byAuthor = allContent.filter((c) => c.authorId === a._id);
      for (const c of byAuthor) authorMatchedIds.add(c._id);
    }
    for (const e of enriched) authorMatchedIds.delete(e._id);
    const extra = await enrichContent(
      ctx,
      allContent.filter((c) => authorMatchedIds.has(c._id)).slice(0, 10),
    );

    return {
      content: [...enriched, ...extra],
      authors: authors.slice(0, 8),
      narrators: narrators.slice(0, 8),
      podcasts: [] as Doc<"podcasts">[],
      hasMore: filtered.length > limit,
    };
  },
});

/**
 * Browse with real filtering — all filters run server-side over published content.
 */
export const browse = query({
  args: {
    q: v.optional(v.string()),
    contentType: v.optional(contentTypeValidator),
    categorySlug: v.optional(v.string()),
    authorId: v.optional(v.id("authors")),
    narratorId: v.optional(v.id("narrators")),
    /** all | public_domain | free | premium (requires subscription) */
    rights: v.optional(
      v.union(
        v.literal("public_domain"),
        v.literal("free"),
        v.literal("premium"),
      ),
    ),
    duration: v.optional(v.union(v.literal("short"), v.literal("medium"), v.literal("long"))),
    /** Custom duration bounds in minutes (advanced filter sliders). */
    minDurationMin: v.optional(v.number()),
    maxDurationMin: v.optional(v.number()),
    /** Publication-year range (originalYear, falling back to releaseDate). */
    yearFrom: v.optional(v.number()),
    yearTo: v.optional(v.number()),
    /** Minimum average rating 1–5 (advanced filter). */
    minRating: v.optional(v.number()),
    sort: v.optional(
      v.union(v.literal("newest"), v.literal("popular"), v.literal("title"), v.literal("topRated")),
    ),
  },
  handler: async (ctx, args) => {
    let rows: Doc<"content">[];
    if (args.contentType) {
      rows = await ctx.db
        .query("content")
        .withIndex("by_type_status", (q) =>
          q.eq("contentType", args.contentType!).eq("status", "published"),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("content")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .collect();
    }

    if (args.q) {
      const needle = args.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(needle) ||
          r.description.toLowerCase().includes(needle),
      );
    }

    // category filter
    const categorySlug = args.categorySlug;
    if (categorySlug) {
      const cat = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", categorySlug))
        .first();
      const allLinks = await ctx.db.query("content_categories").collect();
      const matching = allLinks.filter((l) => l.categoryId === cat?._id);
      const ids = new Set(matching.map((l) => l.contentId));
      rows = rows.filter((r) => ids.has(r._id));
    }

    const enriched = await enrichContent(ctx, rows);

    let out: EnrichedContent[] = enriched;
    if (args.authorId) out = out.filter((r) => r.authorId === args.authorId);
    if (args.narratorId) out = out.filter((r) => r.narratorId === args.narratorId);
    if (args.rights) {
      if (args.rights === "public_domain") {
        out = out.filter((r) => r.rightsStatus === "public_domain");
      } else if (args.rights === "free") {
        // Free-to-consume: public-domain works and any active free plan.
        out = out.filter(
          (r) =>
            r.rightsStatus === "public_domain" || r.rightsStatus === "copyrighted",
        );
      }
      // "premium": everything that is NOT public-domain free content —
      // works whose rights are copyrighted-unknown/review or paid placements.
      else {
        const paidPlans = await ctx.db.query("subscription_plans").collect();
        const hasPaidPlan = paidPlans.some((p) => p.isActive && p.price > 0);
        out = out.filter((r) => hasPaidPlan && r.rightsStatus !== "public_domain");
      }
    }
    if (args.duration) {
      out = out.filter((r) => {
        const h = r.duration / 3600;
        if (args.duration === "short") return h < 2;
        if (args.duration === "medium") return h >= 2 && h <= 8;
        return h > 8;
      });
    }
    // Custom duration sliders (minutes) — takes precedence when provided.
    if (args.minDurationMin !== undefined || args.maxDurationMin !== undefined) {
      const min = (args.minDurationMin ?? 0) * 60;
      const max = (args.maxDurationMin ?? Number.MAX_SAFE_INTEGER) * 60;
      out = out.filter((r) => r.duration >= min && r.duration <= max);
    }

    // Publication-year range (originalYear, falling back to releaseDate year).
    if (args.yearFrom !== undefined || args.yearTo !== undefined) {
      const yearOf = (r: { originalYear?: number; releaseDate?: string }): number | undefined => {
        if (r.originalYear) return r.originalYear;
        if (r.releaseDate) {
          const y = Number.parseInt(r.releaseDate.slice(0, 4), 10);
          return Number.isFinite(y) ? y : undefined;
        }
        return undefined;
      };
      out = out.filter((r) => {
        const y = yearOf(r);
        if (y === undefined) return false;
        if (args.yearFrom !== undefined && y < args.yearFrom) return false;
        if (args.yearTo !== undefined && y > args.yearTo) return false;
        return true;
      });
    }

    const sort = args.sort ?? "newest";
    if (sort === "newest") out.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "popular") out.sort((a, b) => b.playCount - a.playCount);
    else if (sort === "topRated") {
      // Average rating per content from the ratings table (index-scoped reads).
      const scores = new Map<string, { sum: number; n: number }>();
      const ratings = await ctx.db.query("ratings").collect();
      for (const r of ratings) {
        const s = scores.get(r.contentId) ?? { sum: 0, n: 0 };
        s.sum += r.value;
        s.n += 1;
        scores.set(r.contentId, s);
      }
      out.sort((a, b) => {
        const sa = scores.get(a._id);
        const sb = scores.get(b._id);
        const ra = sa && sa.n > 0 ? sa.sum / sa.n : -1;
        const rb = sb && sb.n > 0 ? sb.sum / sb.n : -1;
        if (rb !== ra) return rb - ra;
        return b.playCount - a.playCount;
      });
    } else out.sort((a, b) => a.title.localeCompare(b.title, "ar"));

    // Minimum average rating (advanced filter) — applied after computing scores.
    if (args.minRating !== undefined && args.minRating > 0) {
      const scores = new Map<string, { sum: number; n: number }>();
      const ratings = await ctx.db.query("ratings").collect();
      for (const r of ratings) {
        const s = scores.get(r.contentId) ?? { sum: 0, n: 0 };
        s.sum += r.value;
        s.n += 1;
        scores.set(r.contentId, s);
      }
      out = out.filter((r) => {
        const s = scores.get(r._id);
        return s !== undefined && s.n > 0 && s.sum / s.n >= args.minRating!;
      });
    }

    return out;
  },
});

/**
 * Cascading facet counts for the browse page's drill-down pills:
 * counts of sub-categories / authors / narrators **within the current
 * filter result set**, so every next level only shows what actually has
 * content (type → category → author → narrator).
 */
export const browseFacets = query({
  args: {
    q: v.optional(v.string()),
    contentType: v.optional(contentTypeValidator),
    categorySlug: v.optional(v.string()),
    authorId: v.optional(v.id("authors")),
    narratorId: v.optional(v.id("narrators")),
    rights: v.optional(
      v.union(v.literal("public_domain"), v.literal("free"), v.literal("premium")),
    ),
    minDurationMin: v.optional(v.number()),
    maxDurationMin: v.optional(v.number()),
    yearFrom: v.optional(v.number()),
    yearTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let rows: Doc<"content">[];
    if (args.contentType) {
      rows = await ctx.db
        .query("content")
        .withIndex("by_type_status", (q) =>
          q.eq("contentType", args.contentType!).eq("status", "published"),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("content")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .collect();
    }

    if (args.q) {
      const needle = args.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(needle) ||
          r.description.toLowerCase().includes(needle),
      );
    }

    // Resolve category slug → id and filter by it.
    let activeCategoryId: Id<"categories"> | undefined;
    if (args.categorySlug) {
      const cat = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", args.categorySlug!))
        .first();
      activeCategoryId = cat?._id;
      if (cat) {
        const links = await ctx.db.query("content_categories").collect();
        const ids = new Set(links.filter((l) => l.categoryId === cat._id).map((l) => l.contentId));
        rows = rows.filter((r) => ids.has(r._id));
      }
    }
    if (args.authorId) rows = rows.filter((r) => r.authorId === args.authorId);
    if (args.narratorId) rows = rows.filter((r) => r.narratorId === args.narratorId);
    if (args.rights) {
      if (args.rights === "public_domain") {
        rows = rows.filter((r) => r.rightsStatus === "public_domain");
      } else if (args.rights === "free") {
        rows = rows.filter(
          (r) => r.rightsStatus === "public_domain" || r.rightsStatus === "copyrighted",
        );
      } else {
        rows = rows.filter((r) => r.rightsStatus !== "public_domain");
      }
    }
    if (args.minDurationMin !== undefined || args.maxDurationMin !== undefined) {
      const min = (args.minDurationMin ?? 0) * 60;
      const max = (args.maxDurationMin ?? Number.MAX_SAFE_INTEGER) * 60;
      rows = rows.filter((r) => r.duration >= min && r.duration <= max);
    }

    // Publication-year range (same rule as browse: originalYear → releaseDate).
    if (args.yearFrom !== undefined || args.yearTo !== undefined) {
      const yearOf = (r: { originalYear?: number; releaseDate?: string }): number | undefined => {
        if (r.originalYear) return r.originalYear;
        if (r.releaseDate) {
          const y = Number.parseInt(r.releaseDate.slice(0, 4), 10);
          return Number.isFinite(y) ? y : undefined;
        }
        return undefined;
      };
      rows = rows.filter((r) => {
        const y = yearOf(r); 
        if (y === undefined) return false;
        if (args.yearFrom !== undefined && y < args.yearFrom) return false;
        if (args.yearTo !== undefined && y > args.yearTo) return false;
        return true;
      });
    }

    // Category counts (all categories, with how many matching items each has).
    const allLinks = await ctx.db.query("content_categories").collect();
    const rowIds = new Set(rows.map((r) => r._id));
    const catCount = new Map<string, number>();
    for (const l of allLinks) {
      if (!rowIds.has(l.contentId)) continue;
      catCount.set(l.categoryId, (catCount.get(l.categoryId) ?? 0) + 1);
    }
    const categories = (await ctx.db.query("categories").collect())
      .map((c) => ({
        id: c._id,
        name: c.name,
        nameEn: c.nameEn,
        slug: c.slug,
        count: catCount.get(c._id) ?? 0,
        active: c._id === activeCategoryId,
      }))
      .filter((c) => c.count > 0 || c.active)
      .sort((a, b) => b.count - a.count)
      .slice(0, 14);

    // Year range within the filtered rows (drives the year-range inputs).
    let minYear: number | undefined;
    let maxYear: number | undefined;
    for (const r of rows) {
      const y = r.originalYear ?? (r.releaseDate ? Number.parseInt(r.releaseDate.slice(0, 4), 10) : NaN);
      if (Number.isFinite(y)) {
        minYear = minYear === undefined ? y : Math.min(minYear, y);
        maxYear = maxYear === undefined ? y : Math.max(maxYear, y);
      }
    }

    return { categories, yearRange: { min: minYear, max: maxYear }, total: rows.length };
  },
});

/** Live search suggestions for the browse box (top 5 matches). */
export const suggest = query({
  args: {
    q: v.string(),
    type: v.optional(contentTypeValidator),
  },
  handler: async (ctx, args) => {
    const needle = args.q.trim().toLowerCase();
    if (needle.length < 2) return [];
    let rows: Doc<"content">[];
    if (args.type) {
      rows = await ctx.db
        .query("content")
        .withIndex("by_type_status", (q) =>
          q.eq("contentType", args.type!).eq("status", "published"),
        )
        .collect();
    } else {
      rows = await ctx.db
        .query("content")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .collect();
    }
    const matched = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle),
    );
    matched.sort((a, b) => b.playCount - a.playCount);
    return matched.slice(0, 5).map((r) => ({
      _id: r._id,
      slug: r.slug,
      title: r.title,
      coverImage: r.coverImage ?? null,
      contentType: r.contentType,
      externalId: r.externalId,
      sourceName: r.sourceName,
    }));
  },
});

export const listAllForAdmin = query({
  args: {},
  handler: async (ctx) => {
    // Staff-only: admins see everything (incl. drafts); publishers/authors
    // see only rows they own.
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
    return await enrichContent(ctx, scoped);
  },
});

/** Internal: published slugs for the dynamic sitemap (no auth, minimal data). */
export const publishedSlugsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("content")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    return rows.map((r) => r.slug);
  },
});

export { CONTENT_TYPES };
