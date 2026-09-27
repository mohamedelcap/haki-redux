import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./lib";

/** Recent broadcast notifications (audit view for admins, paginated). */
export const listRecent = query({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_creation_time")
      .order("desc")
      .paginate({ numItems: 50, cursor: args.cursor ?? null });
  },
});

/**
 * Broadcast a notification to users.
 * target: "all" = every user, "subscribers" = active subscriptions only.
 * Returns the number of notifications created.
 */
export const broadcast = mutation({
  args: {
    title: v.string(),
    body: v.optional(v.string()),
    target: v.union(v.literal("all"), v.literal("subscribers")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let userIds: string[];
    if (args.target === "subscribers") {
      const subs = await ctx.db.query("subscriptions").collect();
      userIds = [
        ...new Set(
          subs
            .filter((s) => s.status === "active")
            .map((s) => s.userId as string),
        ),
      ];
    } else {
      const users = await ctx.db.query("users").collect();
      userIds = users.map((u) => u._id as string);
    }

    const now = Date.now();
    let created = 0;
    for (const userId of userIds) {
      await ctx.db.insert("notifications", {
        userId: userId as never,
        title: args.title,
        body: args.body,
        isRead: false,
        createdAt: now,
      });
      created += 1;
    }
    return { created };
  },
});
