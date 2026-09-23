import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./lib";
import { roleValidator } from "./schema";

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const out = [];
    for (const u of users) {
      const subs = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", u._id))
        .collect();
      const active = subs.find((s) => s.status === "active" && s.expiresAt > Date.now());
      let planName: string | null = null;
      if (active) {
        const plan = await ctx.db.get(active.planId);
        planName = plan?.name ?? null;
      }
      out.push({
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        image: u.image ?? null,
        role: u.role ?? null,
        createdAt: u._creationTime,
        planName,
      });
    }
    return out;
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { role: args.role });
  },
});
