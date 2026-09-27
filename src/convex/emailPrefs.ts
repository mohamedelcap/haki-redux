import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib";

/**
 * Per-user email notification preferences.
 * Stored as JSON in the settings table under "email_prefs:<userId>".
 */

type Pref = { welcome: boolean; receipt: boolean; episode: boolean };

function keyFor(userId: string) {
  return `email_prefs:${userId}`;
}

function parsePref(raw: string | undefined): Pref | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      welcome: !!p.welcome,
      receipt: !!p.receipt,
      episode: !!p.episode,
    };
  } catch {
    return null;
  }
}

/** My email preferences (null when never set — UI treats defaults as all-on). */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user?.email) return null;
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", keyFor(user._id)))
      .first();
    const parsed = parsePref(row?.value);
    return {
      email: user.email,
      pref: parsed ?? { welcome: true, receipt: true, episode: true },
      initialized: !!parsed,
    };
  },
});

/** Lookup by email (used by the email action to honor opt-outs). */
export const getForEmail = query({
  args: { email: v.string(), fallback: v.boolean() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email.trim().toLowerCase()))
      .first();
    if (!user) return null;
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", keyFor(user._id)))
      .first();
    const parsed = parsePref(row?.value);
    if (!parsed) return args.fallback ? { welcome: true, receipt: true, episode: true } : null;
    return parsed;
  },
});

/** Set my preferences. */
export const setMine = mutation({
  args: { welcome: v.boolean(), receipt: v.boolean(), episode: v.boolean() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("غير مصرح");
    const key = keyFor(user._id);
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    const value = JSON.stringify(args);
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("settings", { key, value });
    return { ok: true };
  },
});
