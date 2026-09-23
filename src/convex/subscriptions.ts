import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib";

// ---------------- Subscription plans (admin-managed) ----------------

export const listPlans = query({
  args: { activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let rows = await ctx.db.query("subscription_plans").collect();
    if (args.activeOnly) rows = rows.filter((r) => r.isActive);
    rows.sort((a, b) => a.order - b.order);
    return rows;
  },
});

export const upsertPlan = mutation({
  args: {
    id: v.optional(v.id("subscription_plans")),
    name: v.string(),
    nameEn: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.number(),
    currency: v.string(),
    period: v.union(v.literal("monthly"), v.literal("yearly")),
    features: v.array(v.string()),
    featuresEn: v.optional(v.array(v.string())),
    isPopular: v.boolean(),
    isActive: v.boolean(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("subscription_plans", data);
  },
});

export const deletePlan = mutation({
  args: { id: v.id("subscription_plans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ---------------- User subscription ----------------

export const mySubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const active = subs
      .filter((s) => s.status === "active" && s.expiresAt > Date.now())
      .sort((a, b) => b.startedAt - a.startedAt)[0];
    if (!active) return null;
    const plan = await ctx.db.get(active.planId);
    return { ...active, plan };
  },
});

export const subscribe = mutation({
  args: { planId: v.id("subscription_plans") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول للاشتراك");
    const plan = await ctx.db.get(args.planId);
    if (!plan || !plan.isActive) throw new Error("هذه الباقة غير متاحة");
    // In production this would create a payment intent with a payment provider.
    // Architecture is ready to wire a gateway later.
    const now = Date.now();
    const expiresAt =
      plan.period === "monthly"
        ? now + 30 * 86400000
        : now + 365 * 86400000;
    const id = await ctx.db.insert("subscriptions", {
      userId,
      planId: args.planId,
      status: "active",
      startedAt: now,
      expiresAt,
    });
    return { ok: true, subscriptionId: id };
  },
});

export const cancelMySubscription = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول");
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of subs) {
      if (s.status === "active") {
        await ctx.db.patch(s._id, { status: "cancelled" });
      }
    }
    return { ok: true };
  },
});
