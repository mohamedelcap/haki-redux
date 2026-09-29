import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, Github, Loader2, Send, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function GitHubManager({ L }: { L: (ar: string, en: string) => string }) {
  const checkConfig = useAction(api.github.checkConfig);
  const getRepo = useAction(api.github.getRepo);
  const createIssue = useAction(api.github.createIssue);
  const setSetting = useMutation(api.adminContent.setSetting);
  const settings = useQuery(api.adminContent.listSettings, {});

  const [tokenSet, setTokenSet] = useState<boolean | undefined>(undefined);
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [issueTitle, setIssueTitle] = useState("");
  const [sending, setSending] = useState(false);

  // Load repo settings + config snapshot.
  useEffect(() => {
    if (!settings) return;
    const o = settings.find((r: any) => r.key === "github_repo_owner")?.value ?? "";
    const n = settings.find((r: any) => r.key === "github_repo_name")?.value ?? "";
    if (!owner && !name && (o || n)) {
      setOwner(o);
      setName(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    checkConfig({})
      .then((c) => {
        setTokenSet(c.tokenSet);
        if (c.repo) {
          const [o, n] = c.repo.split("/");
          setOwner((prev) => prev || o);
          setName((prev) => prev || n);
        }
      })
      .catch(() => setTokenSet(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRepo = async () => {
    setSaving(true);
    try {
      await setSetting({ key: "github_repo_owner", value: owner.trim() });
      await setSetting({ key: "github_repo_name", value: name.trim() });
      toast.success(L("تم حفظ المستودع", "Repository saved"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

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
        toast.success(L(`تم إنشاء البلاغ #${res.number}`, `Issue #${res.number} created`));
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(res.message ?? L("تعذّر إنشاء البلاغ", "Could not create the issue"));
      }
    } catch (err: any) {
      toast.error(err.message);
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
            "اربط حكي بمستودع GitHub لإنشاء بلاغات المشاكل تلقائيًا من المستخدمين والإدارة.",
            "Connect HAKI to a GitHub repo so user and admin problem reports become issues automatically.",
          )}
        </p>
      </div>

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
              {tokenSet === undefined
                ? "…"
                : tokenSet
                  ? L("مضبوط", "set")
                  : L("غير مضبوط", "missing")}
            </Badge>
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
                "أضف المفتاح GITHUB_TOKEN في تبويب المفاتيح (Keys) أعلى الشاشة بالقيمة التي نسختها.",
                "Add the key GITHUB_TOKEN in the Keys tab at the top of the screen with the value you copied.",
              )}
            </li>
            <li>
              {L(
                "اختياري: مفتاح GITHUB_REPO بصيغة owner/name كمستودع افتراضي (إعدادات المستودع أدناه تسبقه).",
                "Optional: a GITHUB_REPO key in owner/name form as the default repo (the settings below take priority).",
              )}
            </li>
          </ol>
        </div>
      </div>

      {/* Repo settings + test */}
      <div className="rounded-2xl border bg-card p-5 card-shadow">
        <h3 className="font-extrabold">{L("المستودع الهدف", "Target repository")}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} dir="ltr" placeholder="my-org" />
          </div>
          <div className="space-y-1.5">
            <Label>Repository</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} dir="ltr" placeholder="haki-platform" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={saveRepo} disabled={saving} className="font-bold">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {L("حفظ المستودع", "Save repo")}
          </Button>
          <Button variant="outline" onClick={testConnection} disabled={testing || !owner.trim() || !name.trim()}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
            {L("اختبار الاتصال", "Test connection")}
          </Button>
        </div>
        {testResult && (
          <p
            className={
              "mt-3 rounded-xl border p-3 text-sm " +
              (testResult.ok ? "border-green-200 bg-green-50 text-green-800" : "border-destructive/30 bg-destructive/10 text-destructive")
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
            "أنشئ Issue حقيقيًا في المستودع للتأكد أن التوكن يملك صلاحية الكتابة.",
            "Create a real issue in the repo to confirm the token can write.",
          )}
        </p>
        <form onSubmit={sendTestIssue} className="mt-3 flex flex-wrap gap-2">
          <Input
            value={issueTitle}
            onChange={(e) => setIssueTitle(e.target.value)}
            className="max-w-sm flex-1"
            placeholder={L("عنوان البلاغ التجريبي", "Test issue title")}
            maxLength={120}
          />
          <Button type="submit" disabled={sending || !issueTitle.trim()} className="font-bold">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {L("إرسال", "Send")}
          </Button>
        </form>
      </div>
    </div>
  );
}
