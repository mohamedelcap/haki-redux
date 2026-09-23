import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "haki_admin_gate_token";

function GateInner({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  const { user } = useAuth();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const gateStatus = useQuery(api.adminGate.status, {});
  const verify = useMutation(api.adminGate.verify);

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passed, setPassed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  // Restore gate state from a stored token (survives reloads within the session).
  const storedToken =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY)
      : null;
  const tokenCheck = useQuery(
    api.adminGate.verifyToken,
    storedToken && gateStatus?.configured ? { token: storedToken } : "skip",
  );

  const loading =
    gateStatus === undefined || (!!storedToken && gateStatus?.configured && tokenCheck === undefined);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  // Gate not configured yet → first admin sets it now.
  if (gateStatus && !gateStatus.configured) {
    return <FirstRunSetup onDone={(t) => {
      try { sessionStorage.setItem(STORAGE_KEY, t); } catch { /* noop */ }
      setPassed(true);
    }} />;
  }

  if (tokenCheck === false) {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }

  const unlocked = passed || tokenCheck === true;
  if (unlocked) return <>{children}</>;

  const lockedUntil = gateStatus?.lockedUntil ?? 0;
  const isLocked = lockedUntil > Date.now();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    try {
      const res = await verify({ password });
      try { sessionStorage.setItem(STORAGE_KEY, res.token); } catch { /* noop */ }
      setPassed(true);
      setPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center card-shadow"
      >
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <LockKeyhole className="size-7 text-primary" />
        </div>
        <h1 className="mt-4 text-xl font-black">
          {L("لوحة التحكم محمية", "Dashboard is protected")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {L(
            `أهلًا ${user?.name ?? ""} — أدخل كلمة مرور لوحة الإدارة للمتابعة.`,
            `Welcome ${user?.name ?? ""} — enter the admin dashboard password to continue.`,
          )}
        </p>

        {isLocked ? (
          <p className="mt-6 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
            {L(
              "تم إيقاف المحاولات مؤقتًا بسبب محاولات خاطئة متكررة. حاول لاحقًا.",
              "Too many failed attempts — try again later.",
            )}
          </p>
        ) : (
          <>
            <div className="mt-6 space-y-2 text-start">
              <Label htmlFor="gate-password">{L("كلمة مرور اللوحة", "Dashboard password")}</Label>
              <Input
                id="gate-password"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="mt-4 w-full font-bold" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              <ShieldCheck className="size-4" />
              {L("فتح اللوحة", "Unlock dashboard")}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}

/** First-run: the first admin sets the dashboard password. */
function FirstRunSetup({ onDone }: { onDone: (token: string) => void }) {
  const { lang } = useLang();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const setPassword = useMutation(api.adminGate.setPassword);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error(L("8 أحرف على الأقل", "At least 8 characters"));
      return;
    }
    if (pw !== pw2) {
      toast.error(L("كلمتا المرور غير متطابقتين", "Passwords do not match"));
      return;
    }
    setSaving(true);
    try {
      const res = await setPassword({ newPassword: pw });
      toast.success(L("تم ضبط كلمة مرور اللوحة", "Dashboard password set"));
      onDone(res.token);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border bg-card p-8 card-shadow"
      >
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <LockKeyhole className="size-7 text-primary" />
        </div>
        <h1 className="mt-4 text-center text-xl font-black">
          {L("اضبط كلمة مرور اللوحة", "Set the dashboard password")}
        </h1>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          {L(
            "طبقة حماية إضافية فوق حسابك — ستُطلب عند كل جلسة إدارة جديدة.",
            "An extra layer on top of your account — required each admin session.",
          )}
        </p>
        <div className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gate-new">{L("كلمة المرور الجديدة", "New password")}</Label>
            <Input id="gate-new" type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gate-new2">{L("تأكيد كلمة المرور", "Confirm password")}</Label>
            <Input id="gate-new2" type="password" dir="ltr" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={8} required />
          </div>
        </div>
        <Button type="submit" className="mt-5 w-full font-bold" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {L("حفظ وتفعيل", "Save & enable")}
        </Button>
      </form>
    </div>
  );
}

/** Wraps the admin dashboard with the password gate. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  return <GateInner>{children}</GateInner>;
}
