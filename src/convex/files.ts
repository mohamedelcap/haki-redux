import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdmin, getCurrentUser } from "./lib";

/**
 * Generate a short-lived upload URL for direct browser → Convex storage upload.
 * Any signed-in user may request one (used for avatars); content files are
 * re-authorized when saving.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("سجّل الدخول أولًا");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Save an uploaded cover image and attach it to a content row (admin only). */
export const saveCover = mutation({
  args: {
    storageId: v.id("_storage"),
    contentId: v.id("content"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("الملف غير موجود في التخزين");
    await ctx.db.patch(args.contentId, { coverImage: url });
    return { url };
  },
});

/** Save an uploaded audio file (MP3/M4A) to content, chapter, or episode (admin only). */
export const saveAudio = mutation({
  args: {
    storageId: v.id("_storage"),
    target: v.union(
      v.object({ kind: v.literal("content"), contentId: v.id("content") }),
      v.object({ kind: v.literal("chapter"), chapterId: v.id("chapters") }),
      v.object({ kind: v.literal("episode"), episodeId: v.id("episodes") }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("الملف غير موجود في التخزين");
    if (args.target.kind === "content") {
      await ctx.db.patch(args.target.contentId, { audioUrl: url });
    } else if (args.target.kind === "chapter") {
      await ctx.db.patch(args.target.chapterId, { audioUrl: url });
    } else {
      await ctx.db.patch(args.target.episodeId, { audioUrl: url });
    }
    return { url };
  },
});

/** Save an uploaded avatar image for the signed-in user. */
export const saveAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("غير مصرح");
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("الملف غير موجود في التخزين");
    await ctx.db.patch(user._id, { image: url });
    return { url };
  },
});
