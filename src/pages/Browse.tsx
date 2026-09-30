import { api } from "@/convex/_generated/api";
import type { ContentType } from "@/convex/schema";
import { SEO } from "@/components/SEO";
import { ContentCard, TYPE_LABELS } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
  Check,
  Clock,
  Crown,
  Filter,
  Globe,
  Headphones,
  LayoutGrid,
  List,
  Mic,
  Newspaper,
  Podcast,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  Star,
  Theater,
  X,
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

/** Type pill visuals (soft colored chip + icon). */
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

/** Rotating soft palette for the cascading sub-category pills. */
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

/** Duration slider bounds in minutes. */
const DURATION_MIN = 0;
const DURATION_MAX = 900;
const DURATION_STEP = 10;

export default function Browse() {
  const { lang, t } = useLang();
  const ar = lang === "ar";
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
  const [sort, setSort] = useState<string>(searchParams.get("sort") ?? "newest");
  const [view, setView] = useState<"grid" | "list">("grid");

  // ===== Advanced filter panel state =====
  const [panelOpen, setPanelOpen] = useState(false);
  const [rights, setRights] = useState<string>(searchParams.get("rights") ?? "all");
  const [minRating, setMinRating] = useState<number>(0);
  const [durationRange, setDurationRange] = useState<[number, number]>([DURATION_MIN, DURATION_MAX]);
  const [authorId, setAuthorId] = useState<string>("all");
  const [narratorId, setNarratorId] = useState<string>("all");

  // Keep duration + rights filter args stable for queries (rounded to step).
  const minDur = useMemo(() => (durationRange[0] <= DURATION_MIN ? undefined : durationRange[0]), [durationRange]);
  const maxDur = useMemo(() => (durationRange[1] >= DURATION_MAX ? undefined : durationRange[1]), [durationRange]);
  const ratingArg = minRating > 0 ? minRating : undefined;
  const rightsArg = rights === "all" ? undefined : (rights as "public_domain" | "free" | "premium");

  // Cascading facet pills: within the current result set, what sub-filters exist.
  const facets = useQuery(api.content.browseFacets, {
    q: debouncedQ || undefined,
    contentType: TYPE_KEYS.includes(type as any) ? (type as any) : undefined,
    categorySlug: categorySlug === "all" ? undefined : categorySlug,
    authorId: authorId === "all" ? undefined : (authorId as any),
    narratorId: narratorId === "all" ? undefined : (narratorId as any),
    rights: rightsArg,
    minDurationMin: minDur,
    maxDurationMin: maxDur,
  });

  const results = useQuery(api.content.browse, {
    q: debouncedQ || undefined,
    contentType: TYPE_KEYS.includes(type as any) ? (type as any) : undefined,
    categorySlug: categorySlug === "all" ? undefined : categorySlug,
    rights: rightsArg,
    authorId: authorId === "all" ? undefined : (authorId as any),
    narratorId: narratorId === "all" ? undefined : (narratorId as any),
    duration: "all" as any, // custom sliders replace the legacy presets
    minDurationMin: minDur,
    maxDurationMin: maxDur,
    minRating: ratingArg,
    sort: sort as any,
  });

  // Sync filters when navigating between /browse/:type routes or query strings.
  useEffect(() => {
    setType(pathType ?? searchParams.get("type") ?? "all");
    setCategorySlug(searchParams.get("category") ?? "all");
    setRights(searchParams.get("rights") ?? "all");
    setSort(searchParams.get("sort") ?? "newest");
  }, [typeParam, searchParams]);

  const heading = type !== "all" && TYPE_LABELS[type] ? TYPE_LABELS[type][lang] : ar ? "تصفح المكتبة" : "Browse the library";

  const activeAdvanced =
    rightsArg !== undefined || ratingArg !== undefined || minDur !== undefined || maxDur !== undefined ||
    authorId !== "all" || narratorId !== "all";

  const resetAll = () => {
    setQ("");
    setType("all");
    setCategorySlug("all");
    setRights("all");
    setMinRating(0);
    setDurationRange([DURATION_MIN, DURATION_MAX]);
    setAuthorId("all");
    setNarratorId("all");
    setSort("newest");
  };

  const formatMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} ${ar ? "س" : "h"}${m % 60 ? ` ${m % 60}` : ""}` : `${m}`);

  return (
    <div className="py-8">
      <SEO
        title={`${heading} | حكي`}
        description={ar ? "تصفح مكتبة حكي: كتب صوتية وإلكترونية، دراما، بودكاست، ومجلات." : "Browse the HAKI library: audiobooks, ebooks, drama, podcasts and magazines."}
      />
      <div className="haki-container">
        {/* ===== Header ===== */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-black sm:text-4xl">{heading}</h1>
            {results !== undefined && results.length > 0 && (
              <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {results.length} {ar ? "مصنّف" : "items"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {ar ? "اكتشف آلاف الكتب والمحتوى الصوتي" : "Discover thousands of books and audio content"}
          </p>
        </div>

        {/* ===== Type pills row ===== */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <TypePill
            active={type === "all"}
            onClick={() => setType("all")}
            label={ar ? "الكل" : "All"}
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

        {/* ===== Cascading sub-category pills (spawn from the chosen type) ===== */}
        {(facets?.categories?.length ?? 0) > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-muted-foreground">
              {ar ? "التصنيفات الفرعية" : "Sub-categories"}
            </p>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {categorySlug !== "all" && (
                <CategoryPill
                  active
                  onClick={() => setCategorySlug("all")}
                  label={ar ? "الكل" : "All"}
                  color="bg-primary text-primary-foreground shadow-sm"
                />
              )}
              {(facets?.categories ?? []).map((c, i) => (
                <CategoryPill
                  key={c.id}
                  active={c.active || categorySlug === c.slug}
                  onClick={() => setCategorySlug(c.active ? "all" : c.slug)}
                  label={`${ar ? c.name : c.nameEn || c.name} (${c.count})`}
                  color={
                    c.active || categorySlug === c.slug
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : CATEGORY_COLORS[i % CATEGORY_COLORS.length]
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* ===== Search + sort + view toolbar ===== */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => window.setTimeout(() => setShowSuggest(false), 150)}
              placeholder={ar ? "ابحث عن كتاب، مؤلف، أو موضوع..." : "Search a book, author, or topic..."}
              className="h-12 rounded-full pe-10 ps-4"
              aria-label={t("search")}
            />
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
                    <img src={s.coverImage || "/logo.png"} alt="" loading="lazy" className="size-9 rounded-md object-cover" />
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
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-12 w-auto min-w-32 rounded-full" aria-label={t("sort")}>
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

            <Button
              type="button"
              size="lg"
              className={cn(
                "h-12 shrink-0 gap-2 rounded-full px-5 font-bold",
                activeAdvanced && "shadow-md shadow-primary/25",
              )}
              variant={activeAdvanced ? "default" : "outline"}
              onClick={() => setPanelOpen((v) => !v)}
              aria-expanded={panelOpen}
            >
              <SlidersHorizontal className="size-4" />
              {ar ? "الفلاتر" : "Filters"}
              {activeAdvanced && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-black text-primary">
                  {[
                    rightsArg !== undefined ? 1 : 0,
                    ratingArg !== undefined ? 1 : 0,
                    minDur !== undefined || maxDur !== undefined ? 1 : 0,
                    authorId !== "all" ? 1 : 0,
                    narratorId !== "all" ? 1 : 0,
                  ].reduce((a, b) => a + b, 0)}
                </span>
              )}
            </Button>

            <div className="flex shrink-0 items-center overflow-hidden rounded-full border">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label={ar ? "عرض شبكي" : "Grid view"}
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
                aria-label={ar ? "عرض قائمة" : "List view"}
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

        {/* ===== Advanced filters panel + results ===== */}
        <div className={cn("mt-6 flex flex-col gap-6", panelOpen && "lg:flex-row lg:items-start")}>
          {panelOpen && (
            <aside className="w-full shrink-0 space-y-5 rounded-3xl border bg-card p-5 card-shadow lg:sticky lg:top-24 lg:w-80">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black">{ar ? "الفلاتر" : "Filters"}</h2>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setPanelOpen(false)} aria-label={ar ? "إغلاق" : "Close"}>
                  <X className="size-4" />
                </Button>
              </div>

              {/* Rights: free / paid */}
              <div className="space-y-2">
                <p className="text-sm font-extrabold">{ar ? "نوع الوصول" : "Access"}</p>
                <div className="flex flex-wrap gap-2">
                  <AccessPill active={rights === "all"} onClick={() => setRights("all")} label={ar ? "الكل" : "All"} />
                  <AccessPill active={rights === "free"} onClick={() => setRights("free")} label={ar ? "مجاني" : "Free"} icon={<Sparkles className="size-3.5" />} />
                  <AccessPill active={rights === "premium"} onClick={() => setRights("premium")} label={ar ? "مدفوع" : "Premium"} icon={<Crown className="size-3.5" />} />
                  <AccessPill active={rights === "public_domain"} onClick={() => setRights("public_domain")} label={ar ? "ملكية عامة" : "Public domain"} icon={<Globe className="size-3.5" />} />
                </div>
              </div>

              {/* Minimum rating */}
              <div className="space-y-2">
                <p className="text-sm font-extrabold">{ar ? "التقييم" : "Rating"}</p>
                <div className="flex items-center gap-1.5" dir="ltr">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMinRating((prev) => (prev === n ? 0 : n))}
                      aria-label={`${ar ? "تقييم" : "Rating"} ${n}+`}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl border text-sm font-bold transition-all",
                        minRating >= n && minRating > 0
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {minRating > 0 && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="size-3.5 fill-primary text-primary" />
                    {ar ? `${minRating} نجوم وأعلى` : `${minRating} stars and up`}
                  </p>
                )}
              </div>

              {/* Duration range slider */}
              <div className="space-y-3">
                <p className="text-sm font-extrabold">{ar ? "مدة الاستماع (دقائق)" : "Duration (minutes)"}</p>
                <Slider
                  value={durationRange}
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={DURATION_STEP}
                  onValueChange={(v) => setDurationRange([v[0] ?? DURATION_MIN, v[1] ?? DURATION_MAX])}
                  aria-label={ar ? "مدة الاستماع" : "Duration"}
                />
                <div className="flex items-center justify-between text-xs font-bold text-primary" dir="ltr">
                  <span>{formatMin(durationRange[0])}</span>
                  <span>{durationRange[1] >= DURATION_MAX ? "∞" : formatMin(durationRange[1])}</span>
                </div>
              </div>

              {/* Authors within results */}
              {(facets?.authors?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-extrabold">{ar ? "المؤلف" : "Author"}</p>
                  <div className="no-scrollbar max-h-40 space-y-1 overflow-y-auto pe-1">
                    {facets?.authors.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAuthorId((prev) => (prev === a.id ? "all" : a.id))}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-start text-sm transition-colors",
                          a.active || authorId === a.id
                            ? "border-primary bg-primary/10 font-bold text-primary"
                            : "hover:bg-muted",
                        )}
                      >
                        <span className="truncate">{a.name}</span>
                        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
                          {a.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Narrators within results */}
              {(facets?.narrators?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-extrabold">{ar ? "الراوي" : "Narrator"}</p>
                  <div className="no-scrollbar max-h-40 space-y-1 overflow-y-auto pe-1">
                    {facets?.narrators.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setNarratorId((prev) => (prev === n.id ? "all" : n.id))}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-start text-sm transition-colors",
                          n.active || narratorId === n.id
                            ? "border-primary bg-primary/10 font-bold text-primary"
                            : "hover:bg-muted",
                        )}
                      >
                        <span className="truncate">{n.name}</span>
                        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-bold text-muted-foreground">
                          {n.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" className="w-full gap-2" onClick={resetAll}>
                <Filter className="size-4" />
                {ar ? "مسح الفلاتر" : "Clear filters"}
              </Button>
            </aside>
          )}

          {/* Results grid/list */}
          <div className="min-w-0 flex-1">
            {results === undefined ? (
              <div className={cn(view === "grid"
                ? "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
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
              <EmptyState hasFilters onReset={resetAll} />
            ) : view === "grid" ? (
              <div className={cn(
                "grid gap-4",
                panelOpen
                  ? "grid-cols-2 sm:grid-cols-3"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
              )}>
                {results.map((item) => (
                  <ContentCard key={item._id} item={item} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((item) => (
                  <ListRow key={item._id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
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
        active ? color : cn(color, "opacity-80 hover:opacity-100"),
      )}
    >
      {label}
    </button>
  );
}

/** Access pill for the filters panel (free / premium / public domain). */
function AccessPill({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
      {active && <Check className="size-3" />}
    </button>
  );
}

/** Horizontal result row for the list view. */
function ListRow({ item }: { item: RowItem }) {
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

type RowItem = {
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
