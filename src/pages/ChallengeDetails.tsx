import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
  ArrowRight,
  CalendarDays,
  Crown,
  Flame,
  Gift,
  Medal,
  Trophy,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { GoalPill, ProgressBar, StatusBadge } from "@/pages/Challenges";

function rankIcon(i: number) {
  if (i === 0) return <Crown className="size-5 text-amber-500" />;
  if (i === 1) return <Medal className="size-5 text-slate-400" />;
  if (i === 2) return <Medal className="size-5 text-orange-700" />;
  return <span className="w-5 text-center text-sm font-black tabular-nums text-muted-foreground">{i + 1}</span>;
}

export default function ChallengeDetails() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const challengeId = id as Id<"challenges"> | undefined;
  const details = useQuery(
    api.engagement.challengeDetails,
    challengeId ? { id: challengeId } : "skip",
  );
  const joinChallenge = useMutation(api.engagement.joinChallenge);
  const leaveChallenge = useMutation(api.engagement.leaveChallenge);
  const [busy, setBusy] = useState(false);

  if (!id || details === null) {
    return (
      <div className="py-24 text-center">
        <Trophy className="mx-auto size-10 text-muted-foreground/40" />
        <p className="mt-4 font-bold">{t("noChallenges")}</p>
        <Link to="/challenges" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowRight className="size-4" />
            {t("challenges")}
          </Button>
        </Link>
      </div>
    );
  }

  if (details === undefined) {
    return (
      <div className="haki-container py-10">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="mt-6 h-96 rounded-3xl" />
      </div>
    );
  }

  const ch = details as any;
  const days = Math.max(
    0,
    Math.round((new Date(ch.endDate).getTime() - Date.now()) / 86400000),
  );
  const pct = Math.min(100, Math.round((ch.myProgress / Math.max(ch.goalTarget, 1)) * 100));

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

  return (
    <div className="py-10">
      <SEO title={`${lang === "ar" ? ch.name : ch.nameEn || ch.name} | حكي`} />
      <div className="haki-container">
        <Link
          to="/challenges"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowRight className="size-4" />
          {t("challenges")}
        </Link>

        {/* Hero */}
        <div className="mt-4 overflow-hidden rounded-3xl border bg-card">
          {ch.image && (
            <div className="relative h-52 w-full overflow-hidden sm:h-64">
              <img src={ch.image} alt="" className="size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute bottom-4 start-6 flex flex-wrap items-center gap-2">
                <StatusBadge status={ch.status} />
                {ch.status === "active" && (
                  <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                    <Flame className="size-3.5 text-amber-400" />
                    {days} {t("days")}
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-black sm:text-3xl">
                  {lang === "ar" ? ch.name : ch.nameEn || ch.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {ch.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ch.status === "ended" ? (
                  <Button variant="outline" disabled>
                    {t("ended")}
                  </Button>
                ) : ch.joined ? (
                  <>
                    <Badge variant="secondary" className="gap-1 px-3 py-1.5">
                      <Trophy className="size-3.5 text-primary" />
                      {t("joined")}
                    </Badge>
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
                ) : (
                  <Button className="font-bold" disabled={busy} onClick={handleJoin}>
                    <Trophy className="size-4" />
                    {t("joinChallenge")}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <GoalPill goalType={ch.goalType} target={ch.goalTarget} />
              {ch.reward && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-3 py-1 text-xs font-bold text-accent-foreground">
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
                {ch.startDate} ← {ch.endDate}
              </span>
            </div>

            {/* My progress */}
            {ch.joined && (
              <div className="mt-6 rounded-2xl border bg-background p-5">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 font-extrabold">
                    <Flame className="size-4 text-primary" />
                    {t("yourProgress")}
                  </p>
                  <span className="text-sm font-black tabular-nums text-primary">
                    {ch.completedAt ? `✓ ${t("completedChallenge")}` : `${ch.myProgress} / ${ch.goalTarget}`}
                  </span>
                </div>
                <ProgressBar pct={pct} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">{t("challengeProgressHint")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <Medal className="size-5 text-amber-500" />
            {t("leaderboard")}
          </h2>
          {ch.leaderboard.length === 0 ? (
            <div className="mt-4 rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
              {lang === "ar"
                ? "لا مشاركين بعد — كن أول المنضمين وتصدّر اللوحة!"
                : "No participants yet — be the first and top the board!"}
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
              {ch.leaderboard.map((row: any, i: number) => (
                <div
                  key={row.userId}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3.5",
                    i > 0 && "border-t",
                    i < 3 && "bg-accent/30",
                  )}
                >
                  {rankIcon(i)}
                  <Avatar className="size-9">
                    <AvatarImage src={row.image} alt={row.name} />
                    <AvatarFallback className="text-xs">{row.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {row.name}
                      {row.completed && (
                        <span className="ms-2 text-xs font-semibold text-green-600">✓</span>
                      )}
                    </p>
                    <div className="mt-1 max-w-xs">
                      <ProgressBar pct={(row.progress / Math.max(ch.goalTarget, 1)) * 100} className="h-1.5" />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                    {row.completed
                      ? t("completedChallenge")
                      : `${row.progress} / ${ch.goalTarget}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
