import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib";

/** List all uploaded storage files (media library), admin-only. */
export const listFiles = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const files = await ctx.db.system.query("_storage").collect();
    const out = [] as {
      _id: string;
      contentType?: string;
      size?: number;
      createdAt?: number;
      url?: string;
    }[];
    for (const f of files) {
      const url = await ctx.storage.getUrl(f._id);
      out.push({
        _id: f._id,
        contentType: f.contentType,
        size: f.size,
        createdAt: f._creationTime,
        url: url ?? undefined,
      });
    }
    out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return out;
  },
});

/** Delete a storage file, admin-only. */
export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.storage.delete(args.storageId);
  },
});
