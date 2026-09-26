import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { requireSuperAdmin } from "./lib";
const LOGO_URI = "/logo.png"; // official logo file (Assets section)

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
    const isBranded = (v?: string | null) =>
      !!v && (v.startsWith("http") || (v.startsWith("data:") && v.includes("F97316")));

    for (const c of await ctx.db.query("content").collect()) {
      if (isBranded(c.coverImage) && c.coverImage !== LOGO) {
        await ctx.db.patch(c._id, { coverImage: LOGO });
        covers++;
      }
    }
    for (const t of ["authors", "narrators"] as const) {
      for (const row of await ctx.db.query(t).collect()) {
        if (isBranded(row.image) && row.image !== LOGO) {
          await ctx.db.patch(row._id, { image: LOGO });
          avatars++;
        }
      }
    }
    for (const p of await ctx.db.query("publishers").collect()) {
      if (isBranded(p.logo) && p.logo !== LOGO) {
        await ctx.db.patch(p._id, { logo: LOGO });
        logos++;
      }
    }
    for (const ch of await ctx.db.query("challenges").collect()) {
      if (isBranded(ch.image) && ch.image !== LOGO) {
        await ctx.db.patch(ch._id, { image: LOGO });
        posters++;
      }
    }
    for (const ls of await ctx.db.query("live_streams").collect()) {
      if (isBranded(ls.image) && ls.image !== LOGO) {
        await ctx.db.patch(ls._id, { image: LOGO });
        posters++;
      }
    }
    return { ok: true, covers, avatars, publisherLogos: logos, posters };
  },
});

/**
 * TEMP: test-only helper used by CLI verification of the book importer.
 * Creates a job + one pending item for a given IA identifier.
 */
export const bookImporterTestInternal: any = internalMutation({
  args: { iaId: v.string(), publishMode: v.optional(v.string()) },
  handler: async (ctx: any, args: any) => {
    const now = Date.now();
    const jobId = await ctx.db.insert("import_jobs", {
      source: "internet_archive",
      mode: "single",
      input: "cli-test",
      status: "processing",
      total: 1,
      processed: 0,
      succeeded: 0,
      failed: 0,
      publishMode: args.publishMode ?? "auto",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("import_items", {
      jobId,
      source: "internet_archive",
      externalId: args.iaId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { jobId };
  },
});

/** TEMP: read import items of a job for CLI verification. */
export const bookImporterReadItemInternal: any = internalMutation({
  args: { jobId: v.id("import_jobs") },
  handler: async (ctx: any, args: any) => {
    const rows = await ctx.db
      .query("import_items")
      .withIndex("by_job", (q: any) => q.eq("jobId", args.jobId))
      .collect();
    const out = rows.map((r: any) => ({
      externalId: r.externalId,
      status: r.status,
      title: r.title,
      author: r.author,
      year: r.year,
      language: r.language,
      rightsStatus: r.rightsStatus,
      formats: r.formats,
      coverStored: (r.coverUrl ?? "").includes("cloud.convex") ? "stored" : (r.coverUrl ?? "").slice(0, 50),
      error: r.error,
    }));
    // cleanup job + items to keep the db clean after the test
    for (const r of rows) await ctx.db.delete(r._id);
    await ctx.db.delete(args.jobId);
    return out;
  },
});
