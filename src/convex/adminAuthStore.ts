import { v } from "convex/values";
import { internalQuery, internalMutation, query } from "./_generated/server";

// Settings helpers used by the Node.js admin auth actions (they run these
// via ctx.runQuery/ctx.runMutation with internal references).

/** Public: has the official admin account been minted yet? */
export const adminStatus = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "admin_account_id"))
      .first();
    return { configured: row?.value != null };
  },
});

/** The user behind a password-provider account id (for role checks). */
export const accountUserInternal = internalQuery({
  args: { accountId: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", args.accountId),
      )
      .unique();
    if (!account) return null;
    const user = await ctx.db.get(account.userId);
    if (!user) return null;
    return { userId: user._id, role: user.role ?? null, name: user.name ?? null };
  },
});

export const getSettingInternal = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

export const setSettingInternal = internalMutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (row) {
      await ctx.db.patch(row._id, { value: args.value });
      return row._id;
    }
    return await ctx.db.insert("settings", { key: args.key, value: args.value });
  },
});
