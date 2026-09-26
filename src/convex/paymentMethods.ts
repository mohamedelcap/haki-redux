import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./lib";

export type PaymentMethodsMap = {
  stripe: boolean;
  bankTransfer: boolean;
  cod: boolean;
};

const KEY = "payment_methods";

const DEFAULTS: PaymentMethodsMap = {
  stripe: true,
  bankTransfer: false,
  cod: false,
};

/** Public: which payment methods are enabled (used at checkout). */
export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .first();
    if (!row) return DEFAULTS;
    try {
      return { ...DEFAULTS, ...JSON.parse(row.value) };
    } catch {
      return DEFAULTS;
    }
  },
});

/** Admin: read raw config. */
export const getAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .first();
    if (!row) return DEFAULTS;
    try {
      return { ...DEFAULTS, ...JSON.parse(row.value) };
    } catch {
      return DEFAULTS;
    }
  },
});

/** Admin: toggle payment methods on/off. */
export const setMethods = mutation({
  args: {
    stripe: v.boolean(),
    bankTransfer: v.boolean(),
    cod: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const value = JSON.stringify({
      stripe: args.stripe,
      bankTransfer: args.bankTransfer,
      cod: args.cod,
    });
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", KEY))
      .first();
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("settings", { key: KEY, value });
    return { ok: true };
  },
});
