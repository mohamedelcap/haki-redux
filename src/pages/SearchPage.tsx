import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard, TYPE_LABELS } from "@/components/ContentCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { LOGO_COVER } from "@/lib/logoAsset";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { SearchX, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

const TABS = [
  { key: "all", ar: "الكل", en: "All" },
  { key: "books", ar: "كتب", en: "Books" },
  { key: "audiobooks", ar: "كتب صوتية", en: "Audiobooks" },
  { key: "ebooks", ar: "كتب إلكترونية", en: "E-books" },
  { key: "drama", ar: "دراما", en: "Drama" },
  { key: "micro_drama", ar: "مايكرو دراما", en: "Micro drama" },
  { key: "podcast", ar: "بودكاست", en: "Podcasts" },
  { key: "magazine", ar: "مجلات", en: "Magazines" },
] as const;

export default function SearchPage() {
  const { lang, t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [input, setInput] = useState(urlQuery);
  const [debounced, setDebounced] = useState(urlQuery);
  const [tab, setTab] = useState<string>("all");
  const [limit, setLimit] = useState(30);
  const [showSuggest, setShowSuggest] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("haki_recent_searches") ?? "[]");
    } catch {
      return [];
    }
  });

  const suggestions = useQuery(
    api.content.suggest,
    debounced.trim().length >= 2 ? { q: debounced.trim() } : "skip",
  );

  const pushRecent = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((x) => x !== t)].slice(0, 8);
    setRecent(next);
    try {
      localStorage.setItem("haki_recent_searches", JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    const id = setTimeout(() => setDebounced(input), 300);
    return () => clearTimeout(id);
  }, [input]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debounced) params.set("q", debounced);
    setSearchParams(params, { replace: true });
  }, [debounced, setSearchParams]);

  const results = useQuery(api.content.search, {
    q: debounced,
    type: tab,
    limit,
  });

  const hasQuery = debounced.trim().length > 0;
  const empty =
    hasQuery &&
    results &&
    results.content.length === 0 &&
    results.authors.length === 0 &&
    results.narrators.length === 0;

  return (
    <div className="py-8">
      <SEO title={`${lang === "ar" ? "البحث" : "Search"} | حكي`} />
      <div className="haki-container">
        <h1 className="text-2xl font-black sm:text-3xl">{t("search")}</h1>
        <div className="relative mt-6">
          <Input
            autoFocus
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggest(true);
            }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => window.setTimeout(() => setShowSuggest(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushRecent(input);
                setShowSuggest(false);
              }
            }}
            placeholder={
              lang === "ar"
                ? "ابحث عن كتاب، مؤلف، راوٍ، بودكاست..."
                : "Search books, authors, narrators, podcasts..."
            }
            className="h-14 text-lg"
            aria-label={t("search")}
          />
          {showSuggest && suggestions !== undefined && suggestions.length > 0 && (
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
                  onClick={() => pushRecent(input)}
                >
                  <img
                    src={s.coverImage || LOGO_COVER}
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

        {/* Type tabs */}
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => setTab(tb.key)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                tab === tb.key
                  ? "border-primary bg-primary text-white"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {lang === "ar" ? tb.ar : tb.en}
            </button>
          ))}
        </div>

        {!hasQuery ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-semibold">
              {lang === "ar" ? "ابدأ بالكتابة للبحث في مكتبة حكي" : "Start typing to search the HAKI library"}
            </p>
            {recent.length > 0 && (
              <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide">
                  {lang === "ar" ? "عمليات بحث سابقة:" : "Recent:"}
                </span>
                {recent.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setInput(term);
                      setDebounced(term);
                      pushRecent(term);
                    }}
                    className="rounded-full border bg-background px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    {term}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setRecent([]);
                    try {
                      localStorage.removeItem("haki_recent_searches");
                    } catch {
                      /* storage unavailable */
                    }
                  }}
                  className="text-xs font-semibold text-destructive hover:underline"
                >
                  {lang === "ar" ? "مسح الكل" : "Clear all"}
                </button>
              </div>
            )}
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <SearchX className="size-12 text-muted-foreground/50" />
            <p className="text-lg font-bold">{t("noResults")}</p>
            <p className="text-sm text-muted-foreground">{t("tryDifferent")}</p>
          </div>
        ) : results === undefined ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {results.content.length > 0 && (
              <section>
                <h2 className="text-lg font-extrabold">{t("results")}</h2>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {results.content.map((item) => (
                    <ContentCard key={item._id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {results.authors.length > 0 && (
              <section>
                <h2 className="text-lg font-extrabold">{t("author")}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {results.authors.map((a) => (
                    <Link
                      key={a._id}
                      to={`/author/${a._id}`}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/50"
                    >
                      <Avatar className="size-10">
                        {a.image && <AvatarImage src={a.image} alt={a.name} loading="lazy" />}
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {a.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{a.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.nameEn}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results.narrators.length > 0 && (
              <section>
                <h2 className="text-lg font-extrabold">{t("narrator")}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {results.narrators.map((n) => (
                    <Link
                      key={n._id}
                      to={`/narrator/${n._id}`}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/50"
                    >
                      <Avatar className="size-10">
                        {n.image && <AvatarImage src={n.image} alt={n.name} loading="lazy" />}
                        <AvatarFallback className="bg-secondary">
                          <UserRound className="size-4 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{n.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{n.nameEn}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results.hasMore && (
              <div className="pt-2 text-center">
                <Button
                  type="button"
                  variant="outline"
                  className="font-bold"
                  onClick={() => setLimit((l) => l + 30)}
                >
                  {lang === "ar" ? "عرض المزيد من النتائج" : "Load more results"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
