import { SEO } from "@/components/SEO";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Languages, LogOut } from "lucide-react";
import { useNavigate } from "react-router";

function SettingsInner() {
  const { lang, setLang, t } = useLang();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div className="py-10">
      <SEO title={`${t("settings")} | حكي`} />
      <div className="haki-container max-w-2xl">
        <h1 className="text-2xl font-black sm:text-3xl">{t("settings")}</h1>

        <section className="mt-8 rounded-2xl border bg-card p-6 card-shadow">
          <div className="flex items-center gap-3">
            <Languages className="size-5 text-primary" />
            <h2 className="font-extrabold">{L("لغة الواجهة", "Interface language")}</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLang("ar")}
              className={cn(
                "rounded-xl border p-4 text-start transition-colors",
                lang === "ar" ? "border-primary bg-accent/60" : "hover:bg-muted",
              )}
            >
              <p className="font-bold">العربية</p>
              <p className="text-xs text-muted-foreground">Arabic (RTL)</p>
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={cn(
                "rounded-xl border p-4 text-start transition-colors",
                lang === "en" ? "border-primary bg-accent/60" : "hover:bg-muted",
              )}
            >
              <p className="font-bold">English</p>
              <p className="text-xs text-muted-foreground">English (LTR)</p>
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-card p-6 card-shadow">
          <h2 className="font-extrabold">{L("معلومات الحساب", "Account information")}</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <Label className="text-muted-foreground">{L("الاسم", "Name")}</Label>
              <span className="font-semibold">{user?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <Label className="text-muted-foreground">{L("البريد الإلكتروني", "Email")}</Label>
              <span className="font-semibold" dir="ltr">
                {user?.email ?? "—"}
              </span>
            </div>
          </div>
          <Button
            variant="destructive"
            className="mt-6"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <LogOut className="size-4" />
            {t("signOut")}
          </Button>
        </section>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <RequireAuth title="سجّل الدخول للإعدادات" description="إعدادات الحساب متاحة للمستخدمين المسجلين.">
      <SettingsInner />
    </RequireAuth>
  );
}
