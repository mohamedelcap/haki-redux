"use use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "لم يتم ضبط مفتاح STRIPE_SECRET_KEY بعد — أضفه من لوحة المفاتيح لتفعيل الدفع.",
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

/**
 * Create a Stripe Checkout Session for a subscription plan.
 * Returns the hosted checkout URL to redirect the user to.
 * The plan price is read from the database (never hardcoded).
 */
export const createCheckoutSession = action({
  args: { planId: v.id("subscription_plans") },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول للاشتراك");

    const user: any = await ctx.runQuery(internal.payments.getUserEmail, { userId });
    if (!user?.email) throw new Error("يجب أن يكون لحسابك بريد إلكتروني");

    const plan: any = await ctx.runQuery(internal.payments.getPlan, { planId: args.planId });
    if (!plan || !plan.isActive) throw new Error("هذه الباقة غير متاحة");

    const stripe = getStripe();
    const origin = process.env.CLIENT_URL ?? "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      client_reference_id: `${userId}:${args.planId}`,
      line_items: [
        {
          price_data: {
            currency: (plan.currency || "usd").toLowerCase(),
            unit_amount: Math.round(plan.price * 100),
            product_data: { name: `HAKI — ${plan.name}` },
            recurring: {
              interval: plan.period === "yearly" ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/subscriptions?success=1`,
      cancel_url: `${origin}/subscriptions?cancelled=1`,
    });

    if (!session.url) throw new Error("تعذّر إنشاء جلسة الدفع");
    return { url: session.url };
  },
});

/**
 * Activates a subscription after successful payment.
 * Called from the success flow; verifies with Stripe before activating.
 */
export const activateAfterCheckout = action({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(args.sessionId);
    if (session.payment_status !== "paid" && session.status !== "complete") {
      throw new Error("لم يكتمل الدفع بعد");
    }
    const ref = session.client_reference_id ?? "";
    const [refUser, refPlan] = ref.split(":");
    if (refUser !== userId) throw new Error("بيانات الجلسة لا تطابق حسابك");
    if (!refPlan) throw new Error("جلسة دفع غير صالحة");

    const now = Date.now();
    const plan: any = await ctx.runQuery(internal.payments.getPlan, { planId: refPlan as never });
    const expiresAt =
      plan?.period === "yearly" ? now + 365 * 86400000 : now + 30 * 86400000;

    // Cancel previous active subscriptions of this user.
    const prev: any = await ctx.runQuery(internal.payments.myActiveSubInternal, {
      userId,
    });
    if (prev) await ctx.runMutation(internal.payments.setStatus, { id: prev._id, status: "cancelled" });

    await ctx.runMutation(internal.payments.insertSub, {
      userId,
      planId: refPlan as never,
      startedAt: now,
      expiresAt,
    });
    return { ok: true };
  },
});

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
