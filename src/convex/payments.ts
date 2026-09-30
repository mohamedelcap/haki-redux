"use node";

import Stripe from "stripe";
import { v } from "convex/values";
import { action } from "./_generated/server";
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

    const user: any = await ctx.runQuery(internal.paymentsInternal.getUserEmail, { userId });
    if (!user?.email) throw new Error("يجب أن يكون لحسابك بريد إلكتروني");

    const plan: any = await ctx.runQuery(internal.paymentsInternal.getPlan, { planId: args.planId });
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
    const plan: any = await ctx.runQuery(internal.paymentsInternal.getPlan, { planId: refPlan as never });
    const expiresAt =
      plan?.period === "yearly" ? now + 365 * 86400000 : now + 30 * 86400000;

    // Cancel previous active subscriptions of this user.
    const prev: any = await ctx.runQuery(internal.paymentsInternal.myActiveSubInternal, {
      userId,
    });
    if (prev) await ctx.runMutation(internal.paymentsInternal.setStatus, { id: prev._id, status: "cancelled" });

    await ctx.runMutation(internal.paymentsInternal.insertSub, {
      userId,
      planId: refPlan as never,
      startedAt: now,
      expiresAt,
    });
    return { ok: true };
  },
});

// Internal queries/mutations backing these actions live in paymentsInternal.ts
// (Convex only allows actions inside "use node" files).
