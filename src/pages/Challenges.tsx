import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, Gift, Trophy, Users } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Challenges() {
  const { lang, t } = useLang();
  const { isAuthenticated } = useAuth();
  const challenges = useQuery(api.engagement.listChallenges, {});
  const joinChallenge = useMutation(api.engagement.joinChallenge);

  const handleJoin = async (id: string) => {
    if (!isAuthenticated) {
      toast.error(lang === "ar" ? "سجّل الدخول للمشاركة" : "Sign in to join");
      return;
    }
    try {
      await joinChallenge({ challengeId: id as any });
      toast.success(lang === "ar" ? "انضممت للتحدي! 🏆" : "You joined the challenge! 🏆");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const statusBadge = (status: string) => {
    const map = {
      active: { label: t("active"), cls: "bg-green-600 text-white" },
      upcoming: { label: t("upcoming"), cls: "bg-blue-600 text-white" },
      ended: { label: t("ended"), cls: "bg-muted text-muted-foreground" },
    } as const;
    const s = map[status as keyof typeof map] ?? map.active;
    return <Badge className={cn("font-semibold", s.cls)}>{s.label}</Badge>;
  };

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
                ? "شارك في التحديات واربح مكافآت حصرية"
                : "Join challenges and win exclusive rewards"}
            </p>
          </div>
        </div>

        {challenges === undefined ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {challenges.map((ch) => {
              const days = Math.max(
                0,
                Math.round(
                  (new Date(ch.endDate).getTime() - Date.now()) / 86400000,
                ),
              );
              return (
                <div
                  key={ch._id}
                  className={cn(
                    "rounded-2xl border bg-card p-6 transition-all card-shadow hover:card-shadow-hover",
                    ch.status === "active" && "border-primary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-extrabold">
                      {lang === "ar" ? ch.name : ch.nameEn}
                    </h2>
                    {statusBadge(ch.status)}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {ch.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {ch.startDate} ← {ch.endDate}
                    </span>
                    {ch.status === "active" && (
                      <span>
                        {days} {t("days")}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {ch.participants.toLocaleString(lang === "ar" ? "ar" : "en")} {t("participants")}
                    </span>
                  </div>

                  {ch.reward && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent/60 px-3 py-2 text-xs font-semibold text-accent-foreground">
                      <Gift className="size-3.5" />
                      {t("reward")}: {ch.reward}
                    </div>
                  )}

                  <div className="mt-5 flex items-center gap-2">
                    {ch.status !== "ended" ? (
                      <Button className="font-bold" onClick={() => handleJoin(ch._id)}>
                        {t("join")}
                      </Button>
                    ) : (
                      <Button variant="outline" disabled>
                        {t("ended")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
