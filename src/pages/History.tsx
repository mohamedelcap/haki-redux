import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard } from "@/components/ContentCard";
import { RequireAuth } from "@/components/RequireAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime, useLang } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { History } from "lucide-react";

function HistoryInner() {
  const { lang, t } = useLang();
  const history = useQuery(api.library.myHistory, { limit: 50 });

  return (
    <div className="py-10">
      <SEO title={`${t("listenHistory")} | حكي`} />
      <div className="haki-container">
        <h1 className="text-2xl font-black sm:text-3xl">{t("listenHistory")}</h1>

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
