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
  BookCheck,
  CalendarDays,
  Flame,
  Gift,
  Hourglass,
  Medal,
  Star,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type Tab = "active" | "upcoming" | "ended";

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
        className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLang();
  const map = {
    active: { label: t("active"), cls: "bg-green-600 text-white" },
    upcoming: { label: t("upcoming"), cls: "bg-blue-600 text-white" },
    ended: { label: t("ended"), cls: "bg-muted text-muted-foreground" },
  } as const;
  const s = map[status as keyof typeof map] ?? map.active;
  return <Badge className={cn("font-semibold", s.cls)}>{s.label}</Badge>;
}

function MiniLeaders({
  topUsers,
}: {
  topUsers: { userId: string; name: string; image?: string; progress: number }[];
}) {
  const { t } = useLang();
  if (topUsers.length === 0) return null;
  return (
    <div className="mt-4 flex items-center gap-2 border-t pt-3">
      <Medal className="size-4 shrink-0 text-amber-500" />
      <div className="flex -space-x-2 space-x-reverse">
        {topUsers.map((u) => (
          <Avatar key={u.userId} className="size-7 border-2 border-background">
            <AvatarImage src={u.image} alt={u.name} />
            <AvatarFallback className="text-[10px]">{u.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {topUsers.map((u) => u.name).join(" · ")} — {t("topFinishers")}
      </p>
    </div>
  );
}

function ChallengeCard({
  ch,
  onJoin,
  onLeave,
  busy,
  joined,
}: {
  ch: any;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  busy: boolean;
  joined?: boolean;
}) {
  const { t, lang } = useLang();
  const days = Math.max(
    0,
    Math.round((new Date(ch.endDate).getTime() - Date.now()) / 86400000),
  );
  const pct = ch.goalTarget
    ? Math.round((ch.progress / ch.goalTarget) * 100)
    : 0;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card transition-all card-shadow hover:card-shadow-hover",
        ch.status === "active" && "border-primary/40",
      )}
    >
      <Link to={`/challenges/${ch._id}`} className="block">
        {ch.image && (
          <div className="relative h-36 w-full overflow-hidden sm:h-44">
            <img
              src={ch.image}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
            <div className="absolute bottom-3 start-4 flex items-center gap-2">
              <StatusBadge status={ch.status} />
              {ch.status === "active" && (
                <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-white backdrop-blur">
                  <Flame className="size-3.5 text-amber-400" />
                  {days} {t("days")}
                </span>
              )}
            </div>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/challenges/${ch._id}`} className="min-w-0">
            <h2 className="truncate text-lg font-extrabold hover:text-primary">
              {lang === "ar" ? ch.name : ch.nameEn || ch.name}
            </h2>
          </Link>
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1 text-xs font-bold text-accent-foreground">
              <Gift className="size-3.5" />
              {ch.reward}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {ch.startDate} ← {ch.endDate}
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
          </div>
        )}

        <MiniLeaders topUsers={ch.topUsers ?? []} />

        <div className="mt-auto flex items-center gap-2 pt-5">
          {ch.status === "ended" ? (
            <Button variant="outline" disabled>
              {t("ended")}
            </Button>
          ) : joined ? (
            <>
              <Badge variant="secondary" className="gap-1 px-3 py-1.5">
                <Trophy className="size-3.5 text-primary" />
                {t("joined")}
              </Badge>
              {ch.status === "upcoming" && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Hourglass className="size-3.5" />
                  {t("joinBeforeStart")}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ms-auto text-muted-foreground"
                disabled={busy}
                onClick={() => onLeave(ch._id)}
              >
                {t("leaveChallenge")}
              </Button>
            </>
          ) : (
            <Button className="font-bold" disabled={busy} onClick={() => onJoin(ch._id)}>
              <Trophy className="size-4" />
              {t("joinChallenge")}
            </Button>
          )}
          <Link to={`/challenges/${ch._id}`} className="ms-auto">
            <Button variant="ghost" size="sm">
              {t("challengeDetails")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MyChallengesStrip() {
  const { t, lang } = useLang();
  const mine = useQuery(api.engagement.myChallenges, {});
  if (mine === undefined || mine.length === 0) return null;
  return (
    <section className="mt-10 rounded-3xl border bg-card p-6">
      <h2 className="flex items-center gap-2 text-xl font-extrabold">
        <Flame className="size-5 text-primary" />
        {t("myChallenges")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("challengeProgressHint")}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((m: any) => (
          <Link
            key={m._id}
            to={`/challenges/${m.challengeId}`}
            className="rounded-2xl border bg-background p-4 transition-all hover:card-shadow-hover"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-bold">{lang === "ar" ? m.name : m.nameEn || m.name}</p>
              {m.completed ? (
                <Badge className="bg-green-600 text-white">✓</Badge>
              ) : (
                <StatusBadge status={m.status} />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {goalLabel(t, m.goalType, m.goalTarget)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <ProgressBar pct={m.target ? (m.progress / m.target) * 100 : 0} />
              <span className="shrink-0 text-xs font-bold tabular-nums text-primary">
                {Math.min(100, Math.round((m.progress / m.target) * 100))}%
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ChallengesInner() {
  const { t, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const challenges = useQuery(api.engagement.listChallenges, {});
  const joinChallenge = useMutation(api.engagement.joinChallenge);
  const leaveChallenge = useMutation(api.engagement.leaveChallenge);
  const [tab, setTab] = useState<Tab>("active");
  const [busy, setBusy] = useState(false);

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
      active: rows.filter((c: any) => c.status === "active").length,
      upcoming: rows.filter((c: any) => c.status === "upcoming").length,
      ended: rows.filter((c: any) => c.status === "ended").length,
    };
  }, [challenges]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: t("activeChallenges"), count: counts.active },
    { key: "upcoming", label: t("upcomingChallenges"), count: counts.upcoming },
    { key: "ended", label: t("endedChallenges"), count: counts.ended },
  ];

  const filtered = (challenges ?? []).filter((c: any) => c.status === tab);

  return (
    <div className="py-10">
      <SEO title={`${t("challenges")} | حكي`} />
      <div className="haki-container">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent">
            <Trophy className="size-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">{t("challenges")}</h1>
            <p className="text-sm text-muted-foreground">
              {lang === "ar"
                ? "تحديات استماع حقيقية — تقدمك يُحسب تلقائيًا من استماعك اليومي"
                : "Real listening challenges — progress counts automatically from your daily listening"}
            </p>
          </div>
        </div>

        <MyChallengesStrip />

        {/* Tabs */}
        <div className="mt-10 flex flex-wrap items-center gap-2">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-bold transition-all",
                tab === tb.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {tb.label}
              <span className="ms-1.5 rounded-full bg-black/10 px-1.5 text-xs tabular-nums">
                {tb.count}
              </span>
            </button>
          ))}
        </div>

        {challenges === undefined ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border bg-card p-12 text-center">
            <Trophy className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 font-bold">{t("noChallenges")}</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {filtered.map((ch: any) => (
              <ChallengeCard
                key={ch._id}
                ch={ch}
                joined={ch.joined}
                busy={busy}
                onJoin={handleJoin}
                onLeave={handleLeave}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Challenges() {
  return <ChallengesInner />;
}
