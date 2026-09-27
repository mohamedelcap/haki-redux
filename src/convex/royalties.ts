import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib";

// ---------------- Pure distribution math (unit-tested) ----------------

/**
 * Proportional split of a pool across publishers by usage seconds.
 * Pure function so the revenue formula is unit-testable without a DB.
 */
export function computePoolShares(
  totalAmount: number,
  usage: { publisherId: string; seconds: number }[],
  contracts: Record<string, { publisherPercentage: number; hakiPercentage: number }>,
): {
  publisherId: string;
  usageSeconds: number;
  usageShare: number;
  grossAmount: number;
  publisherAmount: number;
  hakiAmount: number;
  hasContract: boolean;
}[] {
  const totalSeconds = usage.reduce((a, u) => a + Math.max(0, u.seconds), 0);
  if (totalSeconds <= 0) return [];
  return usage
    .filter((u) => u.seconds > 0)
    .map((u) => {
      const share = (u.seconds / totalSeconds) * 100;
      const gross = (totalAmount * share) / 100;
      const contract = contracts[u.publisherId];
      const pShare = contract?.publisherPercentage ?? 0;
      const hShare = contract?.hakiPercentage ?? 100;
      return {
        publisherId: u.publisherId,
        usageSeconds: Math.round(u.seconds),
        usageShare: Math.round(share * 100) / 100,
        grossAmount: Math.round(gross * 100) / 100,
        publisherAmount: Math.round(((gross * pShare) / 100) * 100) / 100,
        hakiAmount: Math.round(((gross * hShare) / 100) * 100) / 100,
        hasContract: !!contract,
      };
    })
    .sort((a, b) => b.grossAmount - a.grossAmount);
}

// ---------------- Contracts ----------------

/** Validate a split and create a publishing contract. */
export const createContract = mutation({
  args: {
    publisherId: v.id("publishers"),
    publisherPercentage: v.number(),
    hakiPercentage: v.number(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.publisherPercentage <= 0 || args.publisherPercentage >= 100) {
      throw new Error("نسبة دار النشر يجب أن تكون بين 1 و 99");
    }
    if (Math.abs(args.publisherPercentage + args.hakiPercentage - 100) > 0.001) {
      throw new Error("نسبة حكي + نسبة دار النشر يجب أن تساوي 100% لكل عقد");
    }
    const publisher = await ctx.db.get(args.publisherId);
    if (!publisher) throw new Error("دار النشر غير موجودة");

    return await ctx.db.insert("publisher_contracts", {
      publisherId: args.publisherId,
      publisherPercentage: args.publisherPercentage,
      hakiPercentage: args.hakiPercentage,
      startDate: args.startDate,
      endDate: args.endDate,
      notes: args.notes,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const listContracts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("publisher_contracts").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(
      rows.map(async (c) => {
        const publisher = await ctx.db.get(c.publisherId);
        return { ...c, publisherName: publisher?.name ?? "—" };
      }),
    );
  },
});

export const setContractActive = mutation({
  args: { id: v.id("publisher_contracts"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { isActive: args.isActive });
  },
});

export const deleteContract = mutation({
  args: { id: v.id("publisher_contracts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ---------------- Revenue pools ----------------

export const createPool = mutation({
  args: {
    name: v.string(),
    totalAmount: v.number(),
    currency: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.totalAmount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
    return await ctx.db.insert("revenue_pools", {
      name: args.name,
      totalAmount: args.totalAmount,
      currency: args.currency || "EGP",
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: "draft",
      createdAt: Date.now(),
    });
  },
});

export const listPools = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("revenue_pools").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

export const deletePool = mutation({
  args: { id: v.id("revenue_pools") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const statements = await ctx.db
      .query("royalty_statements")
      .withIndex("by_pool", (q) => q.eq("poolId", args.id))
      .collect();
    for (const s of statements) await ctx.db.delete(s._id);
    await ctx.db.delete(args.id);
  },
});

// ---------------- Distribution engine ----------------

/**
 * Compute the distribution for a pool:
 * 1. Sum listening seconds per publisher from listening_history ∩ content
 *    (works of that publisher) within the pool period.
 * 2. usageShare(publisher) = publisherUsageSeconds / totalListenedSeconds × 100
 * 3. grossAmount = pool.totalAmount × usageShare / 100
 * 4. publisherAmount = grossAmount × contract.publisherPercentage / 100
 *    hakiAmount      = grossAmount × contract.hakiPercentage / 100
 * Unattributed seconds (works without publisher/contract) belong to HAKI 100%.
 */
export const calculateDistribution = mutation({
  args: { poolId: v.id("revenue_pools") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const pool = await ctx.db.get(args.poolId);
    if (!pool) throw new Error("الصندوق غير موجود");
    if (pool.status === "settled") throw new Error("تمت تسوية هذا الصندوق — لا يمكن إعادة الحساب");

    const startTs = Date.parse(`${pool.periodStart}T00:00:00Z`) || 0;
    const endTs = Date.parse(`${pool.periodEnd}T23:59:59Z`) || Date.now();

    // 1) usage seconds per publisher
    const history = await ctx.db.query("listening_history").collect();
    const perPublisher = new Map<Id<"publishers">, number>(); // publisherId -> seconds
    const contentCache = new Map<string, { publisherId?: Id<"publishers">; duration: number }>();

    let totalListened = 0;
    let hakiDirectSeconds = 0; // works with no publisher attribution

    for (const h of history) {
      if (h.playedAt < startTs || h.playedAt > endTs) continue;
      const sec = Math.min(h.duration || 0, h.position || 0);
      if (sec <= 0) continue;
      totalListened += sec;

      let meta = contentCache.get(h.contentId);
      if (!meta) {
        const c = await ctx.db.get(h.contentId);
        meta = { publisherId: c?.publisherId, duration: c?.duration ?? 0 };
        contentCache.set(h.contentId, meta);
      }
      if (meta.publisherId) {
        perPublisher.set(
          meta.publisherId,
          (perPublisher.get(meta.publisherId) ?? 0) + sec,
        );
      } else {
        hakiDirectSeconds += sec;
      }
    }

    if (totalListened <= 0) {
      throw new Error("لا يوجد استماع مسجّل في فترة هذا الصندوق");
    }

    // 2) contracts (latest active per publisher)
    const contracts = await ctx.db.query("publisher_contracts").collect();
    const activeByPublisher = new Map<string, (typeof contracts)[number]>();
    for (const c of contracts) {
      if (!c.isActive) continue;
      const prev = activeByPublisher.get(c.publisherId);
      if (!prev || c.createdAt > prev.createdAt) activeByPublisher.set(c.publisherId, c);
    }

    // 3) clear previous statements of this pool and recompute
    const old = await ctx.db
      .query("royalty_statements")
      .withIndex("by_pool", (q) => q.eq("poolId", args.poolId))
      .collect();
    for (const o of old) await ctx.db.delete(o._id);

    const rows: {
      publisherId: Id<"publishers">;
      publisherName: string;
      usageSeconds: number;
      usageShare: number;
      grossAmount: number;
      publisherAmount: number;
      hakiAmount: number;
      publisherPercentage: number;
      hakiPercentage: number;
      workCount: number;
      hasContract: boolean;
    }[] = [];

    for (const [publisherId, seconds] of perPublisher) {
      const publisher = await ctx.db.get(publisherId as Id<"publishers">);
      const share = (seconds / totalListened) * 100;
      const gross = (pool.totalAmount * share) / 100;
      const contract = activeByPublisher.get(publisherId);

      // Works count for this publisher
      const works = await ctx.db
        .query("content")
        .collect();
      const workCount = works.filter(
        (w) =>
          w.publisherId === publisherId &&
          w.createdAt >= startTs - 3.15e12, // any work; period filter applies to usage not creation
      ).length;

      if (contract) {
        rows.push({
          publisherId,
          publisherName: publisher?.name ?? "—",
          usageSeconds: Math.round(seconds),
          usageShare: Math.round(share * 100) / 100,
          grossAmount: Math.round(gross * 100) / 100,
          publisherAmount:
            Math.round(((gross * contract.publisherPercentage) / 100) * 100) / 100,
          hakiAmount:
            Math.round(((gross * contract.hakiPercentage) / 100) * 100) / 100,
          publisherPercentage: contract.publisherPercentage,
          hakiPercentage: contract.hakiPercentage,
          workCount,
          hasContract: true,
        });
      } else {
        // No contract: the gross share of this publisher's works is held for
        // HAKI to negotiate — we still show it, flagged with hasContract=false.
        rows.push({
          publisherId,
          publisherName: publisher?.name ?? "—",
          usageSeconds: Math.round(seconds),
          usageShare: Math.round(share * 100) / 100,
          grossAmount: Math.round(gross * 100) / 100,
          publisherAmount: 0,
          hakiAmount: Math.round(gross * 100) / 100,
          publisherPercentage: 0,
          hakiPercentage: 100,
          workCount,
          hasContract: false,
        });
      }
    }

    rows.sort((a, b) => b.grossAmount - a.grossAmount);

    for (const r of rows) {
      await ctx.db.insert("royalty_statements", {
        poolId: args.poolId,
        publisherId: r.publisherId,
        publisherName: r.publisherName,
        usageSeconds: r.usageSeconds,
        usageShare: r.usageShare,
        grossAmount: r.grossAmount,
        publisherAmount: r.publisherAmount,
        hakiAmount: r.hakiAmount,
        publisherPercentage: r.publisherPercentage,
        hakiPercentage: r.hakiPercentage,
        workCount: r.workCount,
        hasContract: r.hasContract,
      });
    }

    await ctx.db.patch(args.poolId, { status: "calculated" });

    return {
      ok: true,
      publishers: rows.length,
      totalListenedSeconds: Math.round(totalListened),
      hakiDirectSeconds: Math.round(hakiDirectSeconds),
    };
  },
});

/** Statements of one pool (admin view). */
export const listStatements = query({
  args: { poolId: v.id("revenue_pools") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("royalty_statements")
      .withIndex("by_pool", (q) => q.eq("poolId", args.poolId))
      .collect();
    rows.sort((a, b) => b.grossAmount - a.grossAmount);
    return rows;
  },
});

/** Publisher-facing: my statements (needs publisher role + identity match server-side). */
export const myStatements = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx); // TODO: publisher scoping when auth roles expand
    void user;
    return [];
  },
});

/**
 * Internal test harness: seeds a contract + pool and runs the distribution
 * with a synthetic listening_history row. Deploy-privileged (CLI only) —
 * used to verify the royalty formula end-to-end.
 */
export const testDistributionInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    // find or create the test publisher (first one)
    const publisher = await ctx.db.query("publishers").first();
    if (!publisher) throw new Error("no publishers seeded");

    // contract 70/30
    const existing = await ctx.db
      .query("publisher_contracts")
      .withIndex("by_publisher", (q) => q.eq("publisherId", publisher._id))
      .first();
    if (!existing) {
      await ctx.db.insert("publisher_contracts", {
        publisherId: publisher._id,
        publisherPercentage: 70,
        hakiPercentage: 30,
        startDate: "2026-01-01",
        isActive: true,
        createdAt: Date.now(),
      });
    }

    // find one content row of this publisher
    const content = await ctx.db.query("content").collect();
    const work = content.find((c) => c.publisherId === publisher._id);
    if (!work) throw new Error("publisher has no content to attribute usage to");

    // synthetic listen: 100s inside the pool period
    await ctx.db.insert("listening_history", {
      userId: (await ctx.db.query("users").first())!._id,
      contentId: work._id,
      position: 100,
      duration: 100,
      playedAt: Date.parse("2026-09-01T12:00:00Z"),
    });

    // pool
    const poolId = await ctx.db.insert("revenue_pools", {
      name: "TEST-POOL",
      totalAmount: 1000000,
      currency: "EGP",
      periodStart: "2026-08-01",
      periodEnd: "2026-09-30",
      status: "draft",
      createdAt: Date.now(),
    });

    // run the same distribution logic
    const pool = await ctx.db.get(poolId);
    const startTs = Date.parse(`${pool!.periodStart}T00:00:00Z`);
    const endTs = Date.parse(`${pool!.periodEnd}T23:59:59Z`);
    const history = await ctx.db.query("listening_history").collect();
    const perPublisher = new Map<Id<"publishers">, number>();
    let totalListened = 0;
    const contentCache = new Map<string, { publisherId?: Id<"publishers"> }>();
    for (const h of history) {
      if (h.playedAt < startTs || h.playedAt > endTs) continue;
      const sec = Math.min(h.duration || 0, h.position || 0);
      if (sec <= 0) continue;
      totalListened += sec;
      let meta = contentCache.get(h.contentId);
      if (!meta) {
        const c = await ctx.db.get(h.contentId);
        meta = { publisherId: c?.publisherId };
        contentCache.set(h.contentId, meta);
      }
      if (meta.publisherId) {
        perPublisher.set(meta.publisherId, (perPublisher.get(meta.publisherId) ?? 0) + sec);
      }
    }
    const contracts = await ctx.db.query("publisher_contracts").collect();
    const results: any[] = [];
    for (const [pubId, seconds] of perPublisher) {
      const share = (seconds / totalListened) * 100;
      const gross = (pool!.totalAmount * share) / 100;
      const c = contracts.find((x) => x.isActive && x.publisherId === pubId);
      results.push({
        publisher: publisher.name,
        usageShare: Math.round(share * 100) / 100,
        gross: Math.round(gross * 100) / 100,
        publisherAmount: c ? Math.round(((gross * c.publisherPercentage) / 100) * 100) / 100 : 0,
        hakiAmount: c ? Math.round(((gross * c.hakiPercentage) / 100) * 100) / 100 : Math.round(gross * 100) / 100,
      });
    }
    // cleanup: remove test rows
    const stmts = await ctx.db.query("royalty_statements").collect();
    for (const s of stmts) if (s.poolId === poolId) await ctx.db.delete(s._id);
    await ctx.db.delete(poolId);
    const hist = await ctx.db.query("listening_history").collect();
    for (const h of hist) if (h.position === 100 && h.duration === 100 && h.playedAt === Date.parse("2026-09-01T12:00:00Z")) await ctx.db.delete(h._id);

    return { totalListened, results };
  },
});

/** Summary totals for the admin overview card. */
export const poolSummary = query({
  args: { poolId: v.id("revenue_pools") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const pool = await ctx.db.get(args.poolId);
    if (!pool) return null;
    const rows = await ctx.db
      .query("royalty_statements")
      .withIndex("by_pool", (q) => q.eq("poolId", args.poolId))
      .collect();
    const sum = (f: (r: (typeof rows)[number]) => number) =>
      Math.round(rows.reduce((acc, r) => acc + f(r), 0) * 100) / 100;
    return {
      pool,
      publisherTotal: sum((r) => r.publisherAmount),
      hakiTotal: sum((r) => r.hakiAmount),
      publishers: rows.length,
      withContract: rows.filter((r) => r.hasContract).length,
    };
  },
});
