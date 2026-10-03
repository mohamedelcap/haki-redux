import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard } from "@/components/ContentCard";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, useLang } from "@/lib/i18n";
import { useMutation, useQuery } from "convex/react";
import { History, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function HistoryInner() {
  const { lang, t } = useLang();
  const [limit, setLimit] = useState(50);
  const [confirmClear, setConfirmClear] = useState(false);
  const history = useQuery(api.library.myHistory, { limit });
  const clearHistory = useMutation(api.library.clearMyHistory);

  // Auto-cancel the "clear" confirmation after 5s.
  useEffect(() => {
    if (!confirmClear) return;
    const id = window.setTimeout(() => setConfirmClear(false), 5000);
    return () => window.clearTimeout(id);
  }, [confirmClear]);

  return (
    <div className="py-10">
      <SEO title={`${t("listenHistory")} | حكي`} />
      <div className="haki-container">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black sm:text-3xl">{t("listenHistory")}</h1>
          {history !== undefined && history.length > 0 && (
            <Button
              variant={confirmClear ? "destructive" : "outline"}
              size="sm"
              className="gap-1.5 font-bold"
              onClick={async () => {
                if (!confirmClear) {
                  setConfirmClear(true);
                  return;
                }
                try {
                  await clearHistory({});
                  toast.success(lang === "ar" ? "تم مسح سجل الاستماع" : "History cleared");
                } catch (e: any) {
                  toast.error(e.message);
                } finally {
                  setConfirmClear(false);
                }
              }}
            >
              <Trash2 className="size-3.5" />
              {confirmClear
                ? lang === "ar"
                  ? "اضغط للتأكيد"
                  : "Click to confirm"
                : lang === "ar"
                  ? "مسح السجل"
                  : "Clear history"}
            </Button>
          )}
        </div>

        {history === undefined ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <History className="size-12 text-muted-foreground/50" />
            <p className="text-lg font-bold">{t("listenHistory")}</p>
            <p className="text-sm text-muted-foreground">
              {lang === "ar"
                ? "لم تستمع لأي محتوى بعد — ابدأ الآن!"
                : "You haven't listened to anything yet — start now!"}
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {history.map((row) => (
              <div key={row._id}>
                <ContentCard item={row.content as any} />
                <p className="mt-1.5 text-[11px] text-muted-foreground" dir="ltr">
                  {formatTime(row.position)}
                  {row.duration > 0 && ` / ${formatTime(row.duration)}`}
                </p>
              </div>
            ))}
          </div>
        )}

        {history !== undefined && history.length >= limit && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              className="font-bold"
              onClick={() => setLimit((l) => l + 50)}
            >
              {lang === "ar" ? "عرض المزيد" : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <RequireAuth
      title="سجّل الدخول لعرض سجل الاستماع"
      description="سجل استماعك متاح للمستخدمين المسجلين."
    >
      <HistoryInner />
    </RequireAuth>
  );
}
