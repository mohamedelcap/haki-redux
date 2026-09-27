import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib";

/**
 * User playlists: create/rename/delete own lists, add/remove works,
 * and a public read for the playlist page.
 */

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("user_playlists")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows.map((r) => ({ ...r, itemCount: r.items.length }));
  },
});

export const getById = query({
  args: { id: v.id("user_playlists") },
  handler: async (ctx, args) => {
    const pl = await ctx.db.get(args.id);
    if (!pl) return null;
    const owner = await ctx.db.get(pl.ownerId);
    const items = [];
    for (const contentId of pl.items) {
      const c = await ctx.db.get(contentId);
      if (c && c.status === "published") items.push(c);
    }
    return {
      _id: pl._id,
      name: pl.name,
      description: pl.description ?? null,
      createdAt: pl.createdAt,
      ownerName: owner?.name ?? owner?.email ?? null,
      isOwner: false,
      items,
    };
  },
});

export const create = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("سجّل الدخول أولًا");
    const name = args.name.trim().slice(0, 80);
    if (name.length < 1) throw new Error("اسم القائمة مطلوب");
    const now = Date.now();
    return await ctx.db.insert("user_playlists", {
      name,
      ownerId: user._id,
      items: [],
      description: args.description?.slice(0, 200),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { id: v.id("user_playlists"), name: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const pl = await ctx.db.get(args.id);
    if (!user || !pl || pl.ownerId !== user._id) throw new Error("غير مصرح");
    await ctx.db.patch(args.id, {
      name: args.name.trim().slice(0, 80) || pl.name,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { id: v.id("user_playlists") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const pl = await ctx.db.get(args.id);
    if (!user || !pl || pl.ownerId !== user._id) throw new Error("غير مصرح");
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

export const addItem = mutation({
  args: { id: v.optional(v.id("user_playlists")), name: v.optional(v.string()), contentId: v.id("content") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("سجّل الدخول لإضافة القوائم");
    const content = await ctx.db.get(args.contentId);
    if (!content) throw new Error("المحتوى غير موجود");

    let plId = args.id;
    // No list specified: create/derive a default "قائمتي".
    if (!plId) {
      const rows = await ctx.db
        .query("user_playlists")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .collect();
      const defaultPl = rows.find((r) => r.name === (args.name?.trim() || "قائمتي"));
      if (defaultPl) plId = defaultPl._id;
      else {
        const now = Date.now();
        plId = await ctx.db.insert("user_playlists", {
          name: args.name?.trim().slice(0, 80) || "قائمتي",
          ownerId: user._id,
          items: [],
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const pl = await ctx.db.get(plId);
    if (!pl || pl.ownerId !== user._id) throw new Error("غير مصرح");
    if (pl.items.includes(args.contentId)) {
      return { ok: true, already: true, playlistId: plId, playlistName: pl.name };
    }
    await ctx.db.patch(plId, {
      items: [...pl.items, args.contentId],
      updatedAt: Date.now(),
    });
    return { ok: true, playlistId: plId, playlistName: pl.name };
  },
});

export const removeItem = mutation({
  args: { id: v.id("user_playlists"), contentId: v.id("content") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const pl = await ctx.db.get(args.id);
    if (!user || !pl || pl.ownerId !== user._id) throw new Error("غير مصرح");
    await ctx.db.patch(args.id, {
      items: pl.items.filter((c) => c !== args.contentId),
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Which of my playlists already contain this work (for the picker state). */
export const containingLists = query({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("user_playlists")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return rows
      .filter((r) => r.items.includes(args.contentId))
      .map((r) => r._id);
  },
});
