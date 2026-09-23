import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { ContentCard, TYPE_LABELS } from "@/components/ContentCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { SearchX, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

const TABS = [
  { key: "all", ar: "الكل", en: "All" },
  { key: "books", ar: "كتب", en: "Books" },
  { key: "audiobooks", ar: "كتب صوتية", en: "Audiobooks" },
  { key: "ebooks", ar: "كتب إلكترونية", en: "E-books" },
  { key: "drama", ar: "دراما", en: "Drama" },
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
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              lang === "ar"
                ? "ابحث عن كتاب، مؤلف، راوٍ، بودكاست..."
                : "Search books, authors, narrators, podcasts..."
            }
            className="h-14 text-lg"
            aria-label={t("search")}
          />
        </div>

        {/* Type tabs */}
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
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
          <div className="py-20 text-center text-muted-foreground">
            <p className="text-lg font-semibold">
              {lang === "ar" ? "ابدأ بالكتابة للبحث في مكتبة حكي" : "Start typing to search the HAKI library"}
            </p>
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
                    <div key={a._id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {a.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{a.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.nameEn}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {results.narrators.length > 0 && (
              <section>
                <h2 className="text-lg font-extrabold">{t("narrator")}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {results.narrators.map((n) => (
                    <div key={n._id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-secondary">
                          <UserRound className="size-4 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{n.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{n.nameEn}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
