import { Button } from "@/components/ui/button";
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
import { useMutation, useAction } from "convex/react";
import { HakiLogo } from "@/components/HakiLogo";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
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
      setError("كلمتا المرور غير متطابقتين.");
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

  const goHome = () => navigate("/");

  // ================= OTP code entry =================
  if (otpStep) {
    return (
      <div className="hero-gradient flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <Card className="min-w-[350px] border pb-0 shadow-md">
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
      <div className="hero-gradient flex min-h-screen flex-col">
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <Card className="min-w-[350px] border pb-0 shadow-md">
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
                        type="password"
                        dir="ltr"
                        minLength={8}
                        required
                      />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
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
    <div className="hero-gradient flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="min-w-[350px] border pb-0 shadow-md">
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
                    className="mb-4 mt-4 cursor-pointer transition-transform hover:scale-105"
                  >
                    <HakiLogo variant="colored" size={72} />
                  </button>
                </div>
                <CardTitle className="text-xl">
                  {mode === "signUp" ? "أنشئ حسابك في حكي" : "مرحبًا بك في حكي"}
                </CardTitle>
                <CardDescription>
                  {mode === "signUp"
                    ? "سجّل الآن واستمع لآلاف الأعمال العربية الصوتية"
                    : "سجّل دخولك بكلمة المرور للمتابعة"}
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
                      <Mail className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="ps-9"
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
                        placeholder={mode === "signUp" ? "8 أحرف على الأقل" : "••••••••"}
                        className="pe-9"
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
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="ml-2 size-4 animate-spin" />}
                    {mode === "signUp" ? "إنشاء الحساب" : "تسجيل الدخول"}
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
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                    >
                      <UserX className="ml-2 h-4 w-4" />
                      المتابعة كضيف
                    </Button>
                    <OtpRequestInline disabled={isLoading} onRequested={(email) => setOtpStep({ email })} />
                  </div>
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
    <form onSubmit={submit} className="mt-3 flex items-center gap-2">
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="أو ادخل بريدك لرمز سريع"
        type="email"
        dir="ltr"
        className="h-9 text-xs"
        disabled={disabled || busy}
      />
      <Button type="submit" size="sm" variant="secondary" disabled={disabled || busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : "رمز"}
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
      {error && <p className="text-sm text-red-500">{error}</p>}
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
    <div className="rounded-b-lg border-t bg-muted px-6 py-4 text-center text-xs text-muted-foreground">
      رحلتك مع المحتوى العربي تبدأ هنا —{" "}
      <button
        type="button"
        onClick={goHome}
        className="font-semibold text-primary transition-colors hover:underline"
      >
        حكي
      </button>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
