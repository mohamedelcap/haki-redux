"use node";

/**
 * GitHub integration (https://api.github.com).
 *
 * Env keys (set in the Keys tab / Convex dashboard):
 * - GITHUB_TOKEN — Personal Access Token used to create issues (scopes:
 *   classic "repo"/"public_repo", or fine-grained "Issues: read & write").
 * - GITHUB_REPO — optional fallback target repo in "owner/name" form.
 *   The admin dashboard can also store github_repo_owner/github_repo_name
 *   in the settings table, which take priority.
 *
 * Without GITHUB_TOKEN the app still compiles and read-only repo lookups
 * work (GitHub allows 60 unauthenticated requests/hour), but creating
 * issues fails with a clear Arabic error — same fallback-first rules as
 * email.ts.
 *
 * Every createIssue attempt is logged into the github_reports table BEFORE
 * calling GitHub (status: local/failed/created), so a missing or invalid
 * token never loses a user report. A per-user rolling 24h limit protects
 * the repo from abuse.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { ReportRow } from "./githubReports";
import { ConvexError } from "convex/values";

const API = "https://api.github.com";
const DEFAULT_LABEL = "haki-feedback";
const DAILY_REPORT_LIMIT = 5;

// ---------------- Auth + settings helpers ----------------

/**
 * Convex actions have no ctx.db, so viewer identity is resolved through an
 * internalQuery (same pattern as bookImporter.adminGate).
 */
async function getViewer(
  ctx: any,
): Promise<{ _id: string; role?: string; name?: string; email?: string } | null> {
  return await ctx.runQuery(internal.bookImporter.getViewerUserInternal, {});
}

async function requireAdminViewer(ctx: any) {
  const viewer = await getViewer(ctx);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "super_admin")) {
    throw new ConvexError("غير مصرح: هذه العملية تتطلب صلاحيات المدير");
  }
  return viewer;
}

/** Repo target stored in the settings table (takes priority over GITHUB_REPO). */
async function repoFromSettings(ctx: any): Promise<{ owner: string; name: string }> {
  const ownerRow: any = await ctx.runQuery(internal.adminAuthStore.getSettingInternal, {
    key: "github_repo_owner",
  });
  const nameRow: any = await ctx.runQuery(internal.adminAuthStore.getSettingInternal, {
    key: "github_repo_name",
  });
  return { owner: ownerRow ?? "", name: nameRow ?? "" };
}

/** Resolve the target repo: settings first, then GITHUB_REPO ("owner/name"). */
async function resolveRepo(ctx: any): Promise<{ owner: string; name: string }> {
  const fromSettings = await repoFromSettings(ctx);
  if (fromSettings.owner && fromSettings.name) return fromSettings;
  const envRepo = (process.env.GITHUB_REPO ?? "").trim();
  const [owner, name] = envRepo.split("/");
  if (owner && name) return { owner: owner.trim(), name: name.trim() };
  return { owner: "", name: "" };
}

function ghHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "haki-app",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function ghErrorMessage(status: number, action: "read" | "create"): string {
  if (status === 401 || status === 403) {
    return status === 403
      ? "رفض GitHub الطلب (403) — غالبًا توكن غير صالح أو تجاوزت حد الطلبات. تحقق من GITHUB_TOKEN."
      : "توكن GitHub غير صالح (401) — حدّث GITHUB_TOKEN في تبويب المفاتيح.";
  }
  if (status === 404) {
    return action === "create"
      ? "المستودع غير موجود أو التوكن لا يملك صلاحية الكتابة فيه (404)."
      : "المستودع غير موجود — تحقق من owner/repo.";
  }
  if (status === 410) return "قائمة الـ Issues معطّلة في هذا المستودع (410).";
  if (status === 422) return "GitHub رفض الطلب (422) — تأكد من عنوان المشكلة ونصها.";
  return `خطأ من GitHub (HTTP ${status}).`;
}

// ---------------- Report log helpers ----------------

/**
 * Per-user abuse protection: DAILY_REPORT_LIMIT logged attempts per rolling
 * 24h (counted from the log itself, including failed ones).
 */
async function enforceRateLimit(ctx: any, userId: string) {
  const rows: { createdAt: number }[] = await ctx.runQuery(
    internal.githubReports.recentReportsForUserInternal,
    { userId },
  );
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const used = rows.filter((r) => r.createdAt >= since).length;
  if (used >= DAILY_REPORT_LIMIT) {
    throw new ConvexError(
      `وصلت الحد اليومي للبلاغات (${DAILY_REPORT_LIMIT} بلاغات في 24 ساعة) — جرّب غدًا.`,
    );
  }
  return used;
}

// ---------------- Public / admin actions ----------------

/** Config snapshot for the admin panel. */
export const checkConfig = action({
  args: {},
  returns: v.object({ tokenSet: v.boolean(), repo: v.string() }),
  handler: async (ctx) => {
    await requireAdminViewer(ctx);
    const repo = await resolveRepo(ctx);
    return {
      tokenSet: !!process.env.GITHUB_TOKEN,
      repo: repo.owner && repo.name ? `${repo.owner}/${repo.name}` : "",
    };
  },
});

/** Read-only connection test: GET /repos/{owner}/{repo}. */
export const getRepo = action({
  args: { owner: v.string(), repo: v.string() },
  returns: v.object({
    ok: v.boolean(),
    status: v.number(),
    message: v.optional(v.string()),
    fullName: v.optional(v.string()),
    stars: v.optional(v.number()),
    openIssues: v.optional(v.number()),
    defaultBranch: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireAdminViewer(ctx);
    const owner = args.owner.trim();
    const repo = args.repo.trim();
    if (!owner || !repo) {
      return { ok: false, status: 0, message: "أدخل owner واسم المستودع أولًا." };
    }
    const res = await fetch(
      `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers: ghHeaders(process.env.GITHUB_TOKEN) },
    );
    if (!res.ok) {
      return { ok: false, status: res.status, message: ghErrorMessage(res.status, "read") };
    }
    const data: any = await res.json();
    return {
      ok: true,
      status: 200,
      fullName: data.full_name,
      stars: data.stargazers_count ?? 0,
      openIssues: data.open_issues_count ?? 0,
      defaultBranch: data.default_branch,
    };
  },
});

/**
 * Create an issue in the configured repo. Any signed-in user may report a
 * problem (the viewer identity is attached to the issue body); admins use
 * the same path from the dashboard. The repo comes from settings or the
 * GITHUB_REPO env key, and GITHUB_TOKEN is required to write. Rate-limited
 * per user and logged into github_reports on every path.
 */
export const createIssue = action({
  args: {
    title: v.string(),
    body: v.string(),
    labels: v.optional(v.array(v.string())),
  },
  returns: v.object({
    ok: v.boolean(),
    number: v.optional(v.number()),
    url: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const viewer = await getViewer(ctx);
    if (!viewer) throw new ConvexError("سجّل الدخول أولًا للإبلاغ عن مشكلة");
    await enforceRateLimit(ctx, viewer._id);

    const origin = args.labels?.includes("test") ? "admin_test" : "content_report";
    const meta =
      `\n\n---\n` +
      `- Source: حكي HAKI platform\n` +
      `- Reported by: ${viewer.name ?? "unknown"}${viewer.email ? ` (${viewer.email})` : ""}\n` +
      `- Reported at: ${new Date().toISOString()}`;
    const title = args.title.trim().slice(0, 120);
    const body = `${args.body.trim().slice(0, 4000)}${meta}`;
    const labels = args.labels ?? [DEFAULT_LABEL];

    const repo = await resolveRepo(ctx);
    const token = process.env.GITHUB_TOKEN;
    if (!repo.owner || !repo.name || !token) {
      // Log locally so the report is never lost while GitHub is unconfigured.
      await logReportInternal(ctx, {
        userId: viewer._id,
        reporterName: viewer.name,
        reporterEmail: viewer.email,
        title,
        body: args.body.trim().slice(0, 4000),
        status: "local",
        origin,
        labels,
        errorMessage: !repo.owner || !repo.name ? "لم يتم ضبط المستودع بعد" : "GITHUB_TOKEN غير مضبوط",
        createdAt: Date.now(),
      });
      throw new ConvexError(
        !repo.owner || !repo.name
          ? "لم يتم ضبط مستودع GitHub بعد — أضف GITHUB_REPO بصيغة owner/name أو اضبط المستودع من لوحة الإدارة."
          : "GITHUB_TOKEN غير مضبوط — أضف توكن GitHub بصلاحية إنشاء الـ Issues في تبويب المفاتيح. تم حفظ بلاغك محليًا ولن يضيع.",
      );
    }

    const res = await fetch(
      `${API}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/issues`,
      {
        method: "POST",
        headers: { ...ghHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ title: `[HAKI] ${title}`, body, labels }),
      },
    );
    if (!res.ok) {
      const message = ghErrorMessage(res.status, "create");
      console.error("[github] createIssue failed:", res.status, await res.text().catch(() => ""));
      await logReportInternal(ctx, {
        userId: viewer._id,
        reporterName: viewer.name,
        reporterEmail: viewer.email,
        title,
        body: args.body.trim().slice(0, 4000),
        status: "failed",
        origin,
        labels,
        errorMessage: `HTTP ${res.status}`,
        createdAt: Date.now(),
      });
      return { ok: false, message };
    }
    const data: any = await res.json();
    await logReportInternal(ctx, {
      userId: viewer._id,
      reporterName: viewer.name,
      reporterEmail: viewer.email,
      title,
      body: args.body.trim().slice(0, 4000),
      status: "created",
      origin,
      labels,
      issueNumber: data.number,
      issueUrl: data.html_url,
      createdAt: Date.now(),
    });
    return { ok: true, number: data.number, url: data.html_url };
  },
});

// ---------------- Report log + admin/public queries ----------------

async function logReportInternal(ctx: any, fields: Record<string, unknown>) {
  return await ctx.runMutation(internal.githubReports.insertReportInternal, fields as never);
}

/** Admin: recent reports (newest first). */
export const listReports = action({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("github_reports"),
      title: v.string(),
      status: v.string(),
      reporterName: v.optional(v.string()),
      reporterEmail: v.optional(v.string()),
      origin: v.optional(v.string()),
      issueNumber: v.optional(v.number()),
      issueUrl: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args): Promise<ReportRow[]> => {
    await requireAdminViewer(ctx);
    const limit = Math.min(args.limit ?? 50, 200);
    const rows = await ctx.runQuery(internal.githubReports.recentReportsPageInternal, { limit });
    return rows as ReportRow[];
  },
});

/** Admin: totals for the dashboard stat card (all-time + last 24h). */
export const reportStats = action({
  args: {},
  returns: v.object({
    total: v.number(),
    last24h: v.number(),
    openIssues: v.number(),
    failed: v.number(),
  }),
  handler: async (
    ctx,
  ): Promise<{ total: number; last24h: number; openIssues: number; failed: number }> => {
    await requireAdminViewer(ctx);
    return await ctx.runQuery(internal.githubReports.reportStatsInternal, {});
  },
});
