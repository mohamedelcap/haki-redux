import { formatDuration, useLang } from "@/lib/i18n";
import { usePlayer, demoAudioUrl } from "@/lib/player";
import { LOGO_COVER } from "@/lib/logoAsset";
import type { EnrichedContent } from "@/convex/lib";
import { iaFirstPageUrl } from "@/convex/importCore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Headphones,
  Mic,
  Newspaper,
  Podcast,
  Play,
  Radio,
  Theater,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router";
import { useRef } from "react";

export function ContentTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? "size-4";
  switch (type) {
    case "audiobook":
      return <Headphones className={cls} />;
    case "ebook":
      return <BookOpen className={cls} />;
    case "audio_drama":
      return <Theater className={cls} />;
    case "micro_drama":
      return <Mic className={cls} />;
    case "podcast":
      return <Podcast className={cls} />;
    case "magazine":
      return <Newspaper className={cls} />;
    case "live":
      return <Radio className={cls} />;
    default:
      return <BookOpen className={cls} />;
  }
}

export const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  audiobook: { ar: "كتاب صوتي", en: "Audiobook" },
  ebook: { ar: "كتاب إلكتروني", en: "E-book" },
  audio_drama: { ar: "دراما صوتية", en: "Audio drama" },
  micro_drama: { ar: "مايكرو دراما", en: "Micro drama" },
  podcast: { ar: "بودكاست", en: "Podcast" },
  magazine: { ar: "مجلة", en: "Magazine" },
  live: { ar: "بث مباشر", en: "Live" },
};

type CardProps = {
  item: EnrichedContent;
  className?: string;
  onPlay?: (item: EnrichedContent) => void;
};

export function ContentCard({ item, className, onPlay }: CardProps) {
  const { lang, t } = useLang();
  const player = usePlayer();
  const label = TYPE_LABELS[item.contentType]?.[lang] ?? item.contentType;
  const inProgress = item.duration > 0;
  // Cover priority: real cover → first-page scan of the imported book → logo.
  const coverSrc =
    item.coverImage ||
    (item.externalId && item.sourceName ? iaFirstPageUrl(item.externalId) : undefined) ||
    LOGO_COVER;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPlay) {
      onPlay(item);
    } else {
      player.play({
        contentId: item._id,
        title: item.title,
        coverImage: item.coverImage,
        authorName: item.authorName,
        narratorName: item.narratorName,
        // Prefer the real uploaded file; the silent demo WAV is only a fallback.
        audioUrl: item.audioUrl || demoAudioUrl(item._id),
        startOffset: 0,
      });
    }
  };

  return (
    <Link
      to={`/content/${item.slug}`}
      className={cn(
        "group block overflow-hidden rounded-xl border bg-card transition-all duration-200 card-shadow hover:card-shadow-hover hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        <img
          src={coverSrc}
          alt={item.title}
          loading="lazy"
          onError={(e) => {
            // Broken/unreachable cover: swap to the shared fallback once.
            const img = e.currentTarget;
            if (!img.dataset.fallback) {
              img.dataset.fallback = "1";
              img.src = LOGO_COVER;
            }
          }}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="absolute top-2 start-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
          {label}
        </span>
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`${t("play")} ${item.title}`}
          className="absolute bottom-2 end-2 flex size-9 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-110"
        >
          <Play className="size-4 fill-current" />
        </button>
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-bold">{item.title}</h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {item.authorName ?? item.narratorName ?? ""}
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate">{item.categories[0]?.name}</span>
          {inProgress && <span>{formatDuration(item.duration, lang)}</span>}
        </div>
      </div>
    </Link>
  );
}



/** Horizontal scrollable section with arrows. */
export function SectionRow({
  title,
  subtitle,
  items,
  moreHref,
}: {
  title: string;
  subtitle?: string;
  items: EnrichedContent[];
  moreHref?: string;
}) {
  const { lang, t } = useLang();
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    // In RTL, scrollLeft is negative-going; use scrollBy with logical direction
    const rtlSign = document.documentElement.dir === "rtl" ? -1 : 1;
    el.scrollBy({ left: dir * amount * rtlSign, behavior: "smooth" });
  };

  if (!items.length) return null;

  return (
    <section className="py-6">
      <div className="haki-container flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {moreHref && (
            <Link
              to={moreHref}
              className="text-sm font-semibold text-primary hover:underline"
            >
              {t("viewAll")}
            </Link>
          )}
          <div className="hidden sm:flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Scroll right" onClick={() => scroll(1)}>
              {document.documentElement.dir === "rtl" ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
            </Button>
            <Button variant="outline" size="icon" aria-label="Scroll left" onClick={() => scroll(-1)}>
              {document.documentElement.dir === "rtl" ? (
                <ChevronLeft className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      <div
        ref={scroller}
        className="no-scrollbar mt-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8"
      >
        {items.map((item) => (
          <ContentCard key={item._id} item={item} className="w-40 shrink-0 sm:w-44 lg:w-48" />
        ))}
      </div>
    </section>
  );
}
