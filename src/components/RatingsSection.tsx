import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Star, Trash2, Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function Stars({
  value,
  size = "size-4",
  onPick,
}: {
  value: number;
  size?: string;
  onPick?: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          aria-label={`${n}`}
          onClick={() => onPick?.(n)}
          className={cn(onPick && "cursor-pointer transition-transform hover:scale-110")}
        >
          <Star
            className={cn(
              size,
              n <= value ? "fill-primary text-primary" : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function RatingsSection({ contentId }: { contentId: string }) {
  const { t, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const summary = useQuery(api.ratings.getSummary, { contentId: contentId as never });
  const reviews = useQuery(api.ratings.listForContent, { contentId: contentId as never });
  const mine = useQuery(api.ratings.getMine, { contentId: contentId as never });

  const submit = useMutation(api.moderation.submit);
  const removeMine = useMutation(api.ratings.remove);
  const reportReview = useMutation(api.moderation.report);

  const handleReport = async (ratingId: string) => {
    if (!isAuthenticated) {
      toast.error(L("سجّل الدخول للإبلاغ عن مراجعة", "Sign in to report a review"));
      return;
    }
    const reason = window.prompt(
      L("سبب الإبلاغ (اختياري)", "Reason for reporting (optional)"),
    ) ?? undefined;
    try {
      const res = await reportReview({ ratingId: ratingId as never, reason });
      if ((res as { duplicate?: boolean }).duplicate) {
        toast.info(L("بلّغت عن هذه المراجعة مسبقًا", "You already reported this review"));
      } else {
        toast.success(L("تم إرسال البلاغ لفريق الإشراف", "Report sent to moderation team"));
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const [picked, setPicked] = useState<number>(0);
  const [review, setReview] = useState("");
  const [saving, setSaving] = useState(false);

  const myValue = (mine as any)?.value ?? 0;
  const activeValue = picked || myValue;

  const handleSubmit = async () => {
    if (!activeValue) {
      toast.error(L("اختر عدد النجوم أولًا", "Pick a star rating first"));
      return;
    }
    setSaving(true);
    try {
      await submit({
        contentId: contentId as never,
        value: activeValue,
        review: review.trim() || undefined,
      });
      toast.success(L("شكرًا لتقييمك!", "Thanks for your rating!"));
      setPicked(0);
      setReview("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removeMine({ contentId: contentId as never });
      toast.success(L("تم حذف تقييمك", "Your rating was removed"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const formatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleDateString(lang === "ar" ? "ar" : "en", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <section className="mt-12">
      <h2 className="text-xl font-extrabold">{t("ratings")}</h2>

      {/* Summary + form */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Average */}
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-6 lg:col-span-1">
          <p className="text-4xl font-black tabular-nums">
            {summary ? (summary.count ? summary.average.toFixed(1) : "—") : "…"}
          </p>
          <Stars value={Math.round(summary?.average ?? 0)} />
          <p className="mt-2 text-xs text-muted-foreground">
            {summary?.count
              ? `${summary.count.toLocaleString(lang === "ar" ? "ar" : "en")} ${L("تقييم", "ratings")}`
              : L("لا تقييمات بعد", "No ratings yet")}
          </p>
        </div>

        {/* My rating form */}
        <div className="rounded-2xl border bg-card p-6 lg:col-span-4">
          {isAuthenticated ? (
            <>
              <p className="font-bold">
                {myValue
                  ? L("تقييمك", "Your rating")
                  : L("قيّم هذا العمل", "Rate this title")}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <Stars value={activeValue} size="size-6" onPick={setPicked} />
                {myValue > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="size-3.5" />
                    {L("حذف تقييمي", "Delete my rating")}
                  </Button>
                )}
              </div>
              <Textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder={L(
                  "اكتب مراجعتك (اختياري)…",
                  "Write your review (optional)…",
                )}
                className="mt-3 min-h-20"
                maxLength={500}
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{review.length}/500</p>
                <Button onClick={handleSubmit} disabled={saving} className="font-bold">
                  {saving ? "…" : L("إرسال التقييم", "Submit rating")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Stars value={Math.round(summary?.average ?? 0)} size="size-5" />
              <p className="text-sm text-muted-foreground">
                {L(
                  "سجّل الدخول لإضافة تقييمك ومراجعتك.",
                  "Sign in to add your rating and review.",
                )}
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="/auth">{t("signIn")}</a>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Reviews list */}
      {reviews && reviews.length > 0 && (
        <div className="mt-6 space-y-3">
          {reviews.map((r) => (
            <div key={r._id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  {r.userImage ? (
                    <AvatarImage src={r.userImage} alt="" loading="lazy" />
                  ) : null}
                  <AvatarFallback className="bg-accent text-xs font-bold text-accent-foreground">
                    {r.userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{r.userName}</p>
                  <div className="flex items-center gap-2">
                    <Stars value={r.value} size="size-3" />
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(r.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReport(r._id)}
                      className="ms-auto flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Flag className="size-3" />
                      {L("إبلاغ", "Report")}
                    </button>
                  </div>
                </div>
              </div>
              {r.review && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {r.review}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
