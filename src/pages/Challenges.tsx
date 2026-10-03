import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BookCheck,
  CalendarDays,
  Flame,
  Gift,
  Headphones,
  Hourglass,
  Library,
  Star,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Tab = "all" | "active" | "upcoming" | "ended" | "mine";

const GOAL_ICON: Record<string, typeof Timer> = {
  listen_minutes: Timer,
  finished_works: BookCheck,
  rated_items: Star,
};

type TranslateFn = ReturnType<typeof useLang>["t"];

export function goalLabel(
  t: TranslateFn,
  goalType: string,
  target: number,
): string {
  if (goalType === "finished_works") return `${target} ${t("finishedWorksGoal")}`;
  if (goalType === "rated_items") return `${target} ${t("ratedItemsGoal")}`;
  return `${target} ${t("listenMinutesGoal")}`;
}

export function GoalPill({ goalType, target }: { goalType: string; target: number }) {
  const { t } = useLang();
  const Icon = GOAL_ICON[goalType] ?? Timer;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1 text-xs font-bold text-accent-foreground">
      <Icon className="size-3.5" />
      {t("goal")}: {goalLabel(t, goalType, target)}
    </span>
  );
}

export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-500 motion-reduce:transition-none"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLang();
  const map = {
    active: { label: `● ${t("active")}`, cls: "bg-green-600 text-white" },
    upcoming: { label: `◷ ${t("upcoming")}`, cls: "bg-blue-600 text-white" },
    ended: { label: `✓ ${t("ended")}`, cls: "bg-muted text-muted-foreground" },
  } as const;
  const s = map[status as keyof typeof map] ?? map.active;
  return <Badge className={cn("font-semibold", s.cls)}>{s.label}</Badge>;
}

// ------------------------------------------------------------------
// Shared hooks / derived helpers
// ------------------------------------------------------------------

/** Days between two YYYY-MM-DD dates (inclusive count via ceil). */
function daysUntil(dateStr: string, from: number = Date.now()): number {
  const end = new Date(`${dateStr}T23:59:59`).getTime();
  return Math.max(0, Math.ceil((end - from) / 86_400_000));
}

function daysUntilStart(dateStr: string, from: number = Date.now()): number {
  const start = new Date(`${dateStr}T00:00:00`).getTime();
  return Math.max(0, Math.ceil((start - from) / 86_400_000));
}

// ------------------------------------------------------------------
// Challenge card
// ------------------------------------------------------------------

function ChallengeCard({
  ch,
  onJoin,
  onLeave,
  busy,
}: {
  ch: any;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  busy: boolean;
}) {
  const { t, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const joined = !!ch.joined;
  const pct = ch.goalTarget ? Math.min(100, Math.round((ch.progress / ch.goalTarget) * 100)) : 0;

  const daysLeft = daysUntil(ch.endDate);
  const untilStart = daysUntilStart(ch.startDate);

  // The primary action follows state (requirement: زر أساسي يتغير حسب الحالة).
  const primary = (() => {
    if (ch.status === "ended") {
      return (
        <Button variant="outline" className="font-bold" asChild>
          <Link to={`/challenges/${ch._id}`}>{t("viewResults")}</Link>
        </Button>
      );
    }
    if (joined) {
      if (ch.completedAt) {
        return (
          <Button variant="outline" className="font-bold text-green-700" asChild>
            <Link to={`/challenges/${ch._id}`}>
              ✓ {t("completedChallenge")}
            </Link>
          </Button>
        );
      }
      return (
        <Button className="bg-primary font-bold text-white hover:bg-primary/90" asChild>
          <Link to={`/challenges/${ch._id}`}>{t("continueProgress")}</Link>
        </Button>
      );
    }
    if (ch.status === "upcoming") {
      return (
        <Button variant="secondary" className="font-bold" disabled={busy} onClick={() => onJoin(ch._id)}>
          <Hourglass className="size-4" />
          {t("joinChallenge")}
        </Button>
      );
    }
    // active & not joined
    if (!isAuthenticated) {
      return (
        <Button className="bg-primary font-bold text-white hover:bg-primary/90" asChild>
          <Link to={`/auth?returnTo=/challenges`}>{t("joinSignInFirst")}</Link>
        </Button>
      );
    }
    return (
      <Button className="bg-primary font-bold text-white hover:bg-primary/90" disabled={busy} onClick={() => onJoin(ch._id)}>
        <Trophy className="size-4" />
        {t("joinChallenge")}
      </Button>
    );
  })();

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card transition-all card-shadow hover:card-shadow-hover focus-within:ring-2 focus-within:ring-primary/50",
        ch.status === "active" && "border-primary/40",
        ch.status === "ended" && "opacity-90",
      )}
    >
      <Link
        to={`/challenges/${ch._id}`}
        className="focus-visible:outline-none"
        aria-label={`${lang === "ar" ? ch.name : ch.nameEn || ch.name} — ${t("challengeDetails")}`}
      >
        {ch.image && (
          <div className="relative h-36 w-full overflow-hidden sm:h-44">
            <img
              src={ch.image}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 motion-reduce:transition-none hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
            <div className="absolute bottom-3 start-4 flex items-center gap-2">
              <StatusBadge status={ch.status} />
              {ch.status === "active" && (
                <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-white backdrop-blur">
                  <Flame className="size-3.5 text-amber-400" />
                  {daysLeft === 1 ? t("daysLeftOne") : `${daysLeft} ${t("daysLeft")}`}
                </span>
              )}
              {ch.status === "upcoming" && (
                <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-white backdrop-blur">
                  <CalendarDays className="size-3.5" />
                  {t("startsIn")}{" "}
                  {untilStart === 1 ? t("daysToStartOne") : `${untilStart} ${t("daysToStart")}`}
                </span>
              )}
            </div>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-lg font-extrabold leading-snug">
            <Link
              to={`/challenges/${ch._id}`}
              className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {lang === "ar" ? ch.name : ch.nameEn || ch.name}
            </Link>
          </h2>
          {!ch.image && <StatusBadge status={ch.status} />}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {ch.description}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ch.goalTarget ? (
            <GoalPill goalType={ch.goalType ?? "listen_minutes"} target={ch.goalTarget} />
          ) : null}
          {ch.reward && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
              <Gift className="size-3.5" />
              {ch.reward}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            <span dir="ltr" className="tabular-nums">
              {ch.startDate} ← {ch.endDate}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            {ch.participants.toLocaleString(lang === "ar" ? "ar" : "en")} {t("participants")}
          </span>
        </div>

        {joined && ch.status === "active" && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
              <span>{t("yourProgress")}</span>
              <span className="tabular-nums text-primary">
                {ch.completedAt
                  ? `✓ ${t("completedChallenge")}`
                  : `${ch.progress} / ${ch.goalTarget ?? 0}`}
              </span>
            </div>
            <ProgressBar pct={pct} />
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground" aria-live="polite">
              {pct}%
            </p>
          </div>
        )}

        {joined && ch.status === "upcoming" && !ch.completedAt && (
          <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
            <Hourglass className="size-3.5" />
            {t("joinBeforeStart")}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          {primary}
          {joined && !ch.completedAt && ch.status !== "ended" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={busy}
              onClick={() => onLeave(ch._id)}
            >
              {t("leaveChallenge")}
            </Button>
          )}
          <Link to={`/challenges/${ch._id}`} className="ms-auto">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
              {t("challengeDetails")}
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

// ------------------------------------------------------------------
// Empty states (per tab) — reassuring copy + recovery CTA
// ------------------------------------------------------------------

function EmptyState({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: typeof Trophy;
  title: string;
  body: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div className="mt-8 rounded-3xl border bg-card p-10 text-center sm:p-14">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent">
        <Icon className="size-7 text-accent-foreground" />
      </span>
      <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {cta && (
        <Link to={cta.to} className="mt-5 inline-block">
          <Button className="bg-primary font-bold text-white hover:bg-primary/90">
            {cta.label}
          </Button>
        </Link>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

function ChallengesInner() {
  const { t, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const challenges = useQuery(api.engagement.listChallenges, {});
  const myChallenges = useQuery(
    api.engagement.myChallenges,
    isAuthenticated ? {} : "skip",
  );
  const joinChallenge = useMutation(api.engagement.joinChallenge);
  const leaveChallenge = useMutation(api.engagement.leaveChallenge);
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleJoin = async (id: string) => {
    if (!isAuthenticated) {
      toast.error(lang === "ar" ? "سجّل الدخول للمشاركة" : "Sign in to join");
      return;
    }
    setBusy(true);
    try {
      await joinChallenge({ challengeId: id as any });
      toast.success(t("joinedToast"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async (id: string) => {
    setBusy(true);
    try {
      await leaveChallenge({ challengeId: id as any });
      toast.success(lang === "ar" ? "تم الانسحاب من التحدي" : "Left the challenge");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const rows = challenges ?? [];
    return {
      all: rows.length,
      active: rows.filter((c: any) => c.status === "active").length,
      upcoming: rows.filter((c: any) => c.status === "upcoming").length,
      ended: rows.filter((c: any) => c.status === "ended").length,
      mine: (myChallenges ?? []).length,
    };
  }, [challenges, myChallenges]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: t("tabAll"), count: counts.all },
    { key: "active", label: t("activeChallenges"), count: counts.active },
    { key: "upcoming", label: t("upcomingChallenges"), count: counts.upcoming },
    { key: "ended", label: t("endedChallenges"), count: counts.ended },
    ...(isAuthenticated
      ? [{ key: "mine" as Tab, label: t("tabMine"), count: counts.mine }]
      : []),
  ];

  const filtered = useMemo(() => {
    const rows = challenges ?? [];
    if (tab === "all") return rows;
    if (tab === "mine") {
      const mineIds = new Set((myChallenges ?? []).map((m: any) => m.challengeId));
      return rows.filter((c: any) => mineIds.has(c._id));
    }
    return rows.filter((c: any) => c.status === tab);
  }, [challenges, myChallenges, tab]);

  // Summary strip values (real data; undefined while loading → placeholders).
  const completedCount = (myChallenges ?? []).filter(
    (m: any) => m.completedAt || m.completed,
  ).length;
  const challengeMinutes = (myChallenges ?? []).reduce(
    (sum: number, m: any) => sum + (m.progress ?? 0),
    0,
  );

  const summary = [
    { label: t("statActive"), value: counts.active, icon: Flame },
    { label: t("statUpcoming"), value: counts.upcoming, icon: Hourglass },
    ...(isAuthenticated
      ? [{ label: t("statMine"), value: completedCount, icon: Trophy }]
      : []),
    ...(isAuthenticated
      ? [{ label: t("statMinutes"), value: challengeMinutes, icon: Timer }]
      : []),
  ];

  const hasAnyChallenges = (challenges ?? []).length > 0;

  // Convex surfaces query errors by throwing during render; the ErrorBoundary
  // handles hard failures. `failed` covers the manual-retry path.
  if (failed) {
    return (
      <div className="py-16">
        <SEO title={`${t("challenges")} | حكي`} />
        <div className="haki-container">
          <div className="mx-auto max-w-md rounded-3xl border bg-card p-10 text-center">
            <AlertTriangle className="mx-auto size-10 text-amber-500" />
            <h1 className="mt-4 text-lg font-extrabold">{t("loadError")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("loadErrorBody")}</p>
            <Button className="mt-5 font-bold" onClick={() => window.location.reload()}>
              {t("retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <SEO title={`${t("challenges")} | حكي`} />

      {/* ============ Motivational header ============ */}
      <header className="border-b bg-gradient-to-b from-accent/50 to-transparent">
        <div className="haki-container flex flex-col items-start gap-6 py-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
              <Headphones className="size-4" />
              {t("challenges")}
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              {t("challengesHeroTitle")}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {t("challengesHeroSubtitle")}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#challenges-list" className="focus-visible:outline-none">
                <Button className="bg-primary font-bold text-white hover:bg-primary/90">
                  <Trophy className="size-4" />
                  {completedCount > 0 ? t("challengesRelisten") : t("challengesHeroCta")}
                </Button>
              </a>
              {isAuthenticated && completedCount === 0 && counts.active > 0 && (
                <Link to="/browse">
                  <Button variant="outline" className="font-bold">
                    <Headphones className="size-4" />
                    {t("startFirstChallenge")}
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Light audio-related visual: concentric sound rings */}
          <div
            aria-hidden="true"
            className="relative hidden size-36 shrink-0 sm:block"
          >
            <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
            <div className="absolute inset-5 rounded-full border-2 border-primary/25" />
            <div className="absolute inset-10 rounded-full border-2 border-primary/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Headphones className="size-10 text-primary" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </header>

      <div className="haki-container" id="challenges-list">
        {/* ============ Quick summary strip ============ */}
        <section aria-label={t("challenges")} className="mt-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {summary.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-2xl border bg-card p-4 card-shadow"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                  <s.icon className="size-5 text-accent-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="text-xl font-black tabular-nums leading-none">
                    {challenges === undefined ? "…" : s.value.toLocaleString(lang === "ar" ? "ar" : "en")}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-semibold text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============ Tabs (keyboard accessible) ============ */}
        <div
          role="tablist"
          aria-label={t("challenges")}
          className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1"
        >
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => setTab(tb.key)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                tab === tb.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {tb.label}
              <span
                className={cn(
                  "ms-1.5 rounded-full px-1.5 text-xs tabular-nums",
                  tab === tb.key ? "bg-white/20" : "bg-black/10 dark:bg-white/10",
                )}
              >
                {tb.count}
              </span>
            </button>
          ))}
        </div>

        {/* ============ Cards / states ============ */}
        {challenges === undefined ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          tab === "active" && !hasAnyChallenges ? (
            <EmptyState
              icon={Headphones}
              title={t("emptyActive")}
              body={t("emptyActiveBody")}
              cta={{ label: t("browseLibrary"), to: "/browse" }}
            />
          ) : tab === "active" ? (
            <EmptyState
              icon={Flame}
              title={t("emptyActive")}
              body={t("emptyActiveBody")}
              cta={{ label: t("backToActive"), to: "/challenges" }}
            />
          ) : tab === "upcoming" ? (
            <EmptyState
              icon={Hourglass}
              title={t("emptyUpcoming")}
              body={hasAnyChallenges ? t("emptyUpcomingBody") : t("emptyActiveBody")}
              cta={{ label: t("browseLibrary"), to: "/browse" }}
            />
          ) : tab === "ended" ? (
            <EmptyState
              icon={Trophy}
              title={t("emptyEnded")}
              body={t("emptyEndedBody")}
              cta={{ label: t("backToActive"), to: "/challenges" }}
            />
          ) : (
            <EmptyState
              icon={Library}
              title={t("emptyMine")}
              body={t("emptyMineBody")}
              cta={{ label: t("backToActive"), to: "/challenges" }}
            />
          )
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {filtered.map((ch: any) => (
              <ChallengeCard
                key={ch._id}
                ch={ch}
                busy={busy}
                onJoin={handleJoin}
                onLeave={handleLeave}
              />
            ))}
          </div>
        )}

        {/* ============ How it works (light trust section) ============ */}
        <section className="mt-14 rounded-3xl border bg-card p-6 sm:p-8">
          <h2 className="text-lg font-extrabold">{t("faqCount")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t("faqCountBody")}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t("faqUpdateBody")}
          </p>
        </section>
      </div>
    </div>
  );
}

export default function Challenges() {
  return <ChallengesInner />;
}
