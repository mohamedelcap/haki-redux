import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BookCheck,
  CalendarDays,
  CheckCircle2,
  Crown,
  Flame,
  Gift,
  Headphones,
  Library,
  Medal,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { GoalPill, ProgressBar, StatusBadge } from "@/pages/Challenges";

function rankIcon(i: number) {
  if (i === 0) return <Crown className="size-5 text-amber-500" aria-label="1" />;
  if (i === 1) return <Medal className="size-5 text-slate-400" aria-label="2" />;
  if (i === 2) return <Medal className="size-5 text-orange-700" aria-label="3" />;
  return (
    <span className="w-5 text-center text-sm font-black tabular-nums text-muted-foreground">
      {i + 1}
    </span>
  );
}

/** Short display name: first name + initial, never a full email. */
function shortName(name: string): string {
  if (!name) return "—";
  if (name.includes("@")) {
    const handle = name.split("@")[0];
    return handle.length > 10 ? `${handle.slice(0, 10)}…` : handle;
  }
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1].slice(0, 1)}.` : parts[0];
}

function daysBetween(a: string, b: string): number {
  const start = new Date(`${a}T00:00:00`).getTime();
  const end = new Date(`${b}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function daysUntil(dateStr: string, from: number = Date.now()): number {
  const end = new Date(`${dateStr}T23:59:59`).getTime();
  return Math.max(0, Math.ceil((end - from) / 86_400_000));
}

// ------------------------------------------------------------------
// Personal progress panel (post-join state)
// ------------------------------------------------------------------

function ProgressPanel({ ch }: { ch: any }) {
  const { t, lang } = useLang();
  const target = Math.max(1, ch.goalTarget ?? 1);
  const progress = Math.max(0, ch.myProgress ?? 0);
  const pct = Math.min(100, Math.round((progress / target) * 100));
  const remaining = Math.max(0, target - progress);
  const isMinutes = (ch.goalType ?? "listen_minutes") === "listen_minutes";
  const isDaysGoal = (ch.goalType ?? "") === "daily_listen";

  const totalDays = daysBetween(ch.startDate, ch.endDate);
  const elapsedDays = Math.min(
    totalDays,
    Math.max(
      0,
      totalDays - daysUntil(ch.endDate) + (ch.status === "active" ? 1 : 0),
    ),
  );
  const daysLeft = daysUntil(ch.endDate);

  const unit = isMinutes ? t("minutesUnit") : (ch.goalType === "finished_works" ? "" : "");
  const remainingText = isMinutes
    ? `${remaining.toLocaleString(lang === "ar" ? "ar" : "en")} ${t("minutesUnit")}`
    : `${remaining.toLocaleString(lang === "ar" ? "ar" : "en")}`;

  // Motivational message varies with progress.
  const message = ch.completedAt
    ? t("challengeCompletedBody")
    : pct === 0
      ? t("todayRemaining")
      : t("todayDone") + " " + t("remainingToGoal") + " " + remainingText + " " + t("toComplete") + ".";

  const completedDays = Math.min(elapsedDays, totalDays);

  return (
    <section
      aria-labelledby="my-progress-title"
      className={cn(
        "mt-6 overflow-hidden rounded-2xl border p-5 sm:p-6",
        ch.completedAt ? "border-green-500/40 bg-green-500/5" : "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="my-progress-title" className="flex items-center gap-2 font-extrabold">
          {ch.completedAt ? (
            <CheckCircle2 className="size-5 text-green-600" />
          ) : (
            <Flame className="size-5 text-primary" />
          )}
          {t("yourProgress")}
        </p>
        <span
          className="text-sm font-black tabular-nums text-primary"
          aria-live="polite"
        >
          {ch.completedAt
            ? `✓ ${t("completedChallenge")}`
            : `${pct}% · ${progress.toLocaleString(lang === "ar" ? "ar" : "en")} / ${target.toLocaleString(lang === "ar" ? "ar" : "en")}${unit ? ` ${unit}` : ""}`}
        </span>
      </div>

      <ProgressBar pct={pct} className="mt-3" />

      {/* Numbers grid — always explicit text, never color-only */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-background p-3 text-center">
          <p className="text-lg font-black tabular-nums">{pct}%</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{t("yourProgress")}</p>
        </div>
        <div className="rounded-xl border bg-background p-3 text-center">
          <p className="text-lg font-black tabular-nums">
            {progress.toLocaleString(lang === "ar" ? "ar" : "en")}
            <span className="text-xs font-semibold text-muted-foreground">
              {" "}
              / {target.toLocaleString(lang === "ar" ? "ar" : "en")}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
            {isMinutes ? t("listenMinutesGoal") : t("goal")}
          </p>
        </div>
        <div className="rounded-xl border bg-background p-3 text-center">
          <p className="text-lg font-black tabular-nums">
            {completedDays}
            <span className="text-xs font-semibold text-muted-foreground"> / {totalDays}</span>
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{t("completedDays")}</p>
        </div>
        <div className="rounded-xl border bg-background p-3 text-center">
          <p className="flex items-center justify-center gap-1 text-lg font-black tabular-nums">
            <Flame className="size-4 text-amber-500" />
            {daysLeft}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{t("daysLeft")}</p>
        </div>
      </div>

      {/* Streak row — real streak metrics require backend aggregation; hidden
          until available rather than shown as fake numbers. */}
      {typeof ch.myStreak === "number" && typeof ch.myBestStreak === "number" && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border bg-background p-3 text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <Flame className="size-4 text-amber-500" />
            {t("streakCurrent")}: {ch.myStreak} {t("daysUnit")}
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="size-4 text-amber-500" />
            {t("streakBest")}: {ch.myBestStreak} {t("daysUnit")}
          </span>
        </div>
      )}

      <p className="mt-4 text-sm font-semibold leading-relaxed">{message}</p>

      {/* Clear path back to content that helps completion */}
      {!ch.completedAt && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/browse">
            <Button size="sm" className="gap-1.5 bg-primary font-bold text-white hover:bg-primary/90">
              <Headphones className="size-3.5" />
              {t("listenToProgress")}
            </Button>
          </Link>
          <Link to="/library">
            <Button size="sm" variant="outline" className="gap-1.5 font-bold">
              <Library className="size-3.5" />
              {t("myLibrary")}
            </Button>
          </Link>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------
// Pre-join info panel
// ------------------------------------------------------------------

function PreJoinPanel({ ch }: { ch: any }) {
  const { t } = useLang();
  const totalDays = daysBetween(ch.startDate, ch.endDate);
  const isMinutes = (ch.goalType ?? "listen_minutes") === "listen_minutes";

  const points = [
    { q: t("whatYoullGet"), a: ch.description },
    {
      q: t("howMinutesCount"),
      a: t("faqCountBody"),
    },
    {
      q: t("successConditions"),
      a: `${t("goal")}: ${ch.goalTarget.toLocaleString()} ${isMinutes ? t("listenMinutesGoal") : ""} ${t("withinDays")} ${totalDays} ${t("daysUnit")}`,
    },
    {
      q: t("whenStartEnd"),
      a: `${ch.startDate} → ${ch.endDate} (${totalDays} ${t("daysUnit")})`,
    },
    {
      q: t("rewardOnFinish"),
      a: ch.reward ? `${t("reward")}: ${ch.reward}` : t("faqRewardBody"),
    },
  ];

  return (
    <section aria-labelledby="prejoin-title" className="mt-6 rounded-2xl border bg-secondary/40 p-5 sm:p-6">
      <h2 id="prejoin-title" className="text-lg font-extrabold">
        {t("whatYoullGet")}
      </h2>
      <dl className="mt-4 space-y-3">
        {points.map((p) => (
          <div key={p.q} className="rounded-xl border bg-card p-4">
            <dt className="text-sm font-extrabold">{p.q}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function ChallengeDetails() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const challengeId = id as Id<"challenges"> | undefined;
  const details = useQuery(
    api.engagement.challengeDetails,
    challengeId ? { id: challengeId } : "skip",
  );
  const joinChallenge = useMutation(api.engagement.joinChallenge);
  const leaveChallenge = useMutation(api.engagement.leaveChallenge);
  const [busy, setBusy] = useState(false);

  const myRank = useMemo(() => {
    if (!details?.joined || !user?._id) return null;
    const board = (details as any).leaderboard as {
      userId: string;
      completedAt: number | null;
      progress: number;
    }[];
    const idx = board.findIndex((r) => r.userId === (user._id as string));
    return idx >= 0 ? idx + 1 : null;
  }, [details, user]);

  if (!id || details === null) {
    return (
      <div className="py-24 text-center">
        <Trophy className="mx-auto size-10 text-muted-foreground/40" />
        <p className="mt-4 font-bold">{t("noChallenges")}</p>
        <Link to="/challenges" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="size-4" />
            {t("challenges")}
          </Button>
        </Link>
      </div>
    );
  }

  if (details === undefined) {
    return (
      <div className="haki-container py-10">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="mt-4 h-64 rounded-3xl" />
        <Skeleton className="mt-6 h-96 rounded-3xl" />
      </div>
    );
  }

  const ch = details as any;
  const days = daysUntil(ch.endDate);
  const untilStart = daysUntil(ch.startDate);
  const totalDays = daysBetween(ch.startDate, ch.endDate);

  const handleJoin = async () => {
    if (!isAuthenticated) {
      toast.error(lang === "ar" ? "سجّل الدخول للمشاركة" : "Sign in to join");
      return;
    }
    setBusy(true);
    try {
      await joinChallenge({ challengeId: ch._id });
      toast.success(t("joinedToast"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    setBusy(true);
    try {
      await leaveChallenge({ challengeId: ch._id });
      toast.success(lang === "ar" ? "تم الانسحاب من التحدي" : "Left the challenge");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const primaryAction = (() => {
    if (ch.status === "ended") {
      return (
        <Button variant="outline" disabled>
          ✓ {t("ended")}
        </Button>
      );
    }
    if (ch.joined) {
      return (
        <>
          <BadgeSlot completed={!!ch.completedAt} />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={busy}
            onClick={handleLeave}
          >
            {t("leaveChallenge")}
          </Button>
        </>
      );
    }
    if (ch.status === "upcoming") {
      return (
        <Button variant="secondary" className="font-bold" onClick={handleJoin} disabled={!isAuthenticated && authLoading}>
          <CalendarDays className="size-4" />
          {t("joinChallenge")}
        </Button>
      );
    }
    if (!isAuthenticated) {
      return (
        <Button className="bg-primary font-bold text-white hover:bg-primary/90" asChild>
          <Link to={`/auth?returnTo=/challenges/${id}`}>{t("joinCtaSignin")}</Link>
        </Button>
      );
    }
    return (
      <Button className="bg-primary font-bold text-white hover:bg-primary/90" onClick={handleJoin}>
        <Trophy className="size-4" />
        {t("joinChallenge")}
      </Button>
    );
  })();

  return (
    <div className="py-10">
      <SEO title={`${lang === "ar" ? ch.name : ch.nameEn || ch.name} | حكي`} />
      <div className="haki-container">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="text-sm">
          <ol className="flex items-center gap-1.5 text-muted-foreground">
            <li>
              <Link to="/challenges" className="font-semibold hover:text-primary">
                {t("challenges")}
              </Link>
            </li>
            <li aria-hidden="true">←</li>
            <li aria-current="page" className="max-w-[50vw] truncate font-bold text-foreground">
              {lang === "ar" ? ch.name : ch.nameEn || ch.name}
            </li>
          </ol>
        </nav>

        {/* Hero */}
        <div className="mt-4 overflow-hidden rounded-3xl border bg-card">
          {ch.image && (
            <div className="relative h-52 w-full overflow-hidden sm:h-64">
              <img
                src={ch.image}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute bottom-4 start-6 flex flex-wrap items-center gap-2">
                <StatusBadge status={ch.status} />
                {ch.status === "active" && (
                  <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                    <Flame className="size-3.5 text-amber-400" />
                    {days === 1 ? t("daysLeftOne") : `${days} ${t("daysLeft")}`}
                  </span>
                )}
                {ch.status === "upcoming" && (
                  <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                    <CalendarDays className="size-3.5" />
                    {t("startsIn")}{" "}
                    {untilStart === 1 ? t("daysToStartOne") : `${untilStart} ${t("daysToStart")}`}
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {!ch.image && <StatusBadge status={ch.status} />}
                </div>
                <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                  {lang === "ar" ? ch.name : ch.nameEn || ch.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {ch.description}
                </p>
              </div>
              {/* Sticky-ish action cluster on mobile */}
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-col sm:items-end">
                {primaryAction}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <GoalPill goalType={ch.goalType} target={ch.goalTarget} />
              {ch.reward && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <Gift className="size-3.5" />
                  {t("reward")}: {ch.reward}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                <Users className="size-3.5" />
                {ch.participants.toLocaleString(lang === "ar" ? "ar" : "en")} {t("participants")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                <CalendarDays className="size-3.5" />
                <span dir="ltr" className="tabular-nums">
                  {ch.startDate} ← {ch.endDate}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                {t("totalDays")}: {totalDays} {t("daysUnit")}
              </span>
            </div>

            {/* State notes */}
            {ch.status === "upcoming" && (
              <p className="mt-5 flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                <CalendarDays className="size-4 shrink-0" />
                {t("upcomingNote")}
              </p>
            )}
            {ch.status === "ended" && (
              <p className="mt-5 flex items-center gap-2 rounded-xl border bg-muted p-3 text-sm font-semibold text-muted-foreground">
                <CheckCircle2 className="size-4 shrink-0" />
                {t("endedNote")}
              </p>
            )}

            {/* Post-join: personal progress dashboard */}
            {ch.joined && <ProgressPanel ch={ch} />}

            {/* Pre-join: structured "what you get" info */}
            {!ch.joined && ch.status !== "ended" && <PreJoinPanel ch={ch} />}
          </div>
        </div>

        {/* Leaderboard */}
        <section className="mt-10" aria-labelledby="leaderboard-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="leaderboard-title" className="flex items-center gap-2 text-xl font-extrabold">
              <Medal className="size-5 text-amber-500" />
              {t("leaderboard")}
            </h2>
            {myRank && (
              <span className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                <Trophy className="size-3.5" />
                {t("yourRank")}: #{myRank}
              </span>
            )}
          </div>

          {ch.joined && !myRank && ch.status === "active" && (
            <p className="mt-3 text-xs font-semibold text-muted-foreground">{t("notOnBoard")}</p>
          )}

          {ch.leaderboard.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
              {t("noParticipants")}
            </div>
          ) : (
            <ol className="mt-4 overflow-hidden rounded-2xl border bg-card">
              {ch.leaderboard.map((row: any, i: number) => (
                <li
                  key={row.userId}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3.5",
                    i > 0 && "border-t",
                    i < 3 && "bg-accent/30",
                  )}
                >
                  {rankIcon(i)}
                  <Avatar className="size-9">
                    <AvatarImage src={row.image} alt="" />
                    <AvatarFallback className="text-xs">
                      {(row.name || "؟").slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {shortName(row.name)}
                      {row.completed && (
                        <span className="ms-2 text-xs font-semibold text-green-600">✓</span>
                      )}
                    </p>
                    <div className="mt-1 max-w-xs">
                      <ProgressBar
                        pct={(row.progress / Math.max(ch.goalTarget, 1)) * 100}
                        className="h-1.5"
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                    {row.completed
                      ? t("completedChallenge")
                      : `${row.progress.toLocaleString(lang === "ar" ? "ar" : "en")} / ${ch.goalTarget.toLocaleString(lang === "ar" ? "ar" : "en")}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Rules & FAQ */}
        <section className="mt-10" aria-labelledby="faq-title">
          <h2 id="faq-title" className="flex items-center gap-2 text-xl font-extrabold">
            <BookCheck className="size-5 text-primary" />
            {t("faqTitle")}
          </h2>
          <Accordion type="single" collapsible className="mt-4 rounded-2xl border bg-card px-5">
            <AccordionItem value="count">
              <AccordionTrigger className="text-start text-sm font-bold">
                {t("faqCount")}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {t("faqCountBody")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="update">
              <AccordionTrigger className="text-start text-sm font-bold">
                {t("faqUpdate")}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {t("faqUpdateBody")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="multiple">
              <AccordionTrigger className="text-start text-sm font-bold">
                {t("faqMultiple")}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {t("faqMultipleBody")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="missed">
              <AccordionTrigger className="text-start text-sm font-bold">
                {t("faqMissed")}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {t("faqMissedBody")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="reward">
              <AccordionTrigger className="text-start text-sm font-bold">
                {t("faqReward")}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {t("faqRewardBody")}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="offline">
              <AccordionTrigger className="text-start text-sm font-bold">
                {t("faqOffline")}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {t("faqOfflineBody")}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Bottom CTA back to content */}
        <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-accent/40 p-6">
          <div>
            <h2 className="text-lg font-extrabold">{t("listenToProgress")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("faqCountBody")}</p>
          </div>
          <Link to="/browse">
            <Button className="bg-primary font-bold text-white hover:bg-primary/90">
              <Headphones className="size-4" />
              {t("browseLibrary")}
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}

function BadgeSlot({ completed }: { completed: boolean }) {
  const { t } = useLang();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
        completed ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary",
      )}
    >
      {completed ? <CheckCircle2 className="size-3.5" /> : <Trophy className="size-3.5" />}
      {completed ? t("completedChallenge") : t("joined")}
    </span>
  );
}
