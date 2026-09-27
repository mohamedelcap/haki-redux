import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/lib/i18n";
import { useQuery } from "convex/react";
import { BarChart3, Coins, Flame, Users } from "lucide-react";

function MiniLineChart({
  series,
  color = "#F97316",
  height = 120,
}: {
  series: { date: string; v: number }[];
  color?: string;
  height?: number;
}) {
  if (series.length === 0) return null;
  const max = Math.max(...series.map((s) => s.v), 1);
  const w = 600;
  const pts = series.map((s, i) => {
    const x = (i / Math.max(series.length - 1, 1)) * w;
    const y = height - (s.v / max) * (height - 16) - 8;
    return `${x},${y}`;
  });
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-28 w-full" preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={w} cy={height - (series[series.length - 1].v / max) * (height - 16) - 8} r={4} fill={color} />
    </svg>
  );
}

function BarsChart({ items, color = "#F97316" }: { items: { label: string; v: number }[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.v), 1);
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-xs font-semibold" title={i.label}>
            {i.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(i.v / max) * 100}%`, background: color }}
            />
          </div>
          <span className="w-12 text-end text-xs font-bold tabular-nums">{i.v}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPanel() {
  const { lang } = useLang();
  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  const listening = useQuery(api.analytics.dailyListening, {});
  const growth = useQuery(api.analytics.userGrowth, {});
  const top = useQuery(api.analytics.topContent, {});
  const dist = useQuery(api.analytics.typeDistribution, {});
  const rev = useQuery(api.analytics.revenue, {});

  const TYPE_LABEL: Record<string, { ar: string; en: string }> = {
    audiobook: { ar: "كتاب صوتي", en: "Audiobook" },
    ebook: { ar: "كتاب إلكتروني", en: "E-book" },
    drama: { ar: "دراما", en: "Drama" },
    microdrama: { ar: "دراما قصيرة", en: "Microdrama" },
    podcast: { ar: "بودكاست", en: "Podcast" },
    magazine: { ar: "مجلة", en: "Magazine" },
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black">{L("التحليلات", "Analytics")}</h2>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{L("إيراد شهري تقديري", "Est. monthly revenue")}</p>
              <p className="mt-1 text-2xl font-black">{rev === undefined ? "…" : rev.mrr.toLocaleString()}</p>
            </div>
            <Coins className="size-8 text-primary/30" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{L("اشتراكات نشطة", "Active subscriptions")}</p>
              <p className="mt-1 text-2xl font-black">{rev === undefined ? "…" : rev.activeCount}</p>
            </div>
            <BarChart3 className="size-8 text-primary/30" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{L("مستخدمون", "Users")}</p>
              <p className="mt-1 text-2xl font-black">{growth === undefined ? "…" : growth.total}</p>
            </div>
            <Users className="size-8 text-primary/30" />
          </div>
        </Card>
      </div>

      {/* Daily listening */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold">{L("دقائق الاستماع اليومية (30 يومًا)", "Daily listening minutes (30 days)")}</h3>
          <Badge variant="secondary" className="gap-1">
            <Flame className="size-3" />
            {L("آخر 30 يومًا", "Last 30 days")}
          </Badge>
        </div>
        {listening === undefined ? (
          <Skeleton className="mt-4 h-28 w-full" />
        ) : (
          <MiniLineChart series={listening.map((d) => ({ date: d.date, v: d.minutes }))} />
        )}
      </Card>

      {/* User growth */}
      <Card className="p-5">
        <h3 className="font-extrabold">{L("نمو المستخدمين الجدد (30 يومًا)", "New user growth (30 days)")}</h3>
        {growth === undefined ? (
          <Skeleton className="mt-4 h-28 w-full" />
        ) : (
          <MiniLineChart series={growth.series.map((d) => ({ date: d.date, v: d.count }))} color="#0EA5E9" />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top content */}
        <Card className="p-5">
          <h3 className="font-extrabold">{L("الأعمال الأكثر استماعًا", "Most played content")}</h3>
          {top === undefined ? (
            <Skeleton className="mt-4 h-40 w-full" />
          ) : top.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{L("لا بيانات بعد", "No data yet")}</p>
          ) : (
            <div className="mt-4">
              <BarsChart
                items={top.map((c) => ({ label: c.title, v: c.playCount }))}
              />
            </div>
          )}
        </Card>

        {/* Type distribution */}
        <Card className="p-5">
          <h3 className="font-extrabold">{L("توزيع أنواع المحتوى المنشور", "Published content-type distribution")}</h3>
          {dist === undefined ? (
            <Skeleton className="mt-4 h-40 w-full" />
          ) : dist.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{L("لا بيانات بعد", "No data yet")}</p>
          ) : (
            <div className="mt-4">
              <BarsChart
                items={dist.map((d) => ({
                  label: L(TYPE_LABEL[d.type]?.ar ?? d.type, TYPE_LABEL[d.type]?.en ?? d.type),
                  v: d.count,
                }))}
                color="#10B981"
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
