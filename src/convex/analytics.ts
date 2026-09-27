import { query } from "./_generated/server";
import { requireAdmin } from "./lib";

const DAY = 86_400_000;

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyBuckets(): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 29; i >= 0; i--) m.set(dayKey(Date.now() - i * DAY), 0);
  return m;
}

/** Daily listening minutes for the last 30 days from listening_history (by_playedAt index). */
export const dailyListening = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const since = Date.now() - 30 * DAY;
    const history = await ctx.db
      .query("listening_history")
      .withIndex("by_playedAt", (q) => q.gte("playedAt", since))
      .collect();
    const buckets = emptyBuckets();
    for (const h of history) {
      const k = dayKey(h.playedAt);
      if (!buckets.has(k)) continue;
      const listened = Math.max(0, Math.min(h.duration || h.position, h.position));
      buckets.set(k, (buckets.get(k) ?? 0) + listened / 60);
    }
    return Array.from(buckets.entries()).map(([date, minutes]) => ({
      date,
      minutes: Math.round(minutes),
    }));
  },
});

/** New users per day (last 30 days) via document creation time. */
export const userGrowth = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const buckets = emptyBuckets();
    let total = 0;
    for (const u of users) {
      total++;
      if (u._creationTime < Date.now() - 30 * DAY) continue;
      const k = dayKey(u._creationTime);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    return {
      total,
      series: Array.from(buckets.entries()).map(([date, count]) => ({ date, count })),
    };
  },
});

/** Top content by playCount. */
export const topContent = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const all = await ctx.db.query("content").collect();
    return all
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10)
      .map((c) => ({
        _id: c._id,
        title: c.title,
        contentType: c.contentType,
        playCount: c.playCount,
      }));
  },
});

/** Content-type distribution (published only). */
export const typeDistribution = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const published = await ctx.db
      .query("content")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    const counts = new Map<string, number>();
    for (const c of published) {
      counts.set(c.contentType, (counts.get(c.contentType) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
  },
});

/** Subscription KPIs: active count, MRR from plans, recent approved manual payments. */
export const revenue = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const subs = await ctx.db.query("subscriptions").collect();
    const plans = await ctx.db.query("subscription_plans").collect();
    const planPrice = new Map(plans.map((p) => [p._id, p.price]));

    let mrr = 0;
    let activeCount = 0;
    for (const s of subs) {
      if (s.status !== "active") continue;
      activeCount++;
      mrr += planPrice.get(s.planId) ?? 0;
    }

    const payments = await ctx.db.query("manual_payments").collect();
    const since = Date.now() - 30 * DAY;
    let recentApproved = 0;
    for (const p of payments) {
      if (p.status === "approved" && (p.reviewedAt ?? p.createdAt) >= since) recentApproved++;
    }

    return { mrr: Math.round(mrr), activeCount, recentApprovedPayments: recentApproved };
  },
});
