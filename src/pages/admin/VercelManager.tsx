import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction, useMutation } from "convex/react";
import {
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Rocket,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** State → Arabic label + badge colors. */
function stateBadge(state: string, L: (ar: string, en: string) => string) {
  if (state === "READY")
    return <Badge className="bg-green-100 text-green-700" variant="secondary">{L("ناجح", "Ready")}</Badge>;
  if (state === "BUILDING" || state === "INITIALIZING" || state === "QUEUED")
    return (
      <Badge variant="outline" className="text-blue-700">
        <Loader2 className="size-3 animate-spin" /> {L("قيد البناء", "Building")}
      </Badge>
    );
  if (state === "ERROR" || state === "CANCELED")
    return <Badge variant="outline" className="text-destructive">{L("فاشل", state === "ERROR" ? "Error" : "Canceled")}</Badge>;
  if (state === "unconfigured")
    return <Badge variant="outline" className="text-amber-700">{L("غير مضبوط", "Not configured")}</Badge>;
  return <Badge variant="outline">{state}</Badge>;
}

/** Compact dashboard-overview card: latest production deployment state. */
export function VercelStatsCard({ L }: { L: (ar: string, en: string) => string }) {
  const latest = useAction(api.vercel.latestDeployment);
  const [data, setData] = useState<
    { state: string; url: string; createdAt: number; commitMessage?: string } | undefined
  >(undefined);

  useEffect(() => {
    latest({})
      .then(setData)
      .catch(() => setData({ state: "unconfigured", url: "", createdAt: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateLabel =
    data === undefined
      ? "…"
      : data.state === "READY"
        ? L("ناجح", "Ready")
        : data.state === "BUILDING" || data.state === "QUEUED" || data.state === "INITIALIZING"
          ? L("بناء", "Building")
          : data.state === "ERROR"
            ? L("فشل", "Error")
            : data.state === "unconfigured"
              ? L("غير مضبوط", "Not set")
              : data.state;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("haki-admin-tab", { detail: "vercel" }))}
      className="flex items-center gap-4 rounded-2xl border bg-card p-5 text-start transition-colors hover:bg-muted/50"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
        <Rocket className="size-5 text-primary" />
      </span>
      <div>
        <p className="flex items-center gap-2 text-lg font-black">
          {data === undefined ? "…" : stateLabel}
          {data?.state === "READY" && <CheckCircle2 className="size-4 text-green-600" />}
          {(data?.state === "ERROR" || data?.state === "CANCELED") && (
            <XCircle className="size-4 text-destructive" />
          )}
          {data?.state === "unconfigured" && <TriangleAlert className="size-4 text-amber-600" />}
        </p>
        <p className="text-xs font-semibold text-muted-foreground">
          {L("آخر نشر على Vercel", "Latest Vercel deployment")}
          {data?.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ms-1 inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              {L("فتح", "open")}
              <ArrowUpRight className="size-3" />
            </a>
          )}
        </p>
      </div>
    </button>
  );
}

export function VercelManager({ L }: { L: (ar: string, en: string) => string }) {
  const checkConfig = useAction(api.vercel.checkConfig);
  const listProjects = useAction(api.vercel.listProjects);
  const listDeployments = useAction(api.vercel.listDeployments);
  const redeploy = useAction(api.vercel.redeploy);
  const setSetting = useMutation(api.adminContent.setSetting);

  const [tokenSet, setTokenSet] = useState<boolean | undefined>(undefined);
  const [projects, setProjects] = useState<
    Awaited<ReturnType<typeof listProjects>> | undefined
  >(undefined);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [manualId, setManualId] = useState("");
  const [deployments, setDeployments] = useState<
    Awaited<ReturnType<typeof listDeployments>> | undefined
  >(undefined);
  const [redeploying, setRedeploying] = useState(false);

  useEffect(() => {
    checkConfig({})
      .then((c) => {
        setTokenSet(c.tokenSet);
        if (c.projectId) setSelected({ id: c.projectId, name: c.projectName || c.projectId });
      })
      .catch(() => setTokenSet(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProjects = async () => {
    setProjects(undefined);
    try {
      setProjects(await listProjects({}));
    } catch (e: any) {
      toast.error(e.message);
      setProjects([]);
    }
  };

  const loadDeployments = async (id: string) => {
    setDeployments(undefined);
    try {
      setDeployments(await listDeployments({ projectId: id, limit: 10 }));
    } catch (e: any) {
      toast.error(e.message);
      setDeployments([]);
    }
  };

  const pickProject = async (p: { id: string; name: string }) => {
    setSelected(p);
    setDeployments(undefined);
    try {
      await setSetting({ key: "vercel_project_id", value: p.id });
      await setSetting({ key: "vercel_project_name", value: p.name });
      toast.success(L("تم ضبط المشروع الهدف", "Target project saved"));
    } catch {
      /* setting requires super_admin — selection still works in-memory */
    }
    await loadDeployments(p.id);
  };

  const doRedeploy = async () => {
    if (!selected) return;
    setRedeploying(true);
    try {
      const res = await redeploy({ projectId: selected.id });
      if (res.ok) {
        toast.success(L("بدأ النشر الجديد — تابع حالته بالأسفل", "Redeploy started — watch it below"));
        if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
        setTimeout(() => loadDeployments(selected.id), 4000);
      } else {
        toast.error(res.message ?? L("فشل بدء النشر", "Could not redeploy"));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRedeploying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Rocket className="size-5 text-primary" />
          {L("تكامل Vercel", "Vercel integration")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {L(
            "تابع حالة نشر موقع حكي على Vercel وأعد النشر من لوحة الإدارة مباشرة.",
            "Track HAKI's Vercel deployment status and redeploy straight from the admin dashboard.",
          )}
        </p>
      </div>

      {/* Setup status + key instructions */}
      <div className="rounded-2xl border bg-card p-5 card-shadow">
        <h3 className="font-extrabold">{L("حالة الإعداد والمفاتيح", "Setup status & keys")}</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {tokenSet === undefined ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : tokenSet ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <XCircle className="size-4 text-destructive" />
            )}
            <code className="font-bold" dir="ltr">VERCEL_TOKEN</code>
            <Badge variant={tokenSet ? "secondary" : "outline"} className="text-[10px]">
              {tokenSet === undefined ? "…" : tokenSet ? L("مضبوط", "set") : L("غير مضبوط", "missing")}
            </Badge>
          </div>
          <ol className="ms-6 list-decimal space-y-1 text-xs leading-relaxed text-muted-foreground">
            <li>
              {L(
                "من Vercel: اضغط صورتك (أعلى اليمين) → Settings → Tokens → Create Token، انسخ القيمة.",
                "On Vercel: click your avatar → Settings → Tokens → Create Token, then copy the value.",
              )}
            </li>
            <li>
              {L(
                "أضف المفتاح VERCEL_TOKEN في تبويب المفاتيح (Keys) أعلى الشاشة.",
                "Add the key VERCEL_TOKEN in the Keys tab at the top of the screen.",
              )}
            </li>
            <li>
              {L(
                "اختياري: VERCEL_TEAM_ID (معرف الفريق من Settings → General) إذا كان المشروع داخل فريق.",
                "Optional: VERCEL_TEAM_ID (team id from Settings → General) when the project lives in a team.",
              )}
            </li>
            <li>
              {L(
                "ثم اختر المشروع من القائمة بالأسفل — يُحفظ تلقائيًا (أو أدخل معرفه يدويًا).",
                "Then pick the project from the list below — it saves automatically (or paste the project id manually).",
              )}
            </li>
          </ol>
        </div>
      </div>

      {/* Project picker */}
      <div className="rounded-2xl border bg-card p-5 card-shadow">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold">{L("المشروع الهدف", "Target project")}</h3>
          <Button variant="outline" size="sm" onClick={loadProjects} disabled={!tokenSet}>
            <RefreshCw className="size-3.5" />
            {L("تحديث القائمة", "Refresh")}
          </Button>
        </div>
        {selected && (
          <p className="mt-2 text-sm">
            <CheckCircle2 className="me-1 inline size-4 text-green-600" />
            <code dir="ltr" className="font-bold">{selected.name}</code>
            <span className="ms-2 text-xs text-muted-foreground" dir="ltr">{selected.id}</span>
          </p>
        )}
        {projects === undefined ? (
          selected ? null : (
            <p className="mt-3 text-xs text-muted-foreground">
              {L("اضغط تحديث لجلب مشاريع Vercel الخاصة بحسابك.", "Refresh to load your Vercel projects.")}
            </p>
          )
        ) : projects.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{L("لا مشاريع في هذا الحساب", "No projects in this account")}</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickProject({ id: p.id, name: p.name })}
                className={
                  "flex w-full flex-wrap items-center gap-2 rounded-xl border p-3 text-start text-sm transition-colors " +
                  (selected?.id === p.id ? "border-primary bg-primary/10" : "hover:bg-muted")
                }
              >
                <span className="font-bold" dir="ltr">{p.name}</span>
                {p.framework && (
                  <Badge variant="outline" className="text-[10px]" dir="ltr">{p.framework}</Badge>
                )}
                {p.latestState && stateBadge(p.latestState, L)}
                {p.latestUrl && (
                  <a
                    href={p.latestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ms-auto inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                  >
                    {L("الموقع", "site")}
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Input
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            dir="ltr"
            placeholder={L("أو أدخل Project ID يدويًا…", "Or paste a Project ID manually…")}
            className="h-9 max-w-xs"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!manualId.trim()}
            onClick={() => pickProject({ id: manualId.trim(), name: manualId.trim() })}
          >
            {L("ضبط", "Set")}
          </Button>
        </div>
      </div>

      {/* Deployments + redeploy */}
      <div className="rounded-2xl border bg-card p-5 card-shadow">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold">{L("سجل النشر", "Deployment history")}</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!selected || deployments === undefined}
              onClick={() => selected && loadDeployments(selected.id)}
            >
              <RefreshCw className="size-3.5" />
              {L("تحديث", "Refresh")}
            </Button>
            <Button size="sm" className="font-bold" disabled={!selected || redeploying} onClick={doRedeploy}>
              {redeploying ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              {L("إعادة نشر الإنتاج", "Redeploy production")}
            </Button>
          </div>
        </div>

        {!selected ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {L("اختر مشروعًا أولًا.", "Pick a project first.")}
          </p>
        ) : deployments === undefined ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : deployments.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {L("لا نشر لهذا المشروع بعد", "No deployments for this project yet")}
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {deployments.map((d) => (
              <div key={d.uid} className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
                {stateBadge(d.readyState, L)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold" dir="auto">
                    {d.commitMessage || (d.target === "production" ? L("إنتاج", "Production") : d.uid)}
                  </span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {new Date(d.createdAt).toLocaleString()}
                    {d.commitSha ? ` · ${d.commitSha}` : ""}
                    {d.target ? ` · ${d.target}` : ""}
                  </span>
                </span>
                {d.url && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    {L("فتح", "Open")}
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
