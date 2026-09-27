import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib";

/** Paginated audit trail, newest first. */
export const list = query({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("admin_audit")
      .withIndex("by_created")
      .order("desc")
      .paginate({ numItems: 50, cursor: args.cursor ?? null });
  },
});
