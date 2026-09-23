import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard } from "@/components/ContentCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { useQuery } from "convex/react";
import {
  Bookmark,
  Clock,
  Crown,
  History,
  Library,
  ListPlus,
  Settings,
  Shield,
} from "lucide-react";
import { Link } from "react-router";

function ProfileInner() {
  const { lang, t } = useLang();
  const { user, signOut } = useAuth();
  const sub = useQuery(api.subscriptions.mySubscription, {});
  const continueList = useQuery(api.library.continueListening, {});
  const isAdmin = user?.role === "admin";

  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const sections = [
    { icon: ListPlus, label: t("myList"), href: "/library", desc: L("المحتوى الذي أضفته", "Content you added") },
    { icon: Bookmark, label: t("savedContent"), href: "/library?tab=saved", desc: L("المحتوى المحفوظ", "Saved content") },
    { icon: Clock, label: t("lastListened"), href: "/history", desc: L("تابع من حيث توقفت", "Continue where you left") },
    { icon: History, label: t("listenHistory"), href: "/history", desc: L("سجل كامل", "Full history") },
    { icon: Settings, label: t("settings"), href: "/settings", desc: L("اللغة والحساب", "Language & account") },
  ];

  return (
    <div className="py-10">
      <SEO title={`${t("profile")} | حكي`} />
      <div className="haki-container">
        {/* Profile header */}
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-full border bg-accent text-2xl font-black text-accent-foreground">
            {user?.image ? (
              <img src={user.image} alt="" className="size-full object-cover" />
            ) : (
              (user?.name ?? user?.email ?? "؟").charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black">{user?.name ?? L("مستخدم حكي", "HAKI user")}</h1>
            <p className="text-sm text-muted-foreground" dir="ltr">
              {user?.email}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Crown className="size-3 text-primary" />
                {sub?.plan ? (sub.plan as any).name : t("free")}
              </Badge>
              {isAdmin && (
                <Badge className="bg-foreground text-background">
                  <Shield className="size-3" />
                  {L("مدير", "Admin")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Link to="/admin">
                <Button variant="outline" className="gap-1.5 font-semibold">
                  <Shield className="size-4" />
                  {L("لوحة الإدارة", "Admin")}
                </Button>
              </Link>
            )}
            <Button variant="ghost" onClick={() => signOut()}>
              {t("signOut")}
            </Button>
          </div>
        </div>

        {/* Continue listening */}
        {continueList && continueList.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-extrabold">{t("lastListened")}</h2>
            <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-2">
              {continueList.map((row) => (
                <div key={row._id} className="w-44 shrink-0">
                  <ContentCard item={row.content as any} />
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(100, (row.position / Math.max(row.duration, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Sections */}
        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Link
              key={s.href + s.label}
              to={s.href}
              className="group flex items-center gap-4 rounded-2xl border bg-card p-5 transition-all card-shadow hover:card-shadow-hover"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform group-hover:scale-110">
                <s.icon className="size-5" />
              </div>
              <div>
                <p className="font-bold">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </Link>
          ))}
        </section>

        {/* Subscription card */}
        <section className="mt-6 rounded-2xl border bg-gradient-to-l from-accent/50 to-card p-6 card-shadow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("currentPlan")}</p>
              <p className="mt-1 text-xl font-black">
                {sub?.plan ? (sub.plan as any).name : t("free")}
              </p>
              {sub && (
                <p className="text-xs text-muted-foreground">
                  {L("ينتهي في ", "Expires ")}
                  {new Date(sub.expiresAt).toLocaleDateString(lang === "ar" ? "ar" : "en")}
                </p>
              )}
            </div>
            <Link to="/subscriptions">
              <Button className="font-bold">
                {sub ? L("إدارة الاشتراك", "Manage plan") : L("ترقية الحساب", "Upgrade")}
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function Profile() {
  return (
    <RequireAuth
      title="سجّل الدخول لعرض حسابك"
      description="الملف الشخصي، مكتبتك، وسجل استماعك متاحة للمستخدمين المسجلين."
    >
      <ProfileInner />
    </RequireAuth>
  );
}
