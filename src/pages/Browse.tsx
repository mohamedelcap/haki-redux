import { api } from "@/convex/_generated/api";
import type { ContentType } from "@/convex/schema";
import { SEO } from "@/components/SEO";
import { ContentCard, TYPE_LABELS } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  BookOpen,
  Clock,
  Headphones,
  LayoutGrid,
  List,
  Mic,
  Newspaper,
  Podcast,
  Search,
  SearchX,
  SlidersHorizontal,
  Theater,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

const TYPE_KEYS = ["audiobook", "ebook", "audio_drama", "micro_drama", "podcast", "magazine"] as const;

/** Path slugs (e.g. /browse/drama) mapped to content types. */
const SLUG_TO_TYPE: Record<string, string> = {
  ebooks: "ebook",
  ebook: "ebook",
  audiobooks: "audiobook",
  audiobook: "audiobook",
  drama: "audio_drama",
  "audio-drama": "audio_drama",
  "micro-drama": "micro_drama",
  microdrama: "micro_drama",
  podcast: "podcast",
  podcasts: "podcast",
  magazines: "magazine",
  magazine: "magazine",
};

/** Type pill visuals (soft colored chip + icon, like the reference design). */
const TYPE_PILLS: Record<string, { icon: typeof BookOpen; soft: string }> = {
  audiobook: {
    icon: Headphones,
    soft: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  },
  ebook: {
    icon: BookOpen,
    soft: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  },
  audio_drama: {
    icon: Theater,
    soft: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  },
  micro_drama: {
    icon: Mic,
    soft: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30",
  },
  podcast: {
    icon: Podcast,
    soft: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
  },
  magazine: {
    icon: Newspaper,
    soft: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
  },
};

/** Rotating soft palette for the category pills row. */
const CATEGORY_COLORS = [
  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
];

export default function Browse() {
  const { lang, t } = useLang();
  const [searchParams] = useSearchParams();
  const { type: typeParam } = useParams<{ type: string }>();
  const pathType = typeParam ? SLUG_TO_TYPE[typeParam] : undefined;
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search box (300ms) so suggestions/results update live.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [type, setType] = useState<string>(pathType ?? searchParams.get("type") ?? "all");
  const suggestions = useQuery(
    api.content.suggest,
    debouncedQ.length >= 2 ? { q: debouncedQ, type: TYPE_KEYS.includes(type as any) ? (type as any) : undefined } : "skip",
  );
  const [categorySlug, setCategorySlug] = useState<string>(searchParams.get("category") ?? "all");
  const [rights, setRights] = useState<string>(searchParams.get("rights") ?? "all");
  const [authorId, setAuthorId] = useState<string>("all");
  const [narratorId, setNarratorId] = useState<string>("all");
  const [duration, setDuration] = useState<string>("all");
  const [sort, setSort] = useState<string>(searchParams.get("sort") ?? "newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedActive = authorId !== "all" || narratorId !== "all" || duration !== "all" || rights !== "all";

  // Sync filters when navigating between /browse/:type routes or query strings
  // (the component instance is reused, so state must follow the new params).
  useEffect(() => {
    setType(pathType ?? searchParams.get("type") ?? "all");
    setCategorySlug(searchParams.get("category") ?? "all");
    setRights(searchParams.get("rights") ?? "all");
    setSort(searchParams.get("sort") ?? "newest");
  }, [typeParam, searchParams]);

  const categories = useQuery(api.content.listCategories, {});
  const authors = useQuery(api.content.listAuthors, {});
  const narrators = useQuery(api.content.listNarrators, {});

  const results = useQuery(api.content.browse, {
    q: debouncedQ || undefined,
    contentType: TYPE_KEYS.includes(type as any) ? (type as any) : undefined,
    categorySlug: categorySlug === "all" ? undefined : categorySlug,
    rights: rights === "all" ? undefined : (rights as "public_domain" | "free"),
    authorId: authorId === "all" ? undefined : (authorId as any),
    narratorId: narratorId === "all" ? undefined : (narratorId as any),
    duration: duration === "all" ? undefined : (duration as any),
    sort: sort as any,
  });

  const heading = type !== "all" && TYPE_LABELS[type] ? TYPE_LABELS[type][lang] : lang === "ar" ? "تصفح المكتبة" : "Browse the library";

  const hasFilters = type !== "all" || categorySlug !== "all" || rights !== "all" || authorId !== "all" || narratorId !== "all" || duration !== "all" || debouncedQ;

  const resetAll = () => {
    setQ("");
    setType("all");
    setCategorySlug("all");
    setRights("all");
    setAuthorId("all");
    setNarratorId("all");
    setDuration("all");
    setSort("newest");
  };

  const countLabel = useMemo(() => {
    if (results === undefined) return "…";
    return `${results.length}`;
  }, [results]);

  return (
    <div className="py-8">
      <SEO
        title={`${heading} | حكي`}
        description={lang === "ar" ? "تصفح مكتبة حكي: كتب صوتية وإلكترونية، دراما، بودكاست، ومجلات." : "Browse the HAKI library: audiobooks, ebooks, drama, podcasts and magazines."}
      />
      <div className="haki-container">
        {/* ===== Header ===== */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-black sm:text-4xl">{heading}</h1>
            {results !== undefined && results.length > 0 && (
              <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {countLabel} {lang === "ar" ? "مصنّف" : "items"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "اكتشف آلاف الكتب والمحتوى الصوتي" : "Discover thousands of books and audio content"}
          </p>
        </div>

        {/* ===== Type pills row ===== */}
        <div className="mt-5 flex flex-wrap items-center gap-2" dir="rtl">
          <TypePill
            active={type === "all"}
            onClick={() => setType("all")}
            label={lang === "ar" ? "الكل" : "All"}
            icon={LayoutGrid}
            soft="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30"
          />
          {TYPE_KEYS.map((k) => (
            <TypePill
              key={k}
              active={type === k}
              onClick={() => setType(k)}
              label={TYPE_LABELS[k][lang]}
              icon={TYPE_PILLS[k].icon}
              soft={TYPE_PILLS[k].soft}
            />
          ))}
        </div>

        {/* ===== Category pills row (horizontal scroll) ===== */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">
            {lang === "ar" ? "التصنيفات الفرعية" : "Sub-categories"}
          </p>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <CategoryPill
              active={categorySlug === "all"}
              onClick={() => setCategorySlug("all")}
              label={lang === "ar" ? "الكل" : "All"}
              color="bg-primary text-primary-foreground shadow-sm"
            />
            {(categories ?? []).map((c, i) => (
              <CategoryPill
                key={c._id}
                active={categorySlug === c.slug}
                onClick={() => setCategorySlug(c.slug)}
                label={lang === "ar" ? c.name : c.nameEn || c.name}
                color={
                  categorySlug === c.slug
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : CATEGORY_COLORS[i % CATEGORY_COLORS.length]
                }
              />
            ))}
          </div>
        </div>

        {/* ===== Search + sort + view toolbar ===== */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => window.setTimeout(() => setShowSuggest(false), 150)}
              placeholder={lang === "ar" ? "ابحث عن كتاب، مؤلف، أو موضوع..." : "Search a book, author, or topic..."}
              className="h-12 rounded-full pe-10 ps-4"
              aria-label={t("search")}
            />
            {/* Live suggestions (top 5, debounced) */}
            {showSuggest && debouncedQ.length >= 2 && suggestions !== undefined && suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
                <p className="border-b px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("suggestions")}
                </p>
                {suggestions.map((s) => (
                  <Link
                    key={s._id}
                    to={`/content/${s.slug}`}
                    className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-accent"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <img
                      src={s.coverImage || "/logo.png"}
                      alt=""
                      loading="lazy"
                      className="size-9 rounded-md object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.title}</span>
                    <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                      {TYPE_LABELS[s.contentType]?.[lang] ?? ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Rights quick filter */}
            <Select value={rights} onValueChange={setRights}>
              <SelectTrigger className="h-12 w-auto min-w-28 rounded-full" aria-label={lang === "ar" ? "الحقوق" : "Rights"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "ar" ? "كل الأعمال" : "All works"}</SelectItem>
                <SelectItem value="free">{lang === "ar" ? "مجاني" : "Free"}</SelectItem>
                <SelectItem value="public_domain">{lang === "ar" ? "ملكية عامة" : "Public domain"}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-12 w-auto min-w-28 rounded-full" aria-label={t("sort")}>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4 text-muted-foreground" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t("newest")}</SelectItem>
                <SelectItem value="popular">{t("mostPopular")}</SelectItem>
                <SelectItem value="topRated">{t("topRated")}</SelectItem>
                <SelectItem value="title">{t("titleAz")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Advanced filters toggle */}
            <Button
              type="button"
              variant={advancedActive || showAdvanced ? "default" : "outline"}
              size="icon"
              className="size-12 shrink-0 rounded-full"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-label={lang === "ar" ? "فلاتر متقدمة" : "Advanced filters"}
            >
              <SlidersHorizontal className="size-4" />
            </Button>

            {/* View toggle (grid / list) */}
            <div className="flex shrink-0 items-center overflow-hidden rounded-full border">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label={lang === "ar" ? "عرض شبكي" : "Grid view"}
                className={cn(
                  "flex size-12 items-center justify-center transition-colors",
                  view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label={lang === "ar" ? "عرض قائمة" : "List view"}
                className={cn(
                  "flex size-12 items-center justify-center transition-colors",
                  view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ===== Advanced filters (collapsed by default) ===== */}
        {showAdvanced && (
          <div className="mt-3 grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-3">
            <Select value={authorId} onValueChange={setAuthorId}>
              <SelectTrigger aria-label={t("author")}>
                <SelectValue placeholder={t("author")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "ar" ? "كل المؤلفين" : "All authors"}</SelectItem>
                {authors?.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={narratorId} onValueChange={setNarratorId}>
              <SelectTrigger aria-label={t("narrator")}>
                <SelectValue placeholder={t("narrator")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "ar" ? "كل الرواة" : "All narrators"}</SelectItem>
                {narrators?.map((n) => (
                  <SelectItem key={n._id} value={n._id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger aria-label={t("duration")}>
                <SelectValue placeholder={t("duration")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "ar" ? "كل المدد" : "Any duration"}</SelectItem>
                <SelectItem value="short">{lang === "ar" ? "أقل من ساعتين" : "Under 2h"}</SelectItem>
                <SelectItem value="medium">{lang === "ar" ? "2 - 8 ساعات" : "2 - 8h"}</SelectItem>
                <SelectItem value="long">{lang === "ar" ? "أكثر من 8 ساعات" : "Over 8h"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ===== Results ===== */}
        {results === undefined ? (
          <div className={cn("mt-8", view === "grid"
            ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
            : "space-y-3")}>
            {Array.from({ length: view === "grid" ? 12 : 6 }).map((_, i) => (
              <div key={i} className={view === "grid" ? "space-y-2" : "flex items-center gap-4"}>
                <Skeleton className={view === "grid" ? "aspect-[3/4] rounded-xl" : "h-24 w-20 rounded-xl"} />
                <div className={cn(view === "grid" && "w-full space-y-2")}>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState hasFilters={Boolean(hasFilters)} onReset={resetAll} />
        ) : view === "grid" ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {results.map((item) => (
              <ContentCard key={item._id} item={item} />
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {results.map((item) => (
              <ListRow key={item._id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Soft colored chip with an icon; solid primary when active. */
function TypePill({
  active,
  onClick,
  label,
  icon: Icon,
  soft,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof BookOpen;
  soft: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
          : cn(soft, "hover:brightness-95 dark:hover:brightness-110"),
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

/** Horizontal-scroll category chip with a rotating soft color. */
function CategoryPill({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all",
        active
          ? color
          : cn(color, "opacity-80 hover:opacity-100"),
      )}
    >
      {label}
    </button>
  );
}

/** Horizontal result row for the list view. */
function ListRow({ item }: { item: EnrichedLike }) {
  const { lang, t } = useLang();
  return (
    <Link
      to={`/content/${item.slug}`}
      className="group flex items-center gap-4 rounded-2xl border bg-card p-3 transition-all hover:border-primary/40 hover:card-shadow"
    >
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        <img
          src={item.coverImage || "/logo.png"}
          alt={item.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase text-primary">
          {TYPE_LABELS[item.contentType]?.[lang] ?? item.contentType}
        </p>
        <h3 className="mt-0.5 truncate text-base font-extrabold">{item.title}</h3>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {item.authorName ?? item.narratorName ?? ""}
        </p>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {item.description?.slice(0, 120)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {item.categories.slice(0, 2).map((c) => (
            <span key={c.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {c.name}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

type EnrichedLike = {
  _id: string;
  slug: string;
  title: string;
  description: string;
  coverImage?: string | null;
  contentType: string;
  authorName?: string | null;
  narratorName?: string | null;
  categories: { id: string; name: string; slug: string }[];
};

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  const { lang, t } = useLang();
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <SearchX className="size-12 text-muted-foreground/50" />
      <p className="text-lg font-bold">{t("noResults")}</p>
      <p className="text-sm text-muted-foreground">{t("tryDifferent")}</p>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onReset} className="mt-1">
          {lang === "ar" ? "مسح كل الفلاتر" : "Clear all filters"}
        </Button>
      )}
    </div>
  );
}
