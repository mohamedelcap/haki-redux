import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard, ContentTypeIcon, SectionRow, TYPE_LABELS } from "@/components/ContentCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { usePlayer, demoAudioUrl } from "@/lib/player";
import { LOGO_COVER } from "@/lib/logoAsset";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BookOpen,
  Headphones,
  Mic,
  Newspaper,
  Podcast,
  Radio,
  Sparkles,
  Theater,
} from "lucide-react";
import { Link } from "react-router";

const FALLBACK_COVER = LOGO_COVER;

const SECTIONS = [
  { type: "ebook", icon: BookOpen, href: "/browse/ebooks", desc: { ar: "اقرأ أحدث الإصدارات الرقمية", en: "Read the latest digital releases" } },
  { type: "audiobook", icon: Headphones, href: "/browse/audiobooks", desc: { ar: "استمع لأفضل الكتب بصوت أهلها", en: "Listen to the best narrated books" } },
  { type: "audio_drama", icon: Theater, href: "/browse/drama", desc: { ar: "أعمال درامية بأصوات ممثلين", en: "Dramatic works with full casts" } },
  { type: "micro_drama", icon: Mic, href: "/browse/micro-drama", desc: { ar: "قصص قصيرة تُكمل في جلسة", en: "Short stories in one sitting" } },
  { type: "podcast", icon: Podcast, href: "/browse/podcast", desc: { ar: "برامج حوارية ومعرفية", en: "Talk and knowledge shows" } },
  { type: "magazine", icon: Newspaper, href: "/browse/magazines", desc: { ar: "أعداد شهرية بالصوت والصورة", en: "Monthly issues in audio" } },
  { type: "live", icon: Radio, href: "/live", desc: { ar: "برامج على الهواء مع مستمعينا", en: "On-air shows with listeners" } },
] as const;

export default function Home() {
  const { lang, t } = useLang();
  const { play } = usePlayer();
  const { isAuthenticated } = useAuth();
  // Homepage sections come from the database (managed in the admin dashboard).
  const dynamicSections = useQuery(api.homepage.getPublicSections, {});
  const recommendations = useQuery(api.recommend.recommendForUser, { limit: 12 });
  const live = useQuery(api.engagement.getCurrentLive, {});
  const continueList = useQuery(
    api.library.continueListening,
    isAuthenticated ? {} : "skip",
  );

  const handlePlay = (item: { _id: any; title: any; coverImage: any; authorName: any; narratorName: any }) => {
    play({
      contentId: item._id,
      title: item.title,
      coverImage: item.coverImage,
      authorName: item.authorName,
      narratorName: item.narratorName,
      audioUrl: demoAudioUrl(item._id),
      startOffset: 0,
    });
  };

  return (
    <div>
      <SEO
        title={lang === "ar" ? "حكي | HAKI — منصة المحتوى الصوتي والرقمي" : "HAKI — Arabic audio & digital content"}
        description={t("heroSubtitle")}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: lang === "ar" ? "حكي" : "HAKI",
          potentialAction: {
            "@type": "SearchAction",
            target: "/search?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />

      {/* ============ Hero ============ */}
      <section className="hero-gradient border-b">
        <div className="haki-container grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge variant="secondary" className="mb-5 gap-1.5 border-border bg-background px-3 py-1.5 text-xs font-semibold">
              <Sparkles className="size-3.5 text-primary" />
              {lang === "ar" ? "منصة عربية للمحتوى الصوتي والرقمي" : "The Arabic audio & digital platform"}
            </Badge>
            <h1 className="text-balance text-4xl font-black leading-[1.15] sm:text-5xl lg:text-6xl">
              {lang === "ar" ? (
                <>
                  اقرأ، استمع
                  <br />
                  وعش المحتوى
                  <br />
                  مع <span className="text-primary">حكي</span>
                </>
              ) : (
                <>
                  Read, listen, and live
                  <br />
                  the content — <span className="text-primary">HAKI</span>
                </>
              )}
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-7 text-base font-bold shadow-lg shadow-primary/25">
                  {t("startFree")}
                </Button>
              </Link>
              <Link to="/browse">
                <Button size="lg" variant="outline" className="h-12 bg-background px-7 text-base font-bold">
                  {t("browseLibrary")}
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Headphones className="size-4 text-primary" /> +500 {lang === "ar" ? "كتاب صوتي" : "audiobooks"}
              </span>
              <span className="flex items-center gap-1.5">
                <Mic className="size-4 text-primary" /> +40 {lang === "ar" ? "برنامجًا وحلقة" : "shows and episodes"}
              </span>
            </div>
          </div>

          {/* Floating covers collage — real covers linking to their pages */}
          <div className="relative hidden lg:block" aria-hidden="false">
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2].map((col) => (
                <div key={col} className={cn("space-y-4", col === 1 && "translate-y-6", col === 2 && "translate-y-12")}>
                  {[0, 1].map((row) => {
                    const item = dynamicSections?.[0]?.items[(col * 2 + row) % Math.max(dynamicSections?.[0]?.items.length ?? 1, 1)];
                    if (!item) return <div key={row} className="aspect-[3/4] rounded-2xl bg-muted" />;
                    return (
                      <Link
                        key={row}
                        to={`/content/${item.slug}`}
                        className="group block overflow-hidden rounded-2xl border card-shadow transition-transform hover:-translate-y-1"
                        aria-label={item.title}
                      >
                        <img
                          src={item.coverImage || FALLBACK_COVER}
                          alt={item.title}
                          loading="lazy"
                          className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ Explore sections ============ */}
      <section className="py-14">
        <div className="haki-container">
          <h2 className="text-2xl font-extrabold sm:text-3xl">{t("exploreSections")}</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
            {SECTIONS.map((s) => (
              <Link
                key={s.type}
                to={s.href}
                className="group rounded-2xl border bg-card p-4 transition-all card-shadow hover:card-shadow-hover hover:-translate-y-0.5"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform group-hover:scale-110">
                  <s.icon className="size-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold">{TYPE_LABELS[s.type][lang]}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {s.desc[lang]}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Dynamic sections from the database ============ */}
      {dynamicSections?.map((section) => (
        <SectionRow
          key={section.key}
          title={lang === "ar" ? section.titleAr : section.titleEn}
          items={section.items}
          moreHref={section.moreHref}
        />
      ))}
      {dynamicSections === undefined && (
        <>
          <SectionSkeleton /> <SectionSkeleton /> <SectionSkeleton />
        </>
      )}

      {/* ============ Suggested for you (personalized or most-played) ============ */}
      {recommendations !== undefined && recommendations.items.length > 0 && (
        <section className="py-6">
          <div className="haki-container">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="text-xl font-extrabold sm:text-2xl">
                {recommendations.personalized
                  ? lang === "ar" ? "مقترح لك" : "Suggested for you"
                  : lang === "ar" ? "الأكثر استماعًا على حكي" : "Most listened on HAKI"}
              </h2>
            </div>
            <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-2">
              {recommendations.items.map((item) => (
                <ContentCard key={item._id} item={item} className="w-40 shrink-0 sm:w-44" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ Continue listening (signed-in only) ============ */}
      {isAuthenticated && continueList && continueList.length > 0 && (
        <section className="py-6">
          <div className="haki-container">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold sm:text-2xl">
                {lang === "ar" ? "أكمل الاستماع" : "Continue listening"}
              </h2>
              <Link
                to="/history"
                className="text-sm font-semibold text-primary hover:underline"
              >
                {t("viewAll")}
              </Link>
            </div>
            <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-2">
              {continueList.map((row) => (
                <div key={row._id} className="w-44 shrink-0">
                  <ContentCard item={row.content as any} />
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, (row.position / Math.max(row.duration, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ Live now ============ */}
      <section className="py-6">
        <div className="haki-container">
          <h2 className="text-xl font-extrabold sm:text-2xl">{t("live")}</h2>
          <div
            className={cn(
              "mt-4 overflow-hidden rounded-2xl border p-6 sm:p-8",
              live ? "bg-gradient-to-l from-primary/10 via-background to-background" : "bg-secondary",
            )}
            style={
              live?.image
                ? {
                    backgroundImage: `linear-gradient(to left, rgba(255,255,255,0.97) 30%, rgba(255,255,255,0.75)), url(${live.image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {live ? (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Badge className="gap-1.5 bg-red-600 px-2.5 py-1 text-white hover:bg-red-600">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-white" />
                    </span>
                    {t("onAirNow")}
                  </Badge>
                  <h3 className="mt-3 text-lg font-extrabold">{live.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lang === "ar" ? "المقدم: " : "Host: "}
                    {live.hostName}
                    {live.listeners > 0 && ` · ${live.listeners.toLocaleString(lang === "ar" ? "ar" : "en")} ${lang === "ar" ? "مستمع" : "listeners"}`}
                  </p>
                </div>
                <Link to="/live">
                  <Button size="lg" className="font-bold">
                    {t("listenNow")}
                    <ArrowLeft className="size-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Radio className="size-8 text-muted-foreground" />
                <p className="font-semibold">{t("noLiveNow")}</p>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar"
                    ? "تابعنا لمعرفة موعد البرنامج القادم"
                    : "Check the schedule for the next program"}
                </p>
                <Link to="/live">
                  <Button variant="outline" className="mt-2">
                    {lang === "ar" ? "جدول البرامج" : "Schedule"}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ Publish CTA ============ */}
      <section className="py-10">
        <div className="haki-container">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-12 text-center sm:px-12">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  "radial-gradient(600px 200px at 20% 0%, rgba(249,115,22,0.9), transparent), radial-gradient(600px 200px at 80% 100%, rgba(234,88,12,0.9), transparent)",
              }}
              aria-hidden="true"
            />
            <div className="relative">
              <h2 className="text-2xl font-black sm:text-3xl">
                {t("publishCtaTitle")}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                {t("publishCtaBody")}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground/70">
                {lang === "ar"
                  ? "مرحّب بالمؤلفين ودور النشر والرواة وصناع البودكاست — فريقنا يرافقك من الملف الأول حتى النشر."
                  : "Authors, publishers, narrators, and podcasters are all welcome — our team supports you from first file to launch."}
              </p>
              <Link to="/publish">
                <Button size="lg" className="mt-6 h-12 bg-primary px-8 text-base font-bold text-white hover:bg-primary/90">
                  <BookOpen className="size-4" />
                  {t("publish")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Loading placeholder for dynamic sections. */
function SectionSkeleton() {
  return (
    <section className="py-6">
      <div className="haki-container">
        <Skeleton className="h-7 w-40" />
        <div className="no-scrollbar mt-4 flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-40 shrink-0 rounded-2xl sm:w-44 lg:w-48" />
          ))}
        </div>
      </div>
    </section>
  );
}
