import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib";

/**
 * Public by design — errors can happen before/without auth. Payloads are
 * aggressively truncated and the client throttles itself (src/lib/telemetry.ts).
 */
export const recordClientError = mutation({
  args: {
    message: v.string(),
    stack: v.optional(v.string()),
    source: v.optional(v.string()),
    url: v.optional(v.string()),
    componentStack: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("client_errors", {
      message: args.message.slice(0, 500),
      stack: args.stack?.slice(0, 4000),
      source: args.source?.slice(0, 40),
      url: args.url?.slice(0, 300),
      componentStack: args.componentStack?.slice(0, 4000),
      createdAt: Date.now(),
    });
  },
});

/** Admin: errors from the last 24h + the 5 most recent for the dashboard. */
export const recentErrors = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const since = Date.now() - 24 * 3600_000;
    // NOTE: convex 1.46 has no .count(); bound the scan with take().
    const rows = await ctx.db
      .query("client_errors")
      .withIndex("by_created", (q) => q.gte("createdAt", since))
      .order("desc")
      .take(500);
    return { last24h: rows.length, recent: rows.slice(0, 5) };
  },
});
