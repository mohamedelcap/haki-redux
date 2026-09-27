import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireAdmin, getCurrentUser } from "./lib";
import { internal, api } from "./_generated/api";

/**
 * Manual payment flow for Arabic payment rails without a gateway API:
 * user registers a payment intent (Fawry / STC Pay / Vodafone Cash / bank
 * transfer), an admin reviews the reference and approves → subscription.
 */

/** User: register a payment intent ("awaiting confirmation"). */
export const registerIntent = mutation({
  args: {
    planId: v.id("subscription_plans"),
    method: v.string(),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("سجّل الدخول أولًا");

    const plan = await ctx.db.get(args.planId);
    if (!plan || !plan.isActive) throw new Error("هذه الباقة غير متاحة");

    // Prevent spam: reject if the user already has a pending request.
    const existing = await ctx.db
      .query("manual_payments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (existing.some((e) => e.status === "pending")) {
      throw new Error("لديك طلب دفع قيد المراجعة بالفعل");
    }

    const now = Date.now();
    return await ctx.db.insert("manual_payments", {
      userId: user._id,
      planId: args.planId,
      method: args.method,
      status: "pending",
      reference: args.reference?.slice(0, 200),
      amount: plan.price,
      currency: plan.currency,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Admin: pending requests with user + plan names. */
export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("manual_payments")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const out = [];
    for (const r of rows) {
      const [user, plan] = await Promise.all([ctx.db.get(r.userId), ctx.db.get(r.planId)]);
      out.push({
        ...r,
        userName: (user as any)?.name ?? (user as any)?.email ?? "—",
        planName: (plan as any)?.name ?? "—",
      });
    }
    return out;
  },
});

/** Admin: full history. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("manual_payments").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.slice(0, 100);
  },
});

/** Admin: approve → activate the subscription (idempotent). */
export const approve = mutation({
  args: { id: v.id("manual_payments") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) throw new Error("الطلب غير موجود");
    if (req.status !== "pending") throw new Error("تمت مراجعة هذا الطلب مسبقًا");

    const now = Date.now();
    const plan = await ctx.db.get(req.planId);
    const expiresAt =
      (plan as any)?.period === "yearly" ? now + 365 * 86400000 : now + 30 * 86400000;

    // Cancel previous active subscriptions of this user.
    const prev = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", req.userId))
      .order("desc")
      .first();
    if (prev && (prev as any).status === "active") {
      await ctx.db.patch(prev._id, { status: "cancelled" });
    }

    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId: req.userId,
      planId: req.planId,
      status: "active",
      startedAt: now,
      expiresAt,
    });

    await ctx.db.patch(args.id, {
      status: "approved",
      reviewedBy: admin._id,
      reviewedAt: now,
      subscriptionId,
      updatedAt: now,
    });

    // Notify the user their subscription is live.
    const planRow: any = plan;
    await ctx.db.insert("notifications", {
      userId: req.userId,
      title: "تم تفعيل اشتراكك 🎉",
      body: `اشتراك «${planRow?.name ?? ""}» مُفعّل الآن — استمتع بكل المحتوى المميز.`,
      isRead: false,
      createdAt: now,
    });
    // Confirmation email (no-op without RESEND_API_KEY).
    try {
      await ctx.scheduler.runAfter(0, api.email.sendToUser, {
        kind: "manual_payment_approved" as const,
        userId: req.userId,
        planName: planRow?.name,
      });
    } catch {
      /* best-effort */
    }

    return { ok: true, subscriptionId };
  },
});

/** Admin: reject with a reason. */
export const reject = mutation({
  args: { id: v.id("manual_payments"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const req = await ctx.db.get(args.id);
    if (!req) throw new Error("الطلب غير موجود");
    if (req.status !== "pending") throw new Error("تمت مراجعة هذا الطلب مسبقًا");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "rejected",
      reviewedBy: admin._id,
      reviewedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("notifications", {
      userId: req.userId,
      title: "لم يُعتمد طلب الدفع",
      body: args.reason?.slice(0, 300) ?? "لم نتمكن من تأكيد الدفع — تواصل مع الدعم لإعادة المحاولة.",
      isRead: false,
      createdAt: now,
    });
    return { ok: true };
  },
});

/** My own payment requests (for the subscriptions page status). */
export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("manual_payments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.slice(0, 10);
  },
});

// ---------------- Stripe webhook persistence (internal) ----------------

/**
 * Idempotent activation by Stripe session id: the webhook calls this.
 * Also used to mark subscriptions cancelled server-side.
 */
export const webhookActivateInternal = internalMutation({
  args: {
    sessionId: v.string(),
    userId: v.id("users"),
    planId: v.id("subscription_plans"),
  },
  handler: async (ctx, args) => {
    // Idempotency: skip if this session already created a record.
    const dup = await ctx.db
      .query("manual_payments")
      .filter((q) => q.eq(q.field("stripeSessionId"), args.sessionId))
      .first();
    if (dup && dup.status === "approved") return { ok: true, duplicate: true };

    const now = Date.now();
    const plan = await ctx.db.get(args.planId);
    const expiresAt =
      (plan as any)?.period === "yearly" ? now + 365 * 86400000 : now + 30 * 86400000;

    const prev = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    if (prev && (prev as any).status === "active") {
      await ctx.db.patch(prev._id, { status: "cancelled" });
    }

    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId: args.userId,
      planId: args.planId,
      status: "active",
      startedAt: now,
      expiresAt,
    });

    if (dup) {
      await ctx.db.patch(dup._id, {
        status: "approved",
        subscriptionId,
        reviewedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("manual_payments", {
        userId: args.userId,
        planId: args.planId,
        method: "stripe",
        status: "approved",
        amount: (plan as any)?.price ?? 0,
        currency: (plan as any)?.currency ?? "usd",
        stripeSessionId: args.sessionId,
        subscriptionId,
        reviewedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { ok: true, subscriptionId };
  },
});

/** Webhook: cancel a user's active subscription (subscription.deleted). */
export const webhookCancelInternal = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const prev = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();
    if (prev && (prev as any).status === "active") {
      await ctx.db.patch(prev._id, { status: "cancelled" });
    }
    return { ok: true };
  },
});
