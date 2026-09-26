import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useQuery } from "convex/react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

function AdminLoginInner() {
  const { lang } = useLang();
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const isStaff =
    user?.role === "super_admin" ||
    user?.role === "admin" ||
    user?.role === "publisher" ||
    user?.role === "author";

  // Check whether the admin account has been minted yet.
  const adminStatus = useQuery(api.adminAuthStore.adminStatus, {});
  const validate = useAction(api.adminAuth.validateAdminCredentials);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in as staff? Straight to the dashboard.
  useEffect(() => {
    if (!isLoading && isAuthenticated && isStaff) {
      navigate("/admin", { replace: true });
    }
  }, [isAuthenticated, isLoading, isStaff, navigate]);

  // Signed in as a REGULAR user: offer to switch accounts instead of a
  // redirect loop to the blocked dashboard.
  if (!isLoading && isAuthenticated && !isStaff) {
    return (
      <div className="hero-gradient flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center card-shadow">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted">
            <UserRound className="size-7 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-xl font-black">
            {L("أنت مسجّل بحساب عادي", "You are signed in as a regular user")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {L(
              "هذه البوابة لفريق الإدارة فقط. سجّل الخروج ثم ادخل بحساب المدير.",
              "This gate is for administrators only. Sign out, then sign in with the admin account.",
            )}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="font-bold"
              onClick={async () => {
                await signOut();
                toast.success(L("تم تسجيل الخروج — أدخل بيانات المدير", "Signed out — enter admin credentials"));
              }}
            >
              {L("تسجيل الخروج وتغيير الحساب", "Sign out & switch account")}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")}>
              {L("العودة للموقع", "Back to site")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // 1) Verify credentials against the official admin account (server-side,
      //    uniform errors, no user enumeration).
      const res = await validate({ username, password });
      if (!res.ok) throw new Error("بيانات الدخول غير صحيحة");

      // 2) Perform the real ConvexAuth sign-in with the username-derived
      //    email identity so the session is a fully valid auth session.
      await signIn("password", {
        email: res.email,
        password,
        flow: "signIn",
      });

      toast.success(L("مرحبًا بك يا مدير 👑", "Welcome, admin 👑"));
      navigate("/admin", { replace: true });
    } catch (err: any) {
      const raw = err?.message ?? "";
      // Uniform message for ALL credential failures (wrong user, wrong
      // password / InvalidSecret, unknown account) — no field enumeration.
      const invalid =
        raw.includes("InvalidSecret") ||
        raw.includes("InvalidAccountId") ||
        raw.includes("Incorrect password") ||
        raw.includes("بيانات الدخول غير صحيحة");
      setError(
        invalid
          ? L("بيانات الدخول غير صحيحة", "Invalid credentials")
          : raw || L("تعذّر تسجيل الدخول", "Sign-in failed"),
      );
      setBusy(false);
    }
  };

  if (adminStatus !== undefined && !adminStatus.configured) {
    return (
      <div className="hero-gradient flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center card-shadow">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="size-7 text-primary" />
          </div>
          <h1 className="mt-4 text-xl font-black">{L("حساب الإدارة غير مُفعّل", "Admin account not set up")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {L(
              "لم يتم إنشاء حساب المدير الرسمي بعد. استخدم أداة الإعداد عبر سطر الأوامر لإنشائه أول مرة.",
              "The official admin account has not been created yet. Use the CLI setup tool to create it first.",
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="hero-gradient flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-3xl border bg-card p-8 card-shadow"
        >
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="size-7 text-primary" />
          </div>
          <h1 className="mt-4 text-center text-xl font-black">
            {L("دخول الإدارة", "Admin sign-in")}
          </h1>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            {L(
              "هذه البوابة مخصصة لفريق إدارة منصة حكي فقط.",
              "This gate is for HAKI platform administrators only.",
            )}
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-username">{L("اسم المستخدم", "Username")}</Label>
              <div className="relative">
                <UserRound className="absolute start-3 top-3 size-4 text-muted-foreground" />
                <Input
                  id="admin-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="ps-9"
                  dir="ltr"
                  autoComplete="username"
                  disabled={busy}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password">{L("كلمة المرور", "Password")}</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pe-9"
                  dir="ltr"
                  autoComplete="current-password"
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  aria-label={showPw ? L("إخفاء", "Hide") : L("إظهار", "Show")}
                  className="absolute end-3 top-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 p-2.5 text-center text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full font-bold" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {L("فتح لوحة التحكم", "Open dashboard")}
            </Button>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
            >
              <ArrowRight className="size-3.5" />
              {L("العودة للموقع", "Back to site")}
            </button>
          </div>
        </form>
      </div>
      <p className="pb-6 text-center text-xs text-muted-foreground">
        {L("منصة حكي — لوحة تحكم محمية", "HAKI platform — protected dashboard")}
      </p>
    </div>
  );
}

export default function AdminLogin() {
  return <AdminLoginInner />;
}
