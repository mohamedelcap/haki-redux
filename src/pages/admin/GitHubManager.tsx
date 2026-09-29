import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "convex/react";
import { CheckCircle2, ExternalLink, Github, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Shared admin panel for the GitHub integration:
 * - Setup status (GITHUB_TOKEN / repo) with step-by-step key instructions.
 * - Target repo settings + live connection test.
 * - Test issue creation.
 * - Report log (github_reports) + stats card.
 * L: bilingual label helper from the admin dashboard.
 */

export function GitHubStatsCard({ L }: { L: (ar: string, en: string) => string }) {
  const reportStats = useAction(api.github.reportStats);
  const [stats, setStats] = useState<
    { total: number; last24h: number; openIssues: number; failed: number } | undefined
  >(undefined);

  useEffect(() => {
    reportStats({})
      .then(setStats)
      .catch(() => setStats({ total: 0, last24h: 0, openIssues: 0, failed: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("haki-admin-tab", { detail: "github" }))}
      className="flex items-center gap-4 rounded-2xl border bg-card p-5 text-start transition-colors hover:bg-muted/50"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
        <Github className="size-5 text-primary" />
      </span>
      <div>
        <p className="text-2xl font-black tabular-nums">
          {stats === undefined ? "…" : stats.total.toLocaleString()}
          {stats !== undefined && stats.last24h > 0 && (
            <span className="ms-2 align-middle text-[11px] font-bold text-primary">
              +{stats.last24h} {L("اليوم", "today")}
            </span>
          )}
        </p>
        <p className="text-xs font-semibold text-muted-foreground">
          {L("بلاغات GitHub", "GitHub reports")}
          {stats !== undefined && stats.failed > 0 && (
            <span className="ms-1 text-destructive">· {stats.failed} {L("فاشل", "failed")}</span>
          )}
        </p>
      </div>
    </button>
  );
}

export function GitHubReportsLog({ L }: { L: (ar: string, en: string) => string }) {
  const listReports = useAction(api.github.listReports);
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof listReports>> | undefined
  >(undefined);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    listReports({ limit: 100 })
      .then(setRows)
      .catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = (rows ?? []).filter((r) =>
    filter.trim()
      ? (r.title + (r.reporterName ?? "") + (r.reporterEmail ?? ""))
          .toLowerCase()
          .includes(filter.trim().toLowerCase())
      : true,
  );

  const statusBadge = (status: string) => {
    if (status === "created")
      return (
        <Badge className="bg-green-100 text-green-700" variant="secondary">
          {L("منشور على GitHub", "On GitHub")}
        </Badge>
      );
    if (status === "local")
      return (
        <Badge variant="outline" className="text-amber-700">
          {L("محفوظ محليًا", "Saved locally")}
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-destructive">
        {L("فشل الإرسال", "Failed")}
      </Badge>
    );
  };

  return (
    <div className="rounded-2xl border bg-card p-5 card-shadow">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold">{L("سجل البلاغات", "Reports log")}</h3>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 max-w-[220px]"
          placeholder={L("بحث في البلاغات…", "Search reports…")}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {L(
          "كل بلاغ يُحفظ هنا قبل إرساله إلى GitHub — حتى لو كان التوكن ناقصًا أو فشل الإرسال لا يضيع شيء. الحد: 5 بلاغات لكل مستخدم في 24 ساعة.",
          "Every report is saved here before reaching GitHub — even with a missing token or a failed send nothing is lost. Limit: 5 reports per user per 24h.",
        )}
      </p>

      {rows === undefined ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {L("لا توجد بلاغات بعد", "No reports yet")}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {visible.map((r) => (
            <div
              key={r._id}
              className="flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold" dir="auto">{r.title}</span>
                <span className="text-xs text-muted-foreground">
                  {r.reporterName ?? "—"}
                  {r.reporterEmail ? ` · ${r.reporterEmail}` : ""}
                  {" · "}
                  {new Date(r.createdAt).toLocaleString()}
                  {r.errorMessage ? ` · ${r.errorMessage}` : ""}
                </span>
              </span>
              {statusBadge(r.status)}
              {r.issueUrl && (
                <Button asChild size="sm" variant="ghost">
                  <a href={r.issueUrl} target="_blank" rel="noopener noreferrer">
                    #{r.issueNumber}
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GitHubManager({ L }: { L: (ar: string, en: string) => string }) {
  const checkConfig = useAction(api.github.checkConfig);
  const getRepo = useAction(api.github.getRepo);
  const createIssue = useAction(api.github.createIssue);
  const [tokenSet, setTokenSet] = useState<boolean | undefined>(undefined);
  const [repoName, setRepoName] = useState("");
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [issueTitle, setIssueTitle] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    checkConfig({})
      .then((c) => {
        setTokenSet(c.tokenSet);
        if (c.repo) {
          const [o, n] = c.repo.split("/");
          setOwner(o);
          setName(n);
          setRepoName(c.repo);
        }
      })
      .catch(() => setTokenSet(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await getRepo({ owner: owner.trim(), repo: name.trim() });
      if (res.ok) {
        setTestResult({
          ok: true,
          text: L(
            `متصل ✓ ${res.fullName} — ${res.stars ?? 0} نجمة، ${res.openIssues ?? 0} issue مفتوح، الفرع ${res.defaultBranch ?? ""}`,
            `Connected ✓ ${res.fullName} — ${res.stars ?? 0} stars, ${res.openIssues ?? 0} open issues, branch ${res.defaultBranch ?? ""}`,
          ),
        });
      } else {
        setTestResult({ ok: false, text: res.message ?? `HTTP ${res.status}` });
      }
    } catch (e: any) {
      setTestResult({ ok: false, text: e.message });
    } finally {
      setTesting(false);
    }
  };

  const sendTestIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim()) return;
    setSending(true);
    try {
      const res = await createIssue({
        title: issueTitle.trim(),
        body: L(
          "بلاغ تجريبي من لوحة إدارة حكي للتحقق من تكامل GitHub.",
          "Test issue from the HAKI admin dashboard to verify the GitHub integration.",
        ),
        labels: ["haki-feedback", "test"],
      });
      if (res.ok && res.url) {
        toastOk(L(`تم إنشاء البلاغ #${res.number}`, `Issue #${res.number} created`));
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        toastErr(res.message ?? L("تعذّر إنشاء البلاغ", "Could not create the issue"));
      }
    } catch (err: any) {
      toastErr(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black">
          <Github className="size-5 text-primary" />
          {L("تكامل GitHub", "GitHub integration")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {L(
            "اربط حكي بمستودع GitHub: بلاغات المستخدمين والإدارة تصبح Issues مع سجل كامل وصفحة شفافية.",
            "Connect HAKI to a GitHub repo: user and admin reports become issues, with a full log and a transparency page.",
          )}
        </p>
      </div>

      <GitHubStatsCard L={L} />

      {/* Config status */}
      <div className="rounded-2xl border bg-card p-5 card-shadow">
        <h3 className="font-extrabold">{L("حالة الإعداد", "Setup status")}</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {tokenSet === undefined ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : tokenSet ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <XCircle className="size-4 text-destructive" />
            )}
            <code className="font-bold" dir="ltr">GITHUB_TOKEN</code>
            <Badge variant={tokenSet ? "secondary" : "outline"} className="text-[10px]">
              {tokenSet === undefined ? "…" : tokenSet ? L("مضبوط", "set") : L("غير مضبوط", "missing")}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {repoName ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <XCircle className="size-4 text-amber-600" />
            )}
            <code className="font-bold" dir="ltr">GITHUB_REPO</code>
            <span className="text-xs text-muted-foreground" dir="ltr">
              {repoName || L("اختياري (أو اضبطه أدناه)", "optional (or set it below)")}
            </span>
          </div>
          <ol className="ms-6 list-decimal space-y-1 text-xs leading-relaxed text-muted-foreground">
            <li>
              {L(
                "من GitHub: Settings → Developer settings → Personal access tokens → Generate new token (classic) مع صلاحية repo (أو public_repo للمستودعات العامة). للتوكن الدقيق (fine-grained): أضف صلاحية Issues ‏Read and write.",
                "On GitHub: Settings → Developer settings → Personal access tokens → Generate new token (classic) with the repo scope (or public_repo for public repos). For a fine-grained token: grant Issues Read and write.",
              )}
            </li>
            <li>
              {L(
                "أضف المفتاح GITHUB_TOKEN في تبويب المفاتيح (Keys) أعلى الشاشة، واختياريًا GITHUB_REPO بصيغة owner/name.",
                "Add the key GITHUB_TOKEN in the Keys tab at the top of the screen, and optionally GITHUB_REPO in owner/name form.",
              )}
            </li>
          </ol>
        </div>
      </div>

      {/* Connection test */}
      <div className="rounded-2xl border bg-card p-5 card-shadow">
        <h3 className="font-extrabold">{L("اختبار الاتصال", "Connection test")}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            dir="ltr"
            placeholder="owner"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir="ltr"
            placeholder="repository"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={testConnection} disabled={testing || !owner.trim() || !name.trim()}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
            {L("اختبار", "Test")}
          </Button>
        </div>
        {testResult && (
          <p
            className={
              "mt-3 rounded-xl border p-3 text-sm " +
              (testResult.ok
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-destructive/30 bg-destructive/10 text-destructive")
            }
            dir="auto"
          >
            {testResult.text}
          </p>
        )}
      </div>

      {/* Test issue */}
      <div className="rounded-2xl border bg-card p-5 card-shadow">
        <h3 className="font-extrabold">{L("بلاغ تجريبي", "Test issue")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {L(
            "أنشئ Issue حقيقيًا للتأكد أن التوكن يملك صلاحية الكتابة (يُحفظ أيضًا في السجل).",
            "Create a real issue to confirm the token can write (also saved to the log).",
          )}
        </p>
        <form onSubmit={sendTestIssue} className="mt-3 flex flex-wrap gap-2">
          <input
            value={issueTitle}
            onChange={(e) => setIssueTitle(e.target.value)}
            className="h-9 max-w-sm flex-1 rounded-md border bg-background px-3 text-sm"
            placeholder={L("عنوان البلاغ التجريبي", "Test issue title")}
            maxLength={120}
          />
          <Button type="submit" disabled={sending || !issueTitle.trim()} className="font-bold">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
            {L("إرسال", "Send")}
          </Button>
        </form>
      </div>

      <GitHubReportsLog L={L} />
    </div>
  );
}

// Local toast helpers (keep this module dependency-light).
function toastOk(message: string) {
  import("sonner").then(({ toast }) => toast.success(message));
}
function toastErr(message: string) {
  import("sonner").then(({ toast }) => toast.error(message));
}
