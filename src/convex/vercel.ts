"use node";

/**
 * Vercel integration (https://api.vercel.com) — lets the HAKI admin dashboard
 * see deployment status and trigger redeployments without leaving the app.
 *
 * Env keys (set in the Keys tab / Convex dashboard):
 * - VERCEL_TOKEN — Personal access token from https://vercel.com/account/tokens
 *   (read scope is enough for status; write/deploy scope for redeploy).
 * - VERCEL_TEAM_ID — optional team/org id (Settings → General → Vercel ID)
 *   when the project lives in a team instead of a personal account.
 * - VERCEL_PROJECT_ID — optional project id for "open dashboard" links and
 *   as a fallback when the dashboard settings haven't saved a project yet.
 *
 * The target project can also be stored in the settings table
 * (vercel_project_id / vercel_project_name) — those take priority.
 * Without VERCEL_TOKEN everything stays read-disabled with a clear Arabic
 * error — same fallback-first rules as email.ts and github.ts.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";

const API = "https://api.vercel.com";

// ---------------- Auth + settings helpers ----------------

/**
 * Convex actions have no ctx.db, so viewer identity is resolved through an
 * internalQuery (same pattern as bookImporter.adminGate / github.getViewer).
 */
async function getViewer(
  ctx: any,
): Promise<{ _id: string; role?: string; name?: string } | null> {
  return await ctx.runQuery(internal.bookImporter.getViewerUserInternal, {});
}

async function requireAdminViewer(ctx: any) {
  const viewer = await getViewer(ctx);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "super_admin")) {
    throw new ConvexError("غير مصرح: هذه العملية تتطلب صلاحيات المدير");
  }
  return viewer;
}

/** Project identifiers stored in the settings table (priority over env keys). */
async function projectFromSettings(ctx: any): Promise<{ id: string; name: string }> {
  const idRow: any = await ctx.runQuery(internal.adminAuthStore.getSettingInternal, {
    key: "vercel_project_id",
  });
  const nameRow: any = await ctx.runQuery(internal.adminAuthStore.getSettingInternal, {
    key: "vercel_project_name",
  });
  return { id: idRow ?? "", name: nameRow ?? "" };
}

function vHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function vErrorMessage(status: number): string {
  if (status === 401 || status === 403)
    return "توكن Vercel غير صالح أو ناقص الصلاحيات — حدّث VERCEL_TOKEN في تبويب المفاتيح.";
  if (status === 404)
    return "المشروع غير موجود بهذا الـ ID — تأكد من VERCEL_PROJECT_ID أو معرف الفريق VERCEL_TEAM_ID.";
  if (status === 429) return "تجاوزت حد معدل طلبات Vercel — انتظر قليلًا ثم أعد المحاولة.";
  return `خطأ من Vercel (HTTP ${status}).`;
}

async function vGet(token: string, path: string): Promise<any> {
  const url = `${API}${path}${path.includes("?") ? "&" : "?"}teamId=${
    process.env.VERCEL_TEAM_ID ?? ""
  }`;
  const res = await fetch(url.replace(/teamId=$/, "").replace(/teamId=&/, ""), {
    headers: vHeaders(token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new ConvexError(data?.error?.message ?? vErrorMessage(res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---------------- Public / admin actions ----------------

/** Config snapshot for the admin panel. */
export const checkConfig = action({
  args: {},
  returns: v.object({ tokenSet: v.boolean(), projectId: v.string(), projectName: v.string() }),
  handler: async (ctx) => {
    await requireAdminViewer(ctx);
    const fromSettings = await projectFromSettings(ctx);
    const envProject = (process.env.VERCEL_PROJECT_ID ?? "").trim();
    return {
      tokenSet: !!process.env.VERCEL_TOKEN,
      projectId: fromSettings.id || envProject,
      projectName: fromSettings.name,
    };
  },
});

/** List the token's Vercel projects so admins can pick the target one. */
export const listProjects = action({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      framework: v.optional(v.string()),
      latestUrl: v.optional(v.string()),
      latestState: v.optional(v.string()),
      latestCreatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx): Promise<ProjectSummary[]> => {
    await requireAdminViewer(ctx);
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      throw new ConvexError(
        "VERCEL_TOKEN غير مضبوط — أنشئ توكنًا من vercel.com/account/tokens وأضفه في تبويب المفاتيح.",
      );
    }
    const data = await vGet(token, "/v9/projects?limit=20");
    return (data.projects ?? []).map((p: any) => ({
      id: String(p.id ?? ""),
      name: String(p.name ?? ""),
      framework: p.framework ?? undefined,
      latestUrl: p.latestDeployments?.[0]?.url
        ? `https://${p.latestDeployments[0].url}`
        : undefined,
      latestState: p.latestDeployments?.[0]?.state ?? p.latestDeployments?.[0]?.readyState,
      latestCreatedAt: p.latestDeployments?.[0]?.createdAt,
    }));
  },
});

export type ProjectSummary = {
  id: string;
  name: string;
  framework?: string;
  latestUrl?: string;
  latestState?: string;
  latestCreatedAt?: number;
};

/** Latest deployments of one project (newest first, real state values). */
export const listDeployments = action({
  args: { projectId: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      uid: v.string(),
      state: v.string(),
      readyState: v.string(),
      url: v.string(),
      createdAt: v.number(),
      commitMessage: v.optional(v.string()),
      commitSha: v.optional(v.string()),
      target: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args): Promise<DeploymentRow[]> => {
    await requireAdminViewer(ctx);
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      throw new ConvexError("VERCEL_TOKEN غير مضبوط — أضفه في تبويب المفاتيح.");
    }
    const projectId = args.projectId.trim();
    if (!projectId) return [];
    const limit = Math.min(args.limit ?? 8, 20);
    const data = await vGet(
      token,
      `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
    );
    return (data.deployments ?? []).map((d: any) => ({
      uid: String(d.uid ?? ""),
      state: String(d.state ?? ""),
      readyState: String(d.readyState ?? d.state ?? ""),
      url: d.url ? `https://${d.url}` : "",
      createdAt: Number(d.createdAt ?? 0),
      commitMessage: d.meta?.githubCommitMessage ?? d.meta?.gitlabCommitMessage ?? undefined,
      commitSha: (d.meta?.githubCommitSha ?? d.meta?.gitlabCommitSha ?? "").slice(0, 7) || undefined,
      target: d.target ?? undefined,
    }));
  },
});

export type DeploymentRow = {
  uid: string;
  state: string;
  readyState: string;
  url: string;
  createdAt: number;
  commitMessage?: string;
  commitSha?: string;
  target?: string;
};

/** Latest deployment of the configured project (dashboard stat card). */
export const latestDeployment = action({
  args: {},
  returns: v.object({
    state: v.string(),
    url: v.string(),
    createdAt: v.number(),
    commitMessage: v.optional(v.string()),
    projectName: v.optional(v.string()),
  }),
  handler: async (ctx): Promise<LatestDeployment> => {
    await requireAdminViewer(ctx);
    const token = process.env.VERCEL_TOKEN;
    const fromSettings = await projectFromSettings(ctx);
    const projectId = fromSettings.id || (process.env.VERCEL_PROJECT_ID ?? "").trim();
    if (!token || !projectId) {
      return { state: "unconfigured", url: "", createdAt: 0 };
    }
    const data = await vGet(
      token,
      `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=1&target=production`,
    );
    const d = data.deployments?.[0];
    return {
      state: String(d?.readyState ?? d?.state ?? "unknown"),
      url: d?.url ? `https://${d.url}` : "",
      createdAt: Number(d?.createdAt ?? 0),
      commitMessage: d?.meta?.githubCommitMessage ?? undefined,
      projectName: fromSettings.name || undefined,
    };
  },
});

export type LatestDeployment = {
  state: string;
  url: string;
  createdAt: number;
  commitMessage?: string;
  projectName?: string;
};

/**
 * Trigger a production redeploy. Vercel's Git integration rebuilds from the
 * repo's production branch, so this always reflects the latest push.
 */
export const redeploy = action({
  args: { projectId: v.string() },
  returns: v.object({ ok: v.boolean(), url: v.optional(v.string()), message: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    await requireAdminViewer(ctx);
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      throw new ConvexError("VERCEL_TOKEN غير مضبوط — أضفه في تبويب المفاتيح.");
    }
    const projectId = args.projectId.trim();
    if (!projectId) {
      throw new ConvexError("اختر مشروع Vercel أولًا.");
    }
    const res = await fetch(
      `${API}/v13/deployments${process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : ""}`,
      {
        method: "POST",
        headers: vHeaders(token),
        body: JSON.stringify({
          name: projectId,
          target: "production",
          meta: { triggeredBy: "haki-admin-dashboard" },
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[vercel] redeploy failed:", res.status, JSON.stringify(data).slice(0, 300));
      return { ok: false, message: data?.error?.message ?? vErrorMessage(res.status) };
    }
    return { ok: true, url: data?.url ? `https://${data.url}` : undefined };
  },
});
