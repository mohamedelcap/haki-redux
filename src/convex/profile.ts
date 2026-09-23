import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getCurrentUser } from "./lib";

/** Update the signed-in user's display name. */
export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("غير مصرح");
    const name = args.name.trim();
    if (name.length < 2) throw new Error("الاسم قصير جدًا");
    await ctx.db.patch(user._id, { name });
    return { ok: true };
  },
});

/** Update the signed-in user's avatar (URL from upload panel). */
export const updateImage = mutation({
  args: { image: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("غير مصرح");
    const image = args.image.trim();
    if (!/^https?:\/\//.test(image) && !image.startsWith("data:")) {
      throw new Error("رابط الصورة غير صالح");
    }
    await ctx.db.patch(user._id, { image });
    return { ok: true };
  },
});

/** Update the signed-in user's preferred interface language. */
export const updateLanguage = mutation({
  args: { language: v.union(v.literal("ar"), v.literal("en")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("غير مصرح");
    await ctx.db.patch(user._id, { language: args.language });
    return { ok: true };
  },
});

/** Remove the avatar. */
export const removeImage = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("غير مصرح");
    await ctx.db.patch(user._id, { image: undefined });
    return { ok: true };
  },
});
