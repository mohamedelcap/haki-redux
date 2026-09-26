import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin, requireStaff, requireSuperAdmin } from "./lib";
import { challengeStatusValidator } from "./schema";
import { enrichContent } from "./lib";

// ---------------- Statistics ----------------

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const [content, users, plans, subs, authors, narrators, publishers, categories] = await Promise.all([
      ctx.db.query("content").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("subscription_plans").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("authors").collect(),
      ctx.db.query("narrators").collect(),
      ctx.db.query("publishers").collect(),
      ctx.db.query("categories").collect(),
    ]);
    const audiobooks = content.filter((c) => c.contentType === "audiobook").length;
    const ebooks = content.filter((c) => c.contentType === "ebook").length;
    const dramas = content.filter(
      (c) => c.contentType === "audio_drama" || c.contentType === "micro_drama",
    ).length;
    const podcasts = content.filter((c) => c.contentType === "podcast").length;
    const magazines = content.filter((c) => c.contentType === "magazine").length;
    const subscribers = subs.filter((s) => s.status === "active").length;
    const totalPlays = content.reduce((acc, c) => acc + c.playCount, 0);
    const totalListenSeconds = content.reduce((acc, c) => acc + c.playCount * c.duration, 0);

    // Latest 8 content rows for the dashboard table.
    content.sort((a, b) => b.createdAt - a.createdAt);
    const recentRows = content.slice(0, 8);
    const enriched = await enrichContent(ctx, recentRows);
    const recentContent = enriched.map((c: any) => ({
      _id: c._id,
      title: c.title,
      contentType: c.contentType,
      createdAt: recentRows.find((r) => r._id === c._id)?.createdAt ?? 0,
      authorName: c.authorName ?? null,
    }));

    return {
      users: users.length,
      content: content.length,
      audiobooks,
      ebooks,
      dramas,
      podcasts,
      magazines,
      subscribers,
      totalPlays,
      totalListenHours: Math.round(totalListenSeconds / 3600),
      publishingEntities: authors.length + narrators.length + publishers.length + categories.length,
      recentContent,
    };
  },
});

// ---------------- Authors / Narrators / Publishers / Categories CRUD ----------------

const entityTables = ["authors", "narrators", "publishers", "categories"] as const;
type EntityTable = (typeof entityTables)[number];

function entityArgs(extra: any = {}) {
  return {
    table: v.union(...entityTables.map((t) => v.literal(t))),
    id: v.optional(v.id("authors")),
    name: v.string(),
    nameEn: v.optional(v.string()),
    bio: v.optional(v.string()),
    image: v.optional(v.string()),
    slug: v.optional(v.string()),
    ...extra,
  };
}

export const listEntity = query({
  args: { table: v.union(...entityTables.map((t) => v.literal(t))) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    return await ctx.db.query(args.table).collect();
  },
});

export const upsertEntity = mutation({
  args: entityArgs(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { table, id, name, nameEn, bio, image, slug } = args;
    if (table === "categories" && !slug) {
      throw new Error("التصنيف يتطلب slug");
    }
    const data: Record<string, unknown> = { name };
    if (nameEn !== undefined) data.nameEn = nameEn;
    if (bio !== undefined) data.bio = bio;
    if (image !== undefined) data.image = image;
    if (slug !== undefined) data.slug = slug;
    if (id) {
      await ctx.db.patch(id as any, data);
      return id;
    }
    return await ctx.db.insert(table as any, data as any);
  },
});

export const deleteEntity = mutation({
  args: {
    table: v.union(...entityTables.map((t) => v.literal(t))),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id as Id<EntityTable>);
  },
});
