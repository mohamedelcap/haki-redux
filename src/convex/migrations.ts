import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { requireSuperAdmin } from "./lib";
import { LOGO_COVER as LOGO_URI } from "../lib/logoAsset";

const GOALS: Record<
  string,
  { goalType: "listen_minutes" | "finished_works" | "rated_items"; goalTarget: number }
> = {
  "تحدي الـ 30 يوم": { goalType: "listen_minutes", goalTarget: 600 },
  "ماراثون البودكاست": { goalType: "listen_minutes", goalTarget: 300 },
  "أسبوع الرواية العربية": { goalType: "finished_works", goalTarget: 1 },
  "نادي الكتاب الإلكتروني": { goalType: "rated_items", goalTarget: 5 },
};

/**
 * One-time data migration: backfill goalType/goalTarget on existing challenge
 * rows (seeded before the goals feature existed). Super-admin only.
 */
export const setChallengeGoals = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const rows = await ctx.db.query("challenges").collect();
    let updated = 0;
    for (const ch of rows) {
      const goal = GOALS[ch.name];
      if (goal && (ch.goalType === undefined || ch.goalTarget === undefined)) {
        await ctx.db.patch(ch._id, goal);
        updated += 1;
      }
    }
    return { ok: true, updated };
  },
});

/** Internal variant: deploy-privileged (runnable via `convex run` CLI). */
export const setChallengeGoalsInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("challenges").collect();
    let updated = 0;
    for (const ch of rows) {
      const goal = GOALS[ch.name];
      if (goal && (ch.goalType === undefined || ch.goalTarget === undefined)) {
        await ctx.db.patch(ch._id, goal);
        updated += 1;
      }
    }
    return { ok: true, updated };
  },
});

/**
 * Replace every stock/external image (covers, avatars, logos, posters) with
 * the official HAKI logo data-URI. Deploy-privileged (CLI only).
 */
export const rebrandImagesInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const LOGO = LOGO_URI;
    let covers = 0, avatars = 0, logos = 0, posters = 0;

    for (const c of await ctx.db.query("content").collect()) {
      if (c.coverImage && c.coverImage.startsWith("http")) {
        await ctx.db.patch(c._id, { coverImage: LOGO });
        covers++;
      }
    }
    for (const t of ["authors", "narrators"] as const) {
      for (const row of await ctx.db.query(t).collect()) {
        if (row.image && row.image.startsWith("http")) {
          await ctx.db.patch(row._id, { image: LOGO });
          avatars++;
        }
      }
    }
    for (const p of await ctx.db.query("publishers").collect()) {
      if (p.logo && p.logo.startsWith("http")) {
        await ctx.db.patch(p._id, { logo: LOGO });
        logos++;
      }
    }
    for (const ch of await ctx.db.query("challenges").collect()) {
      if (ch.image && ch.image.startsWith("http")) {
        await ctx.db.patch(ch._id, { image: LOGO });
        posters++;
      }
    }
    for (const ls of await ctx.db.query("live_streams").collect()) {
      if (ls.image && ls.image.startsWith("http")) {
        await ctx.db.patch(ls._id, { image: LOGO });
        posters++;
      }
    }
    return { ok: true, covers, avatars, publisherLogos: logos, posters };
  },
});
