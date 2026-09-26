import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { CalendarClock, Clock, Mic, Pause, Play, Radio, Users } from "lucide-react";
import { useState } from "react";

const SCHEDULE = [
  { day: "السبت", name: "قهوة الصباح", host: "مصطفى سعد", start: "08:00", end: "09:00" },
  { day: "الأحد", name: "حكي مسموع", host: "هالة عياد", start: "18:00", end: "19:30" },
  { day: "الاثنين", name: "مساء حكي", host: "عمر الهاشمي", start: "20:00", end: "22:00" },
  { day: "الثلاثاء", name: "سر الفراشة — دراما", host: "نورة الشامسي", start: "21:00", end: "22:00" },
  { day: "الأربعاء", name: "البودكاست العكسي", host: "ياسر الشريف", start: "19:00", end: "20:30" },
  { day: "الخميس", name: "حكايات ما أحلوها", host: "ليان المطيري", start: "17:00", end: "18:00" },
  { day: "الجمعة", name: "قراءات مسائية", host: "سلمى الأيوبي", start: "21:00", end: "23:00" },
];

/** نقطة LIVE نابضة — تضيء وتنطفئ كالبث الحي، تُعرض فوق العنوان. */
export function LiveDot({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "size-3.5" : size === "sm" ? "size-2" : "size-2.5";
  return (
    <span className="relative inline-flex" dir="ltr">
      {/* هالة النبض المنتشرة */}
      <span
        className={cn(
          "absolute inline-flex size-full rounded-full bg-red-500 opacity-70",
          "animate-ping [animation-duration:1.4s]",
          dim,
        )}
      />
      {/* نبضة ثانية أبطأ لعمق الوميض */}
      <span
        className={cn(
          "absolute inline-flex rounded-full bg-red-500 opacity-40",
          "animate-ping [animation-duration:2.4s] [animation-delay:0.5s]",
          dim,
        )}
      />
      {/* النواة الصلبة — تضيء وتخفت */}
      <span
        className={cn(
          "relative inline-flex rounded-full bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.65)]",
          "animate-pulse [animation-duration:1.4s]",
          dim,
        )}
      />
    </span>
  );
}

export default function Live() {
  const { lang, t } = useLang();
  const streams = useQuery(api.engagement.listLiveStreams, {});
  const current = useQuery(api.engagement.getCurrentLive, {});
  const [isPlaying, setIsPlaying] = useState(false);

  const L = (ar: string, en: string) => (lang === "ar" ? ar : en);

  return (
    <div className="py-10">
      <SEO title={`${t("live")} | حكي`} />
      <div className="haki-container">
        <div className="relative flex items-center gap-3">
          {/* النقطة الحمراء النابضة فوق كلمة بث مباشر */}
          <div className="absolute -top-4 start-0 flex items-center gap-1.5">
            <LiveDot size="sm" />
            {current && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-600">
                {L("على الهواء الآن", "ON AIR")}
              </span>
            )}
          </div>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent">
            <Radio className="size-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">{t("live")}</h1>
            <p className="text-sm text-muted-foreground">
              {L("برامج مباشرة على مدار الأسبوع", "Live programs all week long")}
            </p>
          </div>
        </div>

        {/* Current live */}
        {streams === undefined ? (
          <Skeleton className="mt-10 h-64 rounded-3xl" />
        ) : current ? (
          <div className="mt-10 overflow-hidden rounded-3xl border bg-card card-shadow">
            <div
              className="relative bg-gradient-to-l from-primary/20 via-accent/30 to-transparent bg-cover bg-center p-8 sm:p-12"
              style={
                current.image
                  ? {
                      backgroundImage: `linear-gradient(to left, rgba(255,255,255,0.96), rgba(255,255,255,0.88)), url(${current.image})`,
                    }
                  : undefined
              }
            >
              <Badge className="gap-1.5 bg-red-600 px-3 py-1.5 text-white hover:bg-red-600">
                <LiveDot size="sm" />
                {t("onAirNow")}
              </Badge>
              <h2 className="mt-4 text-2xl font-black sm:text-3xl">{current.title}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {current.description}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <Mic className="size-4 text-primary" />
                  <span className="font-semibold">{current.hostName}</span>
                </span>
                {current.scheduledStart && (
                  <span className="text-muted-foreground">
                    {current.scheduledStart} - {current.scheduledEnd}
                  </span>
                )}
                {current.listeners > 0 && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-4" />
                    {current.listeners.toLocaleString(lang === "ar" ? "ar" : "en")}
                  </span>
                )}
              </div>

              {/* Live player */}
              <div className="mt-6 flex max-w-md items-center gap-3 rounded-2xl border bg-background/90 p-3 backdrop-blur">
                <Button
                  size="icon"
                  className="rounded-full"
                  aria-label={isPlaying ? t("pause") : t("listenNow")}
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <div className="flex-1">
                  <p className="text-sm font-bold">{L("البث المباشر", "Live stream")}</p>
                  <div className="mt-1.5 flex items-center gap-1" aria-hidden="true">
                    {[3, 7, 5, 9, 4, 8, 6, 10, 5, 7, 4, 8, 6, 3].map((h, i) => (
                      <span
                        key={i}
                        className={cn(
                          "w-1 rounded-full bg-primary transition-all",
                          isPlaying && "animate-pulse",
                        )}
                        style={{ height: isPlaying ? h * 2.2 : 5 }}
                      />
                    ))}
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-black text-red-600">
                  <LiveDot size="sm" />
                  LIVE
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {L(
                  "سيتم ربط المشغل بخدمة البث (HLS/ICE) عند توفر رابط البث.",
                  "The player will be connected to a streaming service (HLS/ICE) once a stream URL is provided.",
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border bg-secondary p-12 text-center">
            <Radio className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-4 text-lg font-bold">{t("noLiveNow")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {L("تصفح جدول البرامج لمعرفة الموعد القادم", "Check the schedule for the next program")}
            </p>
          </div>
        )}

        {/* Other streams */}
        {streams && streams.filter((s) => !s.isLive).length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-extrabold">{L("برامج قادمة", "Upcoming streams")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {streams
                .filter((s) => !s.isLive)
                .map((s) => (
                  <div key={s._id} className="overflow-hidden rounded-2xl border bg-card card-shadow transition-all hover:card-shadow-hover">
                    {s.image && (
                      <div className="relative h-32 w-full overflow-hidden">
                        <img src={s.image} alt="" loading="lazy" className="size-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <span className="absolute bottom-2 end-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                          <CalendarClock className="size-3" />
                          {s.scheduledStart}
                        </span>
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-bold">{s.title}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mic className="size-3.5 text-primary" />
                        {s.hostName}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        {s.scheduledStart} - {s.scheduledEnd}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Schedule */}
        <section className="mt-12">
          <h2 className="text-lg font-extrabold">{t("programSchedule")}</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b bg-secondary/60 text-start text-xs text-muted-foreground">
                    <th className="p-3.5 text-start font-semibold">{L("اليوم", "Day")}</th>
                    <th className="p-3.5 text-start font-semibold">{L("البرنامج", "Program")}</th>
                    <th className="p-3.5 text-start font-semibold">{t("host")}</th>
                    <th className="p-3.5 text-start font-semibold">{t("startsAt")}</th>
                    <th className="p-3.5 text-start font-semibold">{t("endsAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE.map((row) => (
                    <tr key={row.day} className="border-b last:border-0 transition-colors hover:bg-muted/50">
                      <td className="p-3.5 font-bold">{row.day}</td>
                      <td className="p-3.5">{row.name}</td>
                      <td className="p-3.5 text-muted-foreground">{row.host}</td>
                      <td className="p-3.5 tabular-nums" dir="ltr">{row.start}</td>
                      <td className="p-3.5 tabular-nums" dir="ltr">{row.end}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
