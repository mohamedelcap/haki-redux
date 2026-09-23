import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---------------- Challenges ----------------

export const listChallenges = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("challenges").collect();
    rows.sort((a, b) => (a.status === "active" ? -1 : 1));
    return rows;
  },
});

export const listLiveStreams = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("live_streams").collect();
    rows.sort((a, b) => Number(b.isLive) - Number(a.isLive));
    return rows;
  },
});

export const getCurrentLive = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("live_streams").collect();
    return rows.find((r) => r.isLive) ?? null;
  },
});

export const joinChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول للمشاركة");
    const all = await ctx.db
      .query("challenge_participants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    if (all.some((p) => p.userId === userId)) {
      throw new Error("أنت منضم لهذا التحدي بالفعل");
    }
    await ctx.db.insert("challenge_participants", {
      challengeId: args.challengeId,
      userId,
      joinedAt: Date.now(),
    });
    const challenge = await ctx.db.get(args.challengeId);
    if (challenge) {
      await ctx.db.patch(args.challengeId, {
        participants: challenge.participants + 1,
      });
    }
    return { ok: true };
  },
});
