import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * GitHub report log storage (github_reports table). Kept in a standard V8
 * module because "use node" modules can only define actions — the GitHub
 * actions in github.ts call these via internal.githubReports.*.
 */

export const insertReportInternal = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    reporterName: v.optional(v.string()),
    reporterEmail: v.optional(v.string()),
    title: v.string(),
    body: v.optional(v.string()),
    /** created (on GitHub) | failed (API error) | local (no token/repo yet) */
    status: v.string(),
    /** page that produced the report: admin_test | content_report */
    origin: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
    issueNumber: v.optional(v.number()),
    issueUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("github_reports", args);
  },
});

export const recentReportsForUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("github_reports")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export type ReportRow = {
  _id: Id<"github_reports">;
  title: string;
  status: string;
  reporterName?: string;
  reporterEmail?: string;
  origin?: string;
  issueNumber?: number;
  issueUrl?: string;
  errorMessage?: string;
  createdAt: number;
};

export const recentReportsPageInternal = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args): Promise<ReportRow[]> => {
    const rows = await ctx.db
      .query("github_reports")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit);
    return rows.map((r) => ({
      _id: r._id,
      title: r.title,
      status: r.status,
      reporterName: r.reporterName,
      reporterEmail: r.reporterEmail,
      origin: r.origin,
      issueNumber: r.issueNumber,
      issueUrl: r.issueUrl,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt,
    }));
  },
});

export const reportStatsInternal = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ total: number; last24h: number; openIssues: number; failed: number }> => {
    const rows = await ctx.db.query("github_reports").collect();
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return {
      total: rows.length,
      last24h: rows.filter((r) => r.createdAt >= since).length,
      openIssues: rows.filter((r) => r.status === "created").length,
      failed: rows.filter((r) => r.status !== "created").length,
    };
  },
});

/** Public (transparency page): recent reports that made it to GitHub. */
export const publicRecentIssues = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 12, 50);
    const rows = await ctx.db
      .query("github_reports")
      .withIndex("by_created")
      .order("desc")
      .collect();
    return rows
      .filter(
        (r) =>
          r.status === "created" &&
          r.issueNumber !== undefined &&
          r.issueUrl !== undefined,
      )
      .slice(0, limit)
      .map((r) => ({
        title: r.title,
        issueNumber: r.issueNumber as number,
        issueUrl: r.issueUrl as string,
        createdAt: r.createdAt,
        labels: r.labels ?? [],
      }));
  },
});
