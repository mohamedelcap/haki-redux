import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HakiLogo } from "@/components/HakiLogo";
import { useLang } from "@/lib/i18n";

export default function LoginCard() {
  const { lang } = useLang();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-b from-amber-100/40 to-orange-200/40 p-6 shadow-2xl shadow-orange-500/15 backdrop-blur-sm">
        {/* Logo */}
        <div className="mb-4 flex justify-center">
          <Link to="/" aria-label="حكي — الصفحة الرئيسية">
            <HakiLogo variant="colored" size={56} />
          </Link>
        </div>

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-black leading-tight text-foreground">
            مرحبًا بك في حكي
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            سجّل دخولك بكلمة المرور للمتابعة، أو ادخل بريدك لرمز تحقق سريع
          </p>
        </div>

        {/* Email */}
        <div className="mt-5">
          <Label htmlFor="email" className="text-right text-sm font-semibold text-foreground">
            البريد الإلكتروني
          </Label>
          <div className="relative mt-1">
            <Mail className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="address@example.com"
              className="ps-9 [padding-top:calc(1.35rem+1px)] [padding-bottom:calc(1.35rem+1px)] text-foreground"
            />
          </div>
        </div>

        {/* Password */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold text-foreground">
              كلمة المرور
            </Label>
            <Link
              to="/auth?mode=forgot"
              className="text-xs font-semibold text-orange-600 hover:underline"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>
          <div className="relative mt-1">
            <Input
              id="password"
              type="password"
              placeholder="كلمة المرور"
              className="pe-10 [padding-top:calc(1.35rem+1px)] [padding-bottom:calc(1.35rem+1px)] text-foreground"
            />
            <button
              type="button"
              aria-label="إخفاء كلمة المرور"
              className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <EyeOff className="size-4" />
            </button>
          </div>
        </div>

        {/* Primary button */}
        <Button
          variant="default"
          className="mt-4 w-full py-3.5 text-base font-bold tracking-wide"
        >
          دخول إلى حسابك
        </Button>

        {/* Sign-up prompt */}
        <p className="mt-3 text-center text-sm text-muted-foreground">
          ليس لديك حساب؟ {" "}
          <Link to="/auth" className="font-semibold text-orange-600 hover:underline">
            أنشئ حسابا
          </Link>
        </p>

        {/* Divider */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="rounded-full border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
            أو
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Secondary buttons */}
        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full py-3 text-base font-bold border-orange-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
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

          <Button variant="outline" className="w-full py-3 text-base font-bold">
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            المتابعة كضيف
          </Button>
        </div>

        {/* Quick code */}
        <div className="mt-3 flex gap-2">
          <Button variant="default" className="flex-1 py-3 text-base font-bold">
            إدخال الرمز
          </Button>
          <div className="relative flex-1">
            <Mail className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="quick-code"
              type="email"
              placeholder="أدخل بريدك لرمز سريع"
              className="ps-9 [padding-top:calc(1.35rem+1px)] [padding-bottom:calc(1.35rem+1px)] text-foreground"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between border-t border-white/20 pt-3 text-xs text-muted-foreground">
          <span className="text-muted-foreground/70">رحلتك</span>
          <span className="text-muted-foreground/70">مع المحتوى العربي</span>
          <span className="text-muted-foreground/70">تبدأ هنا</span>
          <span className="text-muted-foreground/70">وصول سريع</span>
          <span className="text-muted-foreground/70">إلى المحتوى العربي</span>
          <span className="flex items-center gap-2 text-orange-600">
            <span className="flex size-5 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
              حكي
            </span>
            <Link to="/">حكي</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
