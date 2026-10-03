import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { useQuery } from "convex/react";
import {
  BookOpen,
  Clock,
  Crown,
  Flame,
  Headphones,
  History,
  Library,
  ListPlus,
  Play,
  Podcast,
  Settings,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router";

function DashboardInner() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const continueList = useQuery(api.library.continueListening, {});
  const myLib = useQuery(api.library.myLibrary, {});
  const history = useQuery(api.library.myHistory, {});
  const notifications = useQuery(api.library.myNotifications, {});
  const sub = useQuery(api.subscriptions.mySubscription, {});
  const follows = useQuery(api.podcasts.myFollowedShows, {});
  const myChallenges = useQuery(api.engagement.myChallenges, {});

  const unread = (notifications ?? []).filter((n) => !n.isRead).length;
  const libCount = myLib?.length ?? 0;
  const historyCount = history?.length ?? 0;
  // Total estimated listening minutes from progress rows.
  const listenedMinutes = Math.round(
    (continueList ?? []).reduce(
      (acc, row) => acc + Math.min(row.position, row.duration || row.position),
      0,
    ) / 60,
  );

  const stats = [
    {
      label: L("دقائق استماع", "Listen minutes"),
      value: listenedMinutes,
      icon: Headphones,
      href: "/history",
    },
    { label: L("في مكتبتي", "In my library"), value: libCount, icon: Library, href: "/library" },
    { label: L("سجل الاستماع", "History items"), value: historyCount, icon: History, href: "/history" },
    { label: L("إشعارات جديدة", "Unread alerts"), value: unread, icon: Sparkles, href: "/notifications" },
  ];

  const quickLinks = [
    { icon: ListPlus, label: t("myList"), href: "/library", desc: L("قائمتي وحفوظاتي", "My list & saved") },
    { icon: Clock, label: t("lastListened"), href: "/history", desc: L("أكمل من حيث توقفت", "Resume where you left") },
    { icon: Crown, label: t("subscriptions"), href: "/subscriptions", desc: sub?.plan ? (sub.plan as any).name : L("مجاني — قم بالترقية", "Free — upgrade") },
    { icon: Settings, label: t("settings"), href: "/settings", desc: L("الحساب واللغة", "Account & language") },
  ];

  return (
    <div className="py-10">
      <SEO title={`${L("لوحتي", "My dashboard")} | حكي`} />
      <div className="haki-container">
        {/* Greeting */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {L("لوحة المستخدم — حكي", "Your HAKI dashboard")}
            </p>
            <h1 className="mt-1 text-3xl font-black">
              {L("أهلًا", "Welcome")}
              {user?.name ? `، ${user.name}` : ""} 👋
            </h1>
          </div>
          {sub?.plan ? (
            <Badge variant="secondary" className="gap-1 px-3 py-1.5">
              <Crown className="size-3.5 text-primary" />
              {(sub.plan as any).name}
            </Badge>
          ) : (
            <Link to="/subscriptions">
              <Button className="gap-1.5 font-bold">
                <Sparkles className="size-4" />
                {L("ترقية حسابك", "Upgrade")}
              </Button>
            </Link>
          )}
        </div>

        {/* Active challenge banner */}
        {(() => {
          const active = (myChallenges ?? []).find((m: any) => m.status === "active" && !m.completed);
          if (!active) return null;
          const pct = Math.min(100, Math.round((active.progress / Math.max(active.target, 1)) * 100));
          return (
            <Link
              to={`/challenges/${active.challengeId}`}
              className="mt-6 flex items-center gap-4 rounded-2xl border border-primary/40 bg-gradient-to-l from-primary/10 via-accent/40 to-transparent p-5 transition-all hover:card-shadow-hover"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                <Flame className="size-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-extrabold">
                    {L("تحديك النشط", "Your active challenge")}: {lang === "ar" ? active.name : active.nameEn || active.name}
                  </p>
                  <span className="shrink-0 text-sm font-black tabular-nums text-primary">
                    {active.progress} / {active.target}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background/70">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Link>
          );
        })()}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <Link
              key={s.label}
              to={s.href}
              className="rounded-2xl border bg-card p-5 transition-all card-shadow hover:card-shadow-hover"
            >
              <s.icon className="size-5 text-primary" />
              <p className="mt-3 text-2xl font-black tabular-nums">
                {s.value.toLocaleString(lang === "ar" ? "ar" : "en")}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{s.label}</p>
            </Link>
          ))}
        </div>

        {/* Continue listening */}
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold">{L("أكمل الاستماع", "Continue listening")}</h2>
            <Link to="/history" className="text-sm font-semibold text-primary hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          {continueList === undefined ? (
            <div className="mt-4 flex gap-4 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-44 shrink-0 rounded-2xl" />
              ))}
            </div>
          ) : continueList.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-card p-10 text-center">
              <Headphones className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 font-bold">{L("لم تبدأ الاستماع بعد", "You haven't started listening yet")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {L("اختر كتابًا صوتيًا وابدأ رحلتك الأولى.", "Pick an audiobook and start your journey.")}
              </p>
              <Link to="/browse/audiobooks">
                <Button className="mt-4 gap-1.5 font-bold">
                  <Play className="size-4" />
                  {L("تصفح الكتب الصوتية", "Browse audiobooks")}
                </Button>
              </Link>
            </div>
          ) : (
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
          )}
        </section>

        {/* Followed podcasts */}
        {follows !== undefined && follows.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">
                <Podcast className="me-2 inline size-5 text-primary" />
                {L("متابعاتي", "My follows")}
              </h2>
              <Link to="/browse/podcasts" className="text-sm font-semibold text-primary hover:underline">
                {L("تصفح البودكاست", "Browse podcasts")}
              </Link>
            </div>
            <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-2">
              {follows.map((c) => (
                <div key={(c as any)._id} className="w-44 shrink-0">
                  <ContentCard item={c as any} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick links */}
        <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((s) => (
            <Link
              key={s.href + s.label}
              to={s.href}
              className="group flex items-center gap-4 rounded-2xl border bg-card p-5 transition-all card-shadow hover:card-shadow-hover"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform group-hover:scale-110">
                <s.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold">{s.label}</p>
                <p className="truncate text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </Link>
          ))}
        </section>

        {/* From your library */}
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold">
              <BookOpen className="me-2 inline size-5 text-primary" />
              {L("من مكتبتي", "From my library")}
            </h2>
            <Link to="/library" className="text-sm font-semibold text-primary hover:underline">
              {t("viewAll")}
            </Link>
          </div>
          {myLib === undefined ? (
            <Skeleton className="mt-4 h-64 rounded-2xl" />
          ) : myLib.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-card p-10 text-center">
              <Library className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 font-bold">{L("مكتبتك فارغة", "Your library is empty")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {L("أضف أعمالًا إلى قائمتك لتظهر هنا.", "Add works to your list and they'll appear here.")}
              </p>
              <Link to="/browse">
                <Button variant="outline" className="mt-4 font-bold">
                  {t("browseLibrary")}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-2">
              {myLib.slice(0, 12).map((row) => (
                <div key={row._id} className="w-44 shrink-0">
                  <ContentCard item={(row as any).content} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}
