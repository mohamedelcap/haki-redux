import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { HakiLogo } from "@/components/HakiLogo";
import {
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  Library,
  Loader2,
  Mail,
  Mic,
  Newspaper,
  Podcast,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

type Mode = "signIn" | "signUp" | "forgot";

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const checkLoginAllowed = useMutation(api.account.checkLoginAllowed);
  // Google readiness (server-side env check — never exposes any values).
  const googleStatus = useQuery(api.account.googleAuthStatus);
  const recordLoginAttempt = useMutation(api.account.recordLoginAttempt);
  const setUsername = useMutation(api.account.setUsername);
  const sendEmail = useAction(api.email.send);
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [mode, setMode] = useState<Mode>("signIn");
  // null = pick password; { email } = OTP code entry for that email
  const [otpStep, setOtpStep] = useState<{ email: string } | null>(null);
  const [resetStep, setResetStep] = useState<
    | null
    | { stage: "code"; email: string }
    | { stage: "newPassword"; email: string; code: string }
  >(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const errMsg = (e: unknown, fallback: string) => {
    const raw = e instanceof Error ? e.message : "";
    if (raw.includes("InvalidAccountId") || raw.toLowerCase().includes("invalid")) {
      return "بيانات الدخول غير صحيحة، تأكد من البريد وكلمة المرور.";
    }
    if (raw.includes("at least 8")) {
      return "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
    }
    if (raw.includes("AccountNotFound")) {
      return "لا يوجد حساب بهذا البريد — أنشئ حسابًا جديدًا أولًا.";
    }
    return raw || fallback;
  };

  // ---------- Password sign in / sign up ----------
  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const username = (formData.get("username") as string)?.trim();
    const flow = mode === "signUp" ? "signUp" : "signIn";
    try {
      // Rate limit: max 5 failed password attempts per minute per email.
      await checkLoginAllowed({ email });
      await signIn("password", { email, password, flow });
      if (mode === "signUp" && username) {
        try {
          await setUsername({ username });
        } catch {
          /* username optional — never blocks signup */
        }
      }
      await recordLoginAttempt({ email, success: true });
      if (mode === "signUp") {
        // Fire-and-forget welcome email (no-op without RESEND_API_KEY).
        sendEmail({ kind: "welcome", to: email }).catch(() => {});
      }
      navigate(redirect);
    } catch (e: any) {
      try {
        await recordLoginAttempt({ email, success: false });
      } catch (rl: any) {
        setError(rl.message ?? "محاولات كثيرة — انتظر دقيقة.");
        setIsLoading(false);
        return;
      }
      setError(errMsg(e, "تعذّر تسجيل الدخول، حاول مرة أخرى."));
      setIsLoading(false);
    }
  };

  // ---------- OTP (still available) ----------
  const handleOtpRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const email = formData.get("email") as string;
      await signIn("email-otp", { email });
      setOtpStep({ email });
      setIsLoading(false);
    } catch (e) {
      setError(errMsg(e, "تعذّر إرسال رمز التحقق، حاول مرة أخرى."));
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (code: string) => {
    if (!otpStep) return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("email-otp", { email: otpStep.email, code });
      navigate(redirect);
    } catch {
      setError("الرمز الذي أدخلته غير صحيح.");
      setIsLoading(false);
    }
  };

  // ---------- Password reset ----------
  const handleForgotSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const email = new FormData(event.currentTarget).get("email") as string;
    try {
      await signIn("password", { email, flow: "reset" });
      setResetStep({ stage: "code", email });
      toast.success("أرسلنا رمز الاستعادة إلى بريدك");
    } catch (e) {
      setError(errMsg(e, "تعذّر إرسال رمز الاستعادة."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetCodeSubmit = async (code: string) => {
    if (!resetStep || resetStep.stage !== "code") return;
    setResetStep({ stage: "newPassword", email: resetStep.email, code });
  };

  const handleNewPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetStep || resetStep.stage !== "newPassword") return;
    const formData = new FormData(event.currentTarget);
    const code = formData.get("code") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين — أعد المحاولة.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signIn("password", {
        email: resetStep.email,
        code,
        newPassword: password,
        flow: "reset-verification",
      });
      toast.success("تم تحديث كلمة المرور — يمكنك الدخول الآن");
      navigate(redirect);
    } catch (e) {
      setError(errMsg(e, "تعذّر تعيين كلمة المرور الجديدة، تأكد من الرمز."));
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch {
      setError("تعذّر الدخول كضيف، حاول مرة أخرى.");
      setIsLoading(false);
    }
  };

  // ---------- Google sign-in (OAuth redirect flow) ----------
  const handleGoogleLogin = async () => {
    // Clear, immediate feedback when the deployment has no Google keys yet —
    // otherwise the OAuth round-trip fails silently (redirect → error page).
    if (googleStatus && !googleStatus.configured) {
      setError(
        "تسجيل الدخول بجوجل غير مُفعّل بعد: أضف المفتاحين AUTH_GOOGLE_ID و AUTH_GOOGLE_SECRET في قسم المفاتيح، ثم أعد المحاولة.",
      );
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Convex Auth redirects the browser to Google and back; the session is
      // picked up automatically when the user returns to this page.
      await signIn("google", { redirectTo: redirect });
      // If we get here without a redirect (unexpected), stop the spinner.
      setIsLoading(false);
    } catch (e: any) {
      const raw = String(e?.message ?? "");
      setError(
        raw.includes("Unrecognized") || raw.includes("provider")
          ? "تسجيل الدخول بجوجل غير مُفعّل بعد — أضف المفتاحين AUTH_GOOGLE_ID و AUTH_GOOGLE_SECRET."
          : "تعذّر تسجيل الدخول بجوجل، حاول مرة أخرى.",
      );
      setIsLoading(false);
    }
  };

  const goHome = () => navigate("/");

  // ================= OTP code entry =================
  if (otpStep) {
    return (
      <div className="hero-gradient relative flex min-h-screen flex-col overflow-hidden auth-bg">
        <FloatingIcons />
        <div className="relative flex flex-1 items-center justify-center px-4 py-12">
          <Card className="auth-card auth-shot">
            <CardHeader className="mt-4 text-center">
              <CardTitle>تفقّد بريدك الإلكتروني</CardTitle>
              <CardDescription>أرسلنا رمز التحقق إلى {otpStep.email}</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <OtpInput
                disabled={isLoading}
                error={error}
                onSubmit={handleOtpSubmit}
              />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                لم يصلك الرمز؟{" "}
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => setOtpStep(null)}
                >
                  أعد المحاولة
                </Button>
              </p>
            </CardContent>
            <CardFooter className="flex-col gap-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setOtpStep(null)}
                disabled={isLoading}
              >
                استخدام بريد مختلف
              </Button>
            </CardFooter>
            <AuthFooter goHome={goHome} />
          </Card>
        </div>
      </div>
    );
  }

  // ================= Password reset flow =================
  if (resetStep) {
    return (
      <div className="hero-gradient relative flex min-h-screen flex-col overflow-hidden auth-bg">
        <FloatingIcons />
        <div className="relative flex flex-1 items-center justify-center px-4 py-12">
          <Card className="auth-card auth-shot">
            {resetStep.stage === "code" ? (
              <>
                <CardHeader className="mt-4 text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    <KeyRound className="size-5 text-primary" />
                    استعادة كلمة المرور
                  </CardTitle>
                  <CardDescription>
                    أدخل الرمز المكوّن من 6 أرقام المرسول إلى {resetStep.email}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-6">
                  <OtpInput
                    disabled={isLoading}
                    error={error}
                    onSubmit={handleResetCodeSubmit}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-4 w-full"
                    onClick={() => setResetStep(null)}
                  >
                    <ArrowLeft className="size-4" />
                    رجوع
                  </Button>
                </CardContent>
                <AuthFooter goHome={goHome} />
              </>
            ) : (
              <>
                <CardHeader className="mt-4 text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    <KeyRound className="size-5 text-primary" />
                    تعيين كلمة مرور جديدة
                  </CardTitle>
                  <CardDescription>
                    اختر كلمة مرور جديدة لحساب {resetStep.email}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleNewPasswordSubmit}>
                  <CardContent className="space-y-3 pb-4">
                    <input type="hidden" name="code" value={resetStep.code} />
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                      <Input
                        id="new-password"
                        name="password"
                        type="password"
                        dir="ltr"
                        minLength={8}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        dir="ltr"
                        minLength={8}
                        required
                        placeholder="تأكيد كلمة المرور"
                      />
                      <button
                        type="button"
                        aria-label={showConfirm ? "إخفاء تأكيد كلمة المرور" : "إظهار تأكيد كلمة المرور"}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirm((v) => !v)}
                      >
                        {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {error && <p className="auth-error mt-1 text-sm text-red-500">{error}</p>}
                  </CardContent>
                  <CardFooter className="flex-col gap-2 pb-6">
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="ml-2 size-4 animate-spin" />}
                      حفظ كلمة المرور والدخول
                    </Button>
                  </CardFooter>
                </form>
                <AuthFooter goHome={goHome} />
              </>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ================= Sign in / Sign up / Forgot =================
  return (
    <div className="hero-gradient relative flex min-h-screen flex-col overflow-hidden auth-bg">
      <FloatingIcons />
      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <Card className="auth-card auth-shot">
          {mode === "forgot" ? (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center">
                  <div className="mb-4 mt-4 flex size-12 items-center justify-center rounded-full bg-accent">
                    <KeyRound className="size-5 text-accent-foreground" />
                  </div>
                </div>
                <CardTitle>استعادة كلمة المرور</CardTitle>
                <CardDescription>
                  أدخل بريدك وسنرسل لك رمزًا لتعيين كلمة مرور جديدة
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleForgotSubmit}>
                <CardContent className="pb-4">
                  <div className="relative">
                    <Mail className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="email"
                      placeholder="name@example.com"
                      type="email"
                      className="ps-9"
                      dir="ltr"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                </CardContent>
                <CardFooter className="flex-col gap-2 pb-6">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="ml-2 size-4 animate-spin" />}
                    إرسال رمز الاستعادة
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setMode("signIn");
                      setError(null);
                    }}
                  >
                    رجوع لتسجيل الدخول
                  </Button>
                </CardFooter>
              </form>
              <AuthFooter goHome={goHome} />
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={goHome}
                    aria-label="حكي — الصفحة الرئيسية"
                    className="auth-brand mb-4 mt-4 cursor-pointer transition-transform hover:scale-105
                              [animation-delay:0.3s]
                              [animation-name:auth-brand-park]"
                  >
                    <HakiLogo variant="colored" size={72} />
                  </button>
                </div>
                <CardTitle className="text-2xl">
                  {mode === "signUp" ? "أنشئ حسابك في حكي" : "مرحبًا بك في حكي"}
                </CardTitle>
                <CardDescription>
                  {mode === "signUp"
                    ? "سجّل الآن واستمع لآلاف الأعمال العربية الصوتية والدراما الصوتية والبودكاست"
                    : "سجّل دخولك بكلمة المرور للمتابعة، أو ادخل بريدك لرمز تحقق سريع"}
                </CardDescription>
                {mode === "signUp" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    يمكنك اختيار اسم مستخدم فريد يظهر في ملفك — اختياري.
                  </p>
                )}
              </CardHeader>
              <form onSubmit={handlePasswordSubmit}>
                <CardContent className="space-y-3">
                  {mode === "signUp" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="username">اسم المستخدم (اختياري)</Label>
                      <Input
                        id="username"
                        name="username"
                        placeholder="book_lover99"
                        dir="ltr"
                        minLength={3}
                        maxLength={20}
                        pattern="[a-zA-Z0-9_]+"
                        autoComplete="username"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        name="email"
                        placeholder="address@example.com"
                        type="email"
                        className="ps-9 [padding-top:calc(1.35rem+1px)] [padding-bottom:calc(1.35rem+1px)]"
                        dir="ltr"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">كلمة المرور</Label>
                      {mode === "signIn" && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-primary hover:underline"
                          onClick={() => {
                            setMode("forgot");
                            setError(null);
                          }}
                        >
                          نسيت كلمة المرور؟
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={mode === "signUp" ? "8 حروف على الأقل" : "كلمة المرور"}
                        className="pe-10 [padding-top:calc(1.35rem+1px)] [padding-bottom:calc(1.35rem+1px)]"
                        dir="ltr"
                        minLength={8}
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                        className="absolute end-3 top-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <p className="auth-error mt-1 text-sm text-red-500">{error}</p>}
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button type="submit" className="mt-4 w-full py-3.5 text-base font-bold tracking-wide font-logo auth-primary" disabled={isLoading}>
                    {isLoading && <Loader2 className="ml-2 size-4 animate-spin" />}
                    {mode === "signUp" ? "إنشاء الحساب الآن" : "دخول إلى حسابك"}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {mode === "signUp" ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"}{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={() => {
                        setMode(mode === "signUp" ? "signIn" : "signUp");
                        setError(null);
                      }}
                    >
                      {mode === "signUp" ? "سجّل دخولك" : "أنشئ حسابًا"}
                    </button>
                  </p>
                  <div className="w-full">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">أو</span>
                      </div>
                    </div>
                    <Button type="button" variant="outline" className="auth-google mt-4 w-full gap-2 py-3.5 border-input"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      title={
                        googleStatus && !googleStatus.configured
                          ? "غير مُفعّل — أضف AUTH_GOOGLE_ID و AUTH_GOOGLE_SECRET في قسم المفاتيح"
                          : undefined
                      }
                    >
                      <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
                        />
                      </svg>
                      المتابعة بحساب جوجل
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="auth-btn-outline mt-2 w-full py-3"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                    >
                      <UserX className="ml-2 h-4 w-4" />
                      المتابعة كضيف
                    </Button>              <OtpRequestInline disabled={isLoading} onRequested={(email) => setOtpStep({ email })} />
                    </div>
                  </CardFooter>
                  <AuthFooterBanner goHome={goHome} />
              </form>
              <AuthFooter goHome={goHome} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Small inline form that starts an OTP sign-in (kept alongside passwords). */
function OtpRequestInline({
  disabled,
  onRequested,
}: {
  disabled: boolean;
  onRequested: (email: string) => void;
}) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await signIn("email-otp", { email });
      onRequested(email);
    } catch {
      toast.error("تعذّر إرسال رمز الدخول السريع");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 flex w-full items-center justify-center gap-2">
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="أدخل بريدك لرمز سريع"
        type="email"
        dir="ltr"
        className="auth-ott h-11 text-sm"
        disabled={disabled || busy}
      />
      <Button type="submit" size="sm" className="auth-btn-outline py-2.5 px-5" disabled={disabled || busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : "إدخال الرمز"}
      </Button>
    </form>
  );
}

/** Shared OTP entry grid. */
function OtpInput({
  disabled,
  error,
  onSubmit,
}: {
  disabled: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
}) {
  const [otp, setOtp] = useState("");
  return (
    <div className="flex flex-col items-center gap-3">
      <InputOTP
        value={otp}
        onChange={setOtp}
        maxLength={6}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && otp.length === 6 && !disabled) {
            onSubmit(otp);
          }
        }}
      >
        <InputOTPGroup dir="ltr">
          {Array.from({ length: 6 }).map((_, index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && <p className="auth-error mt-1 text-sm text-red-500">{error}</p>}
      <Button
        type="button"
        className="w-full"
        disabled={isLoadingGate(otp) || disabled || otp.length !== 6}
        onClick={() => onSubmit(otp)}
      >
        تأكيد الرمز
      </Button>
    </div>
  );
}

function isLoadingGate(otp: string) {
  void otp;
  return false;
}

function AuthFooter({ goHome }: { goHome: () => void }) {
  return (
    <div className="auth-footer">
      <span className="auth-pt auth-pt-2">رحلتك</span>
      <span className="auth-pt">مع المحتوى العربي</span>
      <span className="auth-pt">تبدأ هنا</span>
      <span className="mx-2 text-muted-foreground">—</span>
      <span className="auth-pt">وصول سريع</span>
      <span className="auth-pt">إلى المحتوى العربي</span>
      <span className="mx-2 text-muted-foreground">—</span>
      <button
        type="button"
        onClick={goHome}
        className="auth-link font-semibold text-primary transition-colors hover:underline"
      >
        حكي
      </button>
    </div>
  );
}

/** Day-mode footer banner — dark-text banner over the orange/lime background.
 *  Matches: "مع رحلتك تبدأ العربي المحتوى مع — تبدأ هنا — وصول سريع إلى المحتوى العربي —".
 */
function AuthFooterBanner({ goHome }: { goHome: () => void }) {
  return (
    <div className="auth-footer-banner">
      <div className="auth-banner-inner">
        <span className="auth-banner-text">
          <span className="auth-banner-segment">مع رحلتك</span>
          <span className="auth-banner-sep">—</span>
          <span className="auth-banner-segment">تبدأ العربي المحتوى مع</span>
          <span className="auth-banner-sep">—</span>
          <span className="auth-banner-segment">تبدأ هنا</span>
          <span className="auth-banner-sep">—</span>
          <span className="auth-banner-segment">وصول سريع</span>
          <span className="auth-banner-sep">إلى المحتوى العربي</span>
          <span className="auth-banner-sep">—</span>
        </span>
        <button
          type="button"
          onClick={goHome}
          className="auth-banner-go font-semibold text-primary transition-colors hover:underline"
        >
          حكي
        </button>
      </div>
    </div>
  );
}

/**
 * Light animated background: slowly drifting HAKI content icons behind the
 * auth card. Purely decorative (pointer-events-none, aria-hidden) and very
 * low-opacity so it reads as a professional texture, never noise.
 */
const FLOATING_ICONS = [BookOpen, Headphones, Library, Mic, Newspaper, Podcast] as const;

function FloatingIcons() {
  const items = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        Icon: FLOATING_ICONS[i % FLOATING_ICONS.length],
        left: (i * 83) % 100,
        top: (i * 37 + 13) % 100,
        size: 18 + ((i * 7) % 22),
        duration: 9 + ((i * 5) % 10),
        delay: (i * 1.3) % 8,
        drift: 22 + ((i * 11) % 26),
      })),
    [],
  );
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {items.map(({ Icon, left, top, size, duration, delay, drift }, i) => (
        <motion.div
          key={i}
          className="absolute text-primary/10 dark:text-primary/10"
          style={{ left: `${left}%`, top: `${top}%` }}
          animate={{
            y: [0, -drift, 0],
            x: [0, drift * 0.6, 0],
            rotate: [0, i % 2 === 0 ? 8 : -8, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration,
            delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Icon style={{ width: size, height: size }} strokeWidth={1.5} />
        </motion.div>
      ))}
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <SEO
        title="تسجيل الدخول | Sign in — حكي HAKI"
        description="سجّل الدخول إلى حكي للمتابعة من حيث توقفت، الاشتراك، وتحديات الاستماع."
      />
      <Auth {...props} />
    </Suspense>
  );
}
