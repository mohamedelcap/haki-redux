import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib";
import { enrichContent } from "./lib";

/**
 * Curated collections (المجموعات المنسقة): admin-managed shelves of content
 * items shown on the public /collections page. Items are ordered manually.
 */

export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("collections").collect();
    rows.sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
    return rows;
  },
});

export const upsert = mutation({
  args: {
    id: v.optional(v.id("collections")),
    slug: v.string(),
    titleAr: v.string(),
    titleEn: v.optional(v.string()),
    descriptionAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    itemIds: v.array(v.id("content")),
    isHidden: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const slug = args.slug.trim().toLowerCase().replace(/\s+/g, "-");
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error("الـ slug يجب أن يكون بحروف إنجليزية وأرقام وشرطات فقط");
    }
    // Unique slug check (excluding the row being edited).
    const existing = await ctx.db
      .query("collections")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing && existing._id !== args.id) {
      throw new Error("الـ slug مستخدم بالفعل في مجموعة أخرى");
    }
    const doc = {
      slug,
      titleAr: args.titleAr.trim(),
      titleEn: args.titleEn?.trim() || "",
      descriptionAr: args.descriptionAr?.trim() || undefined,
      descriptionEn: args.descriptionEn?.trim() || undefined,
      coverImage: args.coverImage?.trim() || undefined,
      itemIds: args.itemIds,
      isHidden: args.isHidden ?? false,
      order: args.order ?? 99,
      updatedAt: now,
    };
    if (args.id) {
      await ctx.db.patch(args.id, doc);
      return args.id;
    }
    return await ctx.db.insert("collections", { ...doc, createdAt: now });
  },
});

export const remove = mutation({
  args: { id: v.id("collections") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

/** Public: visible collections in order, each with resolved ordered items. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("collections").collect();
    const visible = rows
      .filter((r) => !r.isHidden && r.itemIds.length > 0)
      .sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);

    const out: {
      _id: string;
      slug: string;
      titleAr: string;
      titleEn?: string;
      descriptionAr?: string;
      descriptionEn?: string;
      coverImage?: string;
      items: Awaited<ReturnType<typeof enrichContent>>;
    }[] = [];
    for (const r of visible) {
      const docs = (await Promise.all(r.itemIds.map((id) => ctx.db.get(id)))).filter(
        (d): d is NonNullable<typeof d> => !!d && d.status === "published",
      );
      // Keep the admin-defined order.
      const byId = new Map(docs.map((d) => [d._id, d]));
      const ordered = r.itemIds.map((id) => byId.get(id)).filter((d): d is NonNullable<typeof d> => !!d);
      out.push({
        _id: r._id,
        slug: r.slug,
        titleAr: r.titleAr,
        titleEn: r.titleEn,
        descriptionAr: r.descriptionAr,
        descriptionEn: r.descriptionEn,
        coverImage: r.coverImage,
        items: await enrichContent(ctx, ordered.slice(0, 12)),
      });
    }
    return out;
  },
});
