import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin, requireSuperAdmin, requireContentAccess, enrichContent, type EnrichedContent } from "./lib";

/**
 * Homepage sections are fully dynamic: the admin creates/edits/hides sections
 * and picks their data source; the public page renders whatever is configured.
 */

export type SectionItem = EnrichedContent;

/** Admin: list all sections in order. */
export const listSections = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("homepage_sections").collect();
  },
});

/** Admin: upsert a section. */
export const upsertSection = mutation({
  args: {
    id: v.optional(v.id("homepage_sections")),
    key: v.string(),
    titleAr: v.string(),
    titleEn: v.string(),
    sourceType: v.string(),
    contentType: v.optional(v.string()),
    limit: v.optional(v.number()),
    isHidden: v.optional(v.boolean()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, contentType, ...rest } = args;
    const data = {
      ...rest,
      contentType: (contentType || undefined) as any,
      itemIds: undefined,
    };
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("homepage_sections", data);
  },
});

/** Admin: reorder (drag-free: number inputs) or hide/show sections. */
export const patchSection = mutation({
  args: {
    id: v.id("homepage_sections"),
    order: v.optional(v.number()),
    isHidden: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    titleAr: v.optional(v.string()),
    titleEn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...patch } = args;
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(id, clean);
  },
});

/** Admin: set a section's manual items (sourceType="manual"). */
export const setSectionItems = mutation({
  args: {
    id: v.id("homepage_sections"),
    itemIds: v.array(v.id("content")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { itemIds: args.itemIds, sourceType: "manual" });
  },
});

/** Admin: delete a section. */
export const deleteSection = mutation({
  args: { id: v.id("homepage_sections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

/** Admin: quick flag toggles on content (publish/featured/trending/new). Owner-scoped. */
export const setFlags = mutation({
  args: {
    contentId: v.id("content"),
    status: v.optional(v.union(v.literal("published"), v.literal("draft"), v.literal("archived"))),
    isFeatured: v.optional(v.boolean()),
    isTrending: v.optional(v.boolean()),
    isNew: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const content = await ctx.db.get(args.contentId);
    await requireContentAccess(ctx, content);
    const { contentId, ...patch } = args;
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    await ctx.db.patch(contentId, { ...clean, updatedAt: Date.now() });
  },
});

/** Admin: attach an ebook file (PDF/EPUB) URL to a content item. */
export const saveContentFile = mutation({
  args: {
    storageId: v.id("_storage"),
    contentId: v.id("content"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("الملف غير موجود في التخزين");
    await ctx.db.patch(args.contentId, { fileUrl: url });
    return { url };
  },
});

/** Public: the visible sections in order, each with its resolved items. */
export const getPublicSections = query({
  args: {},
  handler: async (ctx) => {
    const sections = await ctx.db
      .query("homepage_sections")
      .filter((q) => q.neq(q.field("isHidden"), true))
      .collect();
    sections.sort((a, b) => a.order - b.order);

    const out: { key: string; titleAr: string; titleEn: string; moreHref?: string; items: EnrichedContent[] }[] = [];
    for (const s of sections) {
      let rows: Doc<"content">[] = [];
      if (s.sourceType === "trending") {
        const all = await ctx.db
          .query("content")
          .withIndex("by_status", (q) => q.eq("status", "published"))
          .collect();
        rows = all.filter((r) => r.isTrending).sort((a, b) => b.playCount - a.playCount);
      } else if (s.sourceType === "new") {
        rows = await ctx.db
          .query("content")
          .withIndex("by_status", (q) => q.eq("status", "published"))
          .collect();
        rows.sort((a, b) => b.createdAt - a.createdAt);
      } else if (s.sourceType === "featured") {
        const all = await ctx.db
          .query("content")
          .withIndex("by_status", (q) => q.eq("status", "published"))
          .collect();
        rows = all.filter((r) => r.isFeatured);
      } else if (s.sourceType === "type" && s.contentType) {
        rows = await ctx.db
          .query("content")
          .withIndex("by_type_status", (q) =>
            q.eq("contentType", s.contentType as any).eq("status", "published"),
          )
          .collect();
        rows.sort((a, b) => b.createdAt - a.createdAt);
      } else if (s.sourceType === "manual" && s.itemIds) {
        for (const idRef of s.itemIds) {
          const row = await ctx.db.get(idRef);
          if (row && row.status === "published") rows.push(row);
        }
      }
      rows = rows.slice(0, s.limit ?? 10);
      if (rows.length === 0) continue;
      const items = await enrichContent(ctx, rows);

      let moreHref: string | undefined;
      if (s.sourceType === "type" && s.contentType) {
        const slugMap: Record<string, string> = {
          audiobook: "/browse/audiobooks",
          ebook: "/browse/ebooks",
          audio_drama: "/browse/drama",
          micro_drama: "/browse/micro-drama",
          podcast: "/browse/podcast",
          magazine: "/browse/magazines",
        };
        moreHref = slugMap[s.contentType];
      }

      out.push({ key: s.key, titleAr: s.titleAr, titleEn: s.titleEn, moreHref, items });
    }
    return out;
  },
});
