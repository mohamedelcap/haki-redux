import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Check, EyeOff, Eye, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Community moderation queue: reported reviews with hide / delete / resolve.
 */
export function ModerationManager({ L }: { L: (ar: string, en: string) => string }) {
  const reports = useQuery(api.moderation.listPendingReports, {});
  const setHidden = useMutation(api.moderation.setHidden);
  const adminDelete = useMutation(api.moderation.adminDelete);
  const resolveReport = useMutation(api.moderation.resolveReport);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>, msg: { ar: string; en: string }) => {
    setBusy(msg.ar);
    try {
      await fn();
      toast.success(L(msg.ar, msg.en));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-black">{L("إشراف المجتمع", "Community moderation")}</h2>

      {reports === undefined ? (
        <Skeleton className="mt-6 h-48 rounded-2xl" />
      ) : reports.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{L("لا بلاغات معلّقة", "No pending reports")}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {reports.map((r) => (
            <div key={r._id} className="rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{"★".repeat(r.value)}</Badge>
                    <p className="text-sm font-bold">{r.reviewerName}</p>
                    <span className="text-xs text-muted-foreground">
                      {L("في عمل:", "on")} «{r.contentTitle}»
                    </span>
                    {r.isHidden && (
                      <Badge className="bg-amber-100 text-amber-700">{L("مخفي", "Hidden")}</Badge>
                    )}
                  </div>
                  {r.reviewText && (
                    <p className="mt-2 max-w-xl text-sm text-muted-foreground">“{r.reviewText}”</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {L("المُبلِّغ:", "Reported by:")} {r.reporterName}
                    {r.reason ? ` · ${r.reason}` : ""}
                    {" · "}
                    {new Date(r.createdAt).toLocaleDateString("ar")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      act(
                        () => setHidden({ ratingId: r.ratingId, hidden: !r.isHidden }),
                        r.isHidden
                          ? { ar: "أُظهرت المراجعة", en: "Review unhidden" }
                          : { ar: "أُخفيّت المراجعة", en: "Review hidden" },
                      )
                    }
                    className="gap-1"
                  >
                    {r.isHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    {r.isHidden ? L("إظهار", "Unhide") : L("إخفاء", "Hide")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      act(
                        () => adminDelete({ ratingId: r.ratingId }),
                        { ar: "حُذفت المراجعة نهائيًا", en: "Review deleted" },
                      )
                    }
                    className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    {L("حذف", "Delete")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() =>
                      act(
                        () => resolveReport({ reportId: r._id }),
                        { ar: "أُغلق البلاغ", en: "Report resolved" },
                      )
                    }
                    className="gap-1 bg-green-600 text-white hover:bg-green-700"
                  >
                    {busy === r._id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    {L("إغلاق البلاغ", "Resolve")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
