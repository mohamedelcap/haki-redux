import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { CalendarClock, Clock, Mic, Pause, Play, Radio, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const SCHEDULE = [
  { day: "السبت", name: "قهوة الصباح", host: "مصطفى سعد", start: "08:00", end: "09:00" },
  { day: "الأحد", name: "حكي مسموع", host: "هالة عياد", start: "18:00", end: "19:30" },
  { day: "الاثنين", name: "مساء حكي", host: "عمر الهاشمي", start: "20:00", end: "22:00" },
  { day: "الثلاثاء", name: "سر الفراشة — دراما", host: "نورة الشامسي", start: "21:00", end: "22:00" },
  { day: "الأربعاء", name: "البودكاست العكسي", host: "ياسر الشريف", start: "19:00", end: "20:30" },
  { day: "الخميس", name: "حكايات ما أحلوها", host: "ليان المطيري", start: "17:00", end: "18:00" },
  { day: "الجمعة", name: "قراءات مسائية", host: "سلمى الأيوبي", start: "21:00", end: "23:00" },
];

function Countdown({ startHHMM }: { startHHMM?: string }) {
  const c = useNextSessionCountdown(startHHMM);
  const { lang } = useLang();
  if (!c) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        {lang === "ar" ? "لا يوجد موعد محدد بعد" : "No scheduled time yet"}
      </p>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-2" dir="ltr">
      {[
        [c.hh, "HR"],
        [c.mm, "MIN"],
        [c.ss, "SEC"],
      ].map(([v, l]) => (
        <span
          key={l}
          className="flex min-w-14 flex-col items-center rounded-xl border bg-secondary px-2 py-1.5"
        >
          <span className="text-lg font-black tabular-nums">{v}</span>
          <span className="text-[9px] font-bold text-muted-foreground">{l}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Safe embed player: the URL is validated client-side AND was sanitized
 * server-side on save (youtube.com / youtube-nocookie.com / player.twitch.tv).
 */
function SafeEmbed({ url, title }: { url: string; title: string }) {
  let src: string | null = null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const ok =
      u.protocol === "https:" &&
      (host === "youtube.com" ||
        host === "youtube-nocookie.com" ||
        host === "m.youtube.com" ||
        host === "player.twitch.tv");
    src = ok ? u.toString() : null;
  } catch {
    src = null;
  }
  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border bg-background/80 text-sm text-muted-foreground">
        رابط التضمين غير مدعوم
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border bg-black" dir="ltr">
      <iframe
        src={src}
        title={title}
        className="aspect-video w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
    </div>
  );
}

/** Countdown to the next scheduled session ("HH:MM" today or tomorrow). */
function useNextSessionCountdown(startHHMM?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    if (!startHHMM || !/^\d{1,2}:\d{2}$/.test(startHHMM)) return null;
    const [h, m] = startHHMM.split(":").map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= now) target.setDate(target.getDate() + 1);
    let diff = Math.max(0, target.getTime() - now);
    const hh = Math.floor(diff / 3600000);
    diff -= hh * 3600000;
    const mm = Math.floor(diff / 60000);
    diff -= mm * 60000;
    const ss = Math.floor(diff / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return { hh: pad(hh), mm: pad(mm), ss: pad(ss) };
  }, [startHHMM, now]);
}

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
          "relative inline-flex rounded-full bg-red-500 shadow-[0_0_6px_1px_rgba(239,68,68,0.55)]",
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

              {/* Live player: real embed if available, otherwise countdown */}
              {current.embedUrl ? (
                <div className="mt-6 max-w-2xl">
                  <SafeEmbed url={current.embedUrl} title={current.title} />
                </div>
              ) : (
                <div className="mt-6 max-w-md rounded-2xl border bg-background/90 p-4 backdrop-blur">
                  <p className="text-sm font-bold">{L("يبدأ البث خلال", "Stream begins in")}</p>
                  <Countdown startHHMM={current.scheduledStart} />
                </div>
              )}
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
