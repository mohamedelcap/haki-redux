import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

/**
 * Internal queries/mutations backing the Stripe actions in payments.ts.
 * Kept in a separate non-Node module because Convex only allows actions
 * in "use node" files.
 */

export const getUserEmail = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getPlan = internalQuery({
  args: { planId: v.id("subscription_plans") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.planId);
  },
});

export const myActiveSubInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
  },
});

export const setStatus = internalMutation({
  args: { id: v.id("subscriptions"), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status as any });
  },
});

export const insertSub = internalMutation({
  args: {
    userId: v.id("users"),
    planId: v.id("subscription_plans"),
    startedAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      planId: args.planId,
      status: "active",
      startedAt: args.startedAt,
      expiresAt: args.expiresAt,
    });
  },
});
