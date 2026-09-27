import { v } from "convex/values";
import { query, mutation, type QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  challengeProgressForUser,
  syncChallengeParticipation,
} from "./lib";

// ---------------- Challenges ----------------

export type ChallengeWithStats = {
  _id: string;
  name: string;
  nameEn?: string;
  description: string;
  image?: string;
  startDate: string;
  endDate: string;
  participants: number;
  reward?: string;
  status: "upcoming" | "active" | "ended";
  isActive: boolean;
  goalType?: "listen_minutes" | "finished_works" | "rated_items";
  goalTarget?: number;
  topUsers: { userId: string; name: string; image?: string; progress: number }[];
};

export function statusFor(startDate: string, endDate: string, now: Date = new Date()): "upcoming" | "active" | "ended" {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  if (start > now) return "upcoming";
  if (end < now) return "ended";
  return "active";
}

/**
 * Pure challenge-progress math: clamps the target to >= 1 and returns
 * completion. The value itself is measured from listening history.
 */
export function computeChallengeProgress(
  progressValue: number,
  goalTarget?: number | null,
): { progress: number; target: number; completed: boolean } {
  const target = Math.max(1, Math.round(goalTarget ?? 1));
  const progress = Math.max(0, Math.round(progressValue));
  return { progress, target, completed: progress >= target };
}

/**
 * Top 3 participants of a challenge, ordered by completion time then join time.
 * Real user names/images; seeded/demo rows have no matching user and are skipped.
 */
async function topParticipants(ctx: QueryCtx, challengeId: string) {
  const parts = await ctx.db
    .query("challenge_participants")
    .withIndex("by_challenge", (q) => q.eq("challengeId", challengeId as never))
    .collect();
  const done = parts.filter((p) => p.completedAt);
  done.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
  const rest = parts.filter((p) => !p.completedAt);
  rest.sort((a, b) => a.joinedAt - b.joinedAt);
  const ordered = [...done, ...rest].slice(0, 3);
  const out: { userId: string; name: string; image?: string; progress: number }[] = [];
  for (const p of ordered) {
    const user = await ctx.db.get(p.userId);
    if (!user) continue;
    out.push({
      userId: p.userId,
      name: user.name ?? (user.email ? user.email.split("@")[0] : "مستخدم"),
      image: user.image,
      progress: p.completedAt ? 100 : 0,
    });
  }
  return out;
}

/** All visible challenges, enriched with my participation + live status. */
export const listChallenges = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db.query("challenges").collect();

    const mine = userId
      ? await ctx.db
          .query("challenge_participants")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      : [];
    const mineByChallenge = new Map(mine.map((m) => [m.challengeId, m]));

    const result = await Promise.all(
      rows.map(async (ch) => {
        const status = statusFor(ch.startDate, ch.endDate);
        const participation = userId ? mineByChallenge.get(ch._id) : undefined;
        const progress = participation
          ? await challengeProgressForUser(ctx, ch, participation.userId)
          : null;
        const topUsers = await topParticipants(ctx, ch._id);
        return {
          ...ch,
          status,
          joined: !!participation,
          completedAt: participation?.completedAt ?? null,
          progress: progress?.progress ?? 0,
          goalTarget: ch.goalTarget ?? null,
          topUsers,
        };
      }),
    );
    result.sort((a, b) => {
      const rank = { active: 0, upcoming: 1, ended: 2 } as const;
      return rank[a.status] - rank[b.status];
    });
    return result;
  },
});

/** Challenges the current user joined, with live progress. */
export const myChallenges = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const mine = await ctx.db
      .query("challenge_participants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    mine.sort((a, b) => b.joinedAt - a.joinedAt);
    return await Promise.all(
      mine.map(async (m) => {
        const ch = await ctx.db.get(m.challengeId);
        if (!ch) return null;
        const progress = await challengeProgressForUser(ctx, ch, m.userId);
        return {
          _id: m._id,
          challengeId: ch._id,
          name: ch.name,
          nameEn: ch.nameEn,
          image: ch.image,
          startDate: ch.startDate,
          endDate: ch.endDate,
          reward: ch.reward,
          status: statusFor(ch.startDate, ch.endDate),
          completedAt: m.completedAt ?? null,
          goalType: ch.goalType ?? "listen_minutes",
          goalTarget: ch.goalTarget ?? 1,
          ...progress,
        };
      }),
    ).then((rows) => rows.filter(Boolean));
  },
});

/** One challenge: details, my participation/progress, and leaderboard (top 20). */
export const challengeDetails = query({
  args: { id: v.id("challenges") },
  handler: async (ctx, args) => {
    const ch = await ctx.db.get(args.id);
    if (!ch) return null;
    const userId = await getAuthUserId(ctx);
    const parts = await ctx.db
      .query("challenge_participants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.id))
      .collect();

    const mine = userId ? parts.find((p) => p.userId === userId) : undefined;
    const myProgress = mine
      ? await challengeProgressForUser(ctx, ch, mine.userId)
      : null;

    const leaderboard = await Promise.all(
      parts.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        const progress = await challengeProgressForUser(ctx, ch, p.userId);
        return {
          userId: p.userId,
          name:
            user?.name ??
            (user?.email ? user.email.split("@")[0] : "مستخدم مجهول"),
          image: user?.image,
          joinedAt: p.joinedAt,
          completedAt: p.completedAt ?? null,
          progress: progress.progress,
          completed: progress.completed,
        };
      }),
    );
    leaderboard.sort((a, b) => {
      if (a.completedAt && b.completedAt) return a.completedAt - b.completedAt;
      if (a.completedAt) return -1;
      if (b.completedAt) return 1;
      return b.progress - a.progress;
    });

    return {
      ...ch,
      status: statusFor(ch.startDate, ch.endDate),
      joined: !!mine,
      completedAt: mine?.completedAt ?? null,
      myProgress: myProgress?.progress ?? 0,
      goalType: ch.goalType ?? "listen_minutes",
      goalTarget: ch.goalTarget ?? 1,
      leaderboard: leaderboard.slice(0, 20),
    };
  },
});

/** Join a challenge (idempotent). */
export const joinChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("يجب تسجيل الدخول للمشاركة");
    const existing = await ctx.db
      .query("challenge_participants")
      .withIndex("by_user_challenge", (q) =>
        q.eq("userId", userId).eq("challengeId", args.challengeId),
      )
      .first();
    if (existing) return { ok: true, alreadyJoined: true };
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
    return { ok: true, alreadyJoined: false };
  },
});

/** Leave a challenge (participants counter is decremented only for real rows). */
export const leaveChallenge = mutation({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("غير مصرح");
    const existing = await ctx.db
      .query("challenge_participants")
      .withIndex("by_user_challenge", (q) =>
        q.eq("userId", userId).eq("challengeId", args.challengeId),
      )
      .first();
    if (!existing) return { ok: true };
    await ctx.db.delete(existing._id);
    const challenge = await ctx.db.get(args.challengeId);
    if (challenge && challenge.participants > 0) {
      await ctx.db.patch(args.challengeId, {
        participants: challenge.participants - 1,
      });
    }
    return { ok: true };
  },
});

/**
 * Recompute progress of my joined challenges, persist completion and fire
 * completion notifications. Called from the client after listening sessions.
 */
export const syncMyChallengeProgress = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const mine = await ctx.db
      .query("challenge_participants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const out: { challengeId: string; progress: number; target: number; completed: boolean }[] = [];
    for (const m of mine) {
      const ch = await ctx.db.get(m.challengeId);
      if (!ch) continue;
      const res = await syncChallengeParticipation(ctx, ch, m);
      out.push({ challengeId: ch._id, ...res });
    }
    return out;
  },
});

/** Public leaderboard for one challenge (top 20, progress-sorted). */
export const listLeaderboard = query({
  args: { challengeId: v.id("challenges") },
  handler: async (ctx, args) => {
    const ch = await ctx.db.get(args.challengeId);
    if (!ch) return [];
    const parts = await ctx.db
      .query("challenge_participants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();
    const rows = await Promise.all(
      parts.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        const progress = await challengeProgressForUser(ctx, ch, p.userId);
        return {
          userId: p.userId,
          name:
            user?.name ??
            (user?.email ? user.email.split("@")[0] : "مستخدم مجهول"),
          image: user?.image,
          completedAt: p.completedAt ?? null,
          progress: progress.progress,
          completed: progress.completed,
        };
      }),
    );
    rows.sort((a, b) => {
      if (a.completedAt && b.completedAt) return a.completedAt - b.completedAt;
      if (a.completedAt) return -1;
      if (b.completedAt) return 1;
      return b.progress - a.progress;
    });
    return rows.slice(0, 20);
  },
});

// ---------------- Live streams (existing) ----------------

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
