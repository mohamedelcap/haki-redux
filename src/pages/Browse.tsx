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
import { Search, SearchX } from "lucide-react";
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

  const heading =
    type !== "all" && TYPE_LABELS[type]
      ? TYPE_LABELS[type][lang]
      : t("browseLibraryTitle");

  return (
    <div className="py-8">
      <SEO
        title={`${heading} | حكي`}
        description={lang === "ar" ? "تصفح مكتبة حكي: كتب صوتية وإلكترونية، دراما، بودكاست، ومجلات." : "Browse the HAKI library: audiobooks, ebooks, drama, podcasts and magazines."}
      />
      <div className="haki-container">
        <h1 className="text-2xl font-black sm:text-3xl">{heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {results?.length ?? "..."} {lang === "ar" ? "عنصرًا" : "items"}
        </p>

        {/* Toolbar */}
        <div className="mt-6 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => window.setTimeout(() => setShowSuggest(false), 150)}
              placeholder={lang === "ar" ? "ابحث في المكتبة..." : "Search the library..."}
              className="h-11 ps-9"
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

          <div className="flex flex-wrap gap-2">
            {/* Rights filter pills */}
            <div className="flex flex-wrap gap-1.5">
              <FilterPill active={rights === "all"} onClick={() => setRights("all")} label={lang === "ar" ? "كل الأعمال" : "All works"} />
              <FilterPill active={rights === "free"} onClick={() => setRights("free")} label={lang === "ar" ? "مجاني" : "Free"} />
              <FilterPill active={rights === "public_domain"} onClick={() => setRights("public_domain")} label={lang === "ar" ? "مجال عام" : "Public domain"} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Type filter pills */}
            <div className="flex flex-wrap gap-1.5">
              <FilterPill active={type === "all"} onClick={() => setType("all")} label={t("all")} />
              {TYPE_KEYS.map((k) => (
                <FilterPill
                  key={k}
                  active={type === k}
                  onClick={() => setType(k)}
                  label={TYPE_LABELS[k][lang]}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={categorySlug} onValueChange={setCategorySlug}>
              <SelectTrigger aria-label={t("category")}>
                <SelectValue placeholder={t("category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{lang === "ar" ? "كل التصنيفات" : "All categories"}</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c._id} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            <div className="grid grid-cols-2 gap-2">
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
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger aria-label={t("sort")}>
                  <SelectValue placeholder={t("sort")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("newest")}</SelectItem>
                  <SelectItem value="popular">{t("mostPopular")}</SelectItem>
                  <SelectItem value="topRated">{t("topRated")}</SelectItem>
                  <SelectItem value="title">{t("titleAz")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Grid */}
        {results === undefined ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {results.map((item) => (
              <ContentCard key={item._id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function EmptyState() {
  const { lang, t } = useLang();
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <SearchX className="size-12 text-muted-foreground/50" />
      <p className="text-lg font-bold">{t("noResults")}</p>
      <p className="text-sm text-muted-foreground">{t("tryDifferent")}</p>
    </div>
  );
}
