import { api } from "@/convex/_generated/api";
import { SEO } from "@/components/SEO";
import { LOGO_COVER } from "@/lib/logoAsset";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Download,
  List,
  Loader2,
  Minus,
  Moon,
  Plus,
  Save,
  Search,
  Sun,
  Type,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import type { Book, Rendition } from "epubjs";
import type { NavItem } from "epubjs/types/navigation";

type ThemeKey = "light" | "sepia" | "dark";
type FlowKey = "paginated" | "scrolled";

type ReaderPrefs = {
  theme: ThemeKey;
  fontSize: number;
  flow: FlowKey;
  font: string;
};

const DEFAULT_PREFS: ReaderPrefs = {
  theme: "sepia",
  fontSize: 100,
  flow: "paginated",
  font: "Georgia, 'Times New Roman', serif",
};

const THEME_STYLES: Record<ThemeKey, { body: Record<string, string>; ui: string }> = {
  light: { body: { background: "#ffffff", color: "#1a1a1a" }, ui: "bg-white text-foreground" },
  sepia: { body: { background: "#f4ecd8", color: "#4a3f2f" }, ui: "bg-[#f4ecd8] text-[#4a3f2f]" },
  dark: { body: { background: "#141210", color: "#d8d2c6" }, ui: "bg-[#141210] text-[#d8d2c6]" },
};

const FONT_OPTIONS = [
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Sans", value: "'Helvetica Neue', Arial, sans-serif" },
];

export default function EbookReader() {
  const { slug } = useParams<{ slug: string }>();
  const { lang } = useLang();
  const L = useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const { isAuthenticated } = useAuth();

  const item = useQuery(api.content.getBySlug, slug ? { slug } : "skip");

  const saved = useQuery(
    api.reader.getProgress,
    item && isAuthenticated ? { contentId: item._id } : "skip",
  );
  const saveProgress = useMutation(api.reader.saveProgress);
  const savePrefs = useMutation(api.reader.savePrefs);

  const renditionRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionInst = useRef<Rendition | null>(null);
  const lastSavedRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [currentHref, setCurrentHref] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ cfi: string; excerpt: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [bookmarks, setBookmarks] = useState<{ cfi: string; label: string }[]>([]);
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => {
    try {
      const stored = localStorage.getItem("haki-reader-prefs");
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const [showSettings, setShowSettings] = useState(false);

  const isEbook = item?.contentType === "ebook";
  const fileUrl = useMemo(() => {
    if (!item) return undefined;
    if (item.fileUrl) return item.fileUrl;
    // Gutenberg fallback: /ebooks/<id> redirects to the readable HTML edition.
    const g = /pg?(\d+)/.exec(item.externalId ?? "");
    if (item.sourceName === "Project Gutenberg" && g) {
      return `https://www.gutenberg.org/ebooks/${g[1]}.epub3.images`;
    }
    // IA fallback: prefer an epub/pdf/txt recorded in the import file list.
    const files: any[] = (item as any).importFiles ?? [];
    const avail = files.filter((f) => (f.availability ?? "available") === "available");
    for (const ext of ["epub", "pdf", "txt"]) {
      const hit = avail.find((f) => f.format === ext);
      if (hit?.url) return hit.url as string;
    }
    return undefined;
  }, [item]);
  const fileExt = useMemo(() => {
    const m = /\.(epub|pdf|txt)($|\?)/i.exec(fileUrl ?? "");
    if (m) return m[1].toLowerCase();
    const fmt = (fileUrl ?? "").toLowerCase();
    if (fmt.includes("epub")) return "epub";
    if (fmt.includes("pdf")) return "pdf";
    if (fmt.includes("txt") || fmt.includes("/text")) return "txt";
    return "epub";
  }, [fileUrl]);

  // ---------- restore saved prefs/progress once ----------
  useEffect(() => {
    if (!saved) return;
    if (saved.prefs) {
      try {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(saved.prefs) });
      } catch {
        /* ignore */
      }
    }
    if (saved.percent) setPercent(saved.percent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?._id]);

  // ---------- load the book ----------
  useEffect(() => {
    if (!item || !isEbook || !fileUrl) return;
    let cancelled = false;
    setReady(false);
    setFailed(null);

    (async () => {
      try {
        const ePub = (await import("epubjs")).default;
        // Gutenberg + archive.org allow direct CORS downloads.
        const book = ePub(fileUrl, { openAs: "epub" });
        bookRef.current = book;
        if (cancelled) return;

        const rendition = book.renderTo(renditionRef.current!, {
          width: "100%",
          height: "100%",
          flow: prefs.flow,
          spread: "auto",
        });
        renditionInst.current = rendition;
        applyTheme(rendition, prefs);
        rendition.resize?.(undefined as never, undefined as never);

        const nav = await book.loaded.navigation;
        if (cancelled) return;
        setToc((nav as unknown as { toc: NavItem[] }).toc ?? []);

        await rendition.display();
        if (cancelled) return;

        // Restore last position (CFI) or percent.
        if (saved?.cfi) {
          try {
            await rendition.display(saved.cfi);
          } catch {
            /* stale CFI — ignore */
          }
        }

        rendition.on("relocated", (location: { start?: { href?: string; cfi?: string }; end?: { percentage?: number } }) => {
          const pct = Math.round((location.end?.percentage ?? 0) * 100);
          setPercent(Math.min(100, Math.max(0, pct)));
          setCurrentHref(location.start?.href ?? null);
          const now = Date.now();
          if (isAuthenticated && now - lastSavedRef.current > 3000) {
            lastSavedRef.current = now;
            void saveProgress({
              contentId: item._id,
              cfi: location.start?.cfi,
              percent: pct,
            }).catch(() => undefined);
          }
        });

        // Keyboard navigation
        rendition.on("keyup", handleKey);
        setReady(true);
      } catch (e: any) {
        if (!cancelled) setFailed(String(e?.message ?? e));
      }
    })();

    return () => {
      cancelled = true;
      try {
        renditionInst.current?.destroy();
      } catch {
        /* ignore */
      }
      try {
        bookRef.current?.destroy();
      } catch {
        /* ignore */
      }
      renditionInst.current = null;
      bookRef.current = null;
      setReady(false);
      setToc([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?._id, fileUrl, isEbook]);

  // ---------- apply prefs live ----------
  useEffect(() => {
    const r = renditionInst.current;
    if (!r) return;
    localStorage.setItem("haki-reader-prefs", JSON.stringify(prefs));
    applyTheme(r, prefs);
    if (isAuthenticated && item && ready) {
      void savePrefs({ contentId: item._id, prefs: JSON.stringify(prefs) }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.theme, prefs.fontSize, prefs.font, prefs.flow, ready]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = useCallback(() => {
    renditionInst.current?.next();
  }, []);
  const prev = useCallback(() => {
    renditionInst.current?.prev();
  }, []);

  const jumpTo = useCallback(async (href: string) => {
    await renditionInst.current?.display(href);
    setShowToc(false);
  }, []);

  const jumpToCfi = useCallback(async (cfi: string) => {
    await renditionInst.current?.display(cfi);
    setShowSearch(false);
  }, []);

  const addBookmark = () => {
    const cfi = currentCfi();
    if (!cfi) {
      toast.error(L("انتقل إلى موضع أولاً", "Navigate somewhere first"));
      return;
    }
    setBookmarks((b) => {
      if (b.some((x) => x.cfi === cfi)) return b;
      const chapter = toc.find((t) => currentHref && t.href?.includes(currentHref.split("/").pop() ?? ""));
      const nextB = [...b, { cfi, label: `${chapter?.label?.trim() ?? L("موضع", "Location")} · ${percent}%` }];
      return nextB;
    });
    toast.success(L("أُضيف إشارة مرجعية", "Bookmark added"));
  };

  const currentCfi = (): string | null => {
    try {
      return (renditionInst.current as unknown as { currentLocation?: () => { start: { cfi: string } } })
        ?.currentLocation?.()?.start?.cfi ?? null;
    } catch {
      return null;
    }
  };

  const runSearch = async () => {
    const book = bookRef.current;
    if (!book || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const results: { cfi: string; excerpt: string }[] = [];
      const spineItems = (book.spine as unknown as { items: { href: string }[] }).items ?? [];
      for (const section of spineItems.slice(0, 60)) {
        try {
          const doc: Document = await (book as unknown as { load: (h: string) => Promise<Document> }).load(section.href);
          const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
          let node: Node | null;
          while ((node = walker.nextNode())) {
            const text = node.textContent ?? "";
            const idx = text.toLowerCase().indexOf(searchQuery.toLowerCase());
            if (idx >= 0) {
              const cfi = (book as unknown as { section: (h: string) => { cfiFromElement: (el: Element) => string } }).section(
                section.href,
              ).cfiFromElement(node.parentElement ?? doc.body);
              results.push({ cfi, excerpt: text.slice(Math.max(0, idx - 30), idx + 60).trim() });
              if (results.length >= 40) break;
            }
          }
          (book as unknown as { unload: () => void }).unload();
        } catch {
          /* skip section */
        }
        if (results.length >= 40) break;
      }
      setSearchResults(results);
      if (results.length === 0) toast.info(L("لا نتائج", "No matches"));
    } finally {
      setSearching(false);
    }
  };

  const manualSave = async () => {
    if (!item || !isAuthenticated) {
      toast.error(L("سجّل الدخول لحفظ تقدمك", "Sign in to save your progress"));
      return;
    }
    try {
      await saveProgress({ contentId: item._id, cfi: currentCfi() ?? undefined, percent });
      toast.success(L("حُفظ التقدم", "Progress saved"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (item === undefined) {
    return (
      <div className="haki-container py-16">
        <Skeleton className="mx-auto h-[70vh] w-full max-w-3xl rounded-2xl" />
      </div>
    );
  }

  if (!item || !isEbook) {
    return (
      <div className="haki-container py-24 text-center">
        <BookOpen className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 text-lg font-bold">
          {L("هذا العمل ليس كتابًا إلكترونيًا", "This title is not an e-book")}
        </p>
        <Link to={item ? `/content/${item.slug}` : "/browse"} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
          {L("عودة إلى صفحة العمل", "Back to the title")}
        </Link>
      </div>
    );
  }

  if (!fileUrl) {
    return (
      <div className="haki-container py-24 text-center">
        <BookOpen className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 text-lg font-bold">{L("لا يوجد ملف متاح لهذا الكتاب بعد", "No readable file is available yet")}</p>
        {item.sourceUrl && (
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
            {L("تصفح الكتاب في المصدر", "Read at the source")}
          </a>
        )}
      </div>
    );
  }

  const theme = THEME_STYLES[prefs.theme];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col" dir="ltr">
      <SEO title={`${L("قراءة", "Reading")}: ${item.title} | حكي`} />

      {/* Top toolbar */}
      <div className={cn("flex items-center gap-1 border-b px-3 py-2", theme.ui)} dir={lang === "ar" ? "rtl" : "ltr"}>
        <Button variant="ghost" size="icon" className="size-9" asChild>
          <Link to={`/content/${item.slug}`} aria-label={L("خروج", "Exit")}>
            <X className="size-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="size-9" onClick={() => setShowToc(!showToc)} aria-label="TOC">
          <List className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-9" onClick={() => setShowSearch(!showSearch)} aria-label="Search">
          <Search className="size-4" />
        </Button>

        <div className="mx-2 min-w-0 flex-1 truncate text-center text-sm font-bold" dir="auto">
          {item.title}
        </div>

        <Button variant="ghost" size="icon" className="size-9" onClick={() => setBookmarks(bookmarks.filter((b) => b.cfi !== currentCfi()) ?? [])} aria-label="Bookmarks">
          {bookmarks.some((b) => b.cfi === currentCfi()) ? (
            <BookmarkCheck className="size-4 text-primary" />
          ) : (
            <Bookmark className="size-4" onClick={addBookmark} />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="size-9" onClick={() => setShowSettings(!showSettings)} aria-label="Settings">
          <Type className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-9" onClick={manualSave} aria-label="Save">
          <Save className="size-4" />
        </Button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className={cn("flex flex-wrap items-center gap-4 border-b px-4 py-3 text-sm", theme.ui)}>
          {/* theme */}
          <div className="flex items-center gap-1">
            {(["light", "sepia", "dark"] as ThemeKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, theme: k }))}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border",
                  prefs.theme === k && "ring-2 ring-primary",
                  k === "light" && "bg-white",
                  k === "sepia" && "bg-[#f4ecd8]",
                  k === "dark" && "bg-[#141210]",
                )}
                aria-label={k}
              >
                {k === "light" ? <Sun className="size-4" /> : k === "dark" ? <Moon className="size-4" /> : <span className="text-xs font-black">S</span>}
              </button>
            ))}
          </div>

          {/* font size */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8" onClick={() => setPrefs((p) => ({ ...p, fontSize: Math.max(70, p.fontSize - 10) }))}>
              <Minus className="size-3" />
            </Button>
            <span className="w-12 text-center font-bold" dir="ltr">{prefs.fontSize}%</span>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setPrefs((p) => ({ ...p, fontSize: Math.min(200, p.fontSize + 10) }))}>
              <Plus className="size-3" />
            </Button>
          </div>

          {/* font family */}
          <div className="flex items-center gap-1">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, font: f.value }))}
                className={cn(
                  "rounded-lg border px-3 py-1 text-xs font-bold",
                  prefs.font === f.value && "border-primary text-primary",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* flow */}
          <div className="flex items-center gap-1">
            {(["paginated", "scrolled"] as FlowKey[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, flow: f }))}
                className={cn(
                  "rounded-lg border px-3 py-1 text-xs font-bold",
                  prefs.flow === f && "border-primary text-primary",
                )}
              >
                {f === "paginated" ? L("صفحات", "Pages") : L("تمرير", "Scroll")}
              </button>
            ))}
          </div>

          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-auto flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
            >
              <Download className="size-3.5" />
              {L("تنزيل الملف", "Download")}
            </a>
          )}
        </div>
      )}

      {/* Search panel */}
      {showSearch && (
        <div className={cn("border-b px-4 py-3", theme.ui)}>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder={L("ابحث داخل الكتاب…", "Search inside the book…")}
              className="w-full rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
              dir="auto"
            />
            <Button size="sm" onClick={runSearch} disabled={searching || !searchQuery.trim()}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => jumpToCfi(r.cfi)}
                  className="block w-full truncate rounded-md px-2 py-1 text-start text-xs hover:bg-black/5 dark:hover:bg-white/10"
                  dir="auto"
                >
                  …{r.excerpt}…
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TXT — plain text reader (fetched once, paginated by the browser) */}
      {fileExt === "txt" ? (
        <TxtReader url={fileUrl} theme={theme} L={L} />
      ) : fileExt === "pdf" ? (
        <div className="relative flex min-h-0 flex-1">
          <iframe src={fileUrl} className="h-full w-full bg-white" title={item.title} />
        </div>
      ) : (
        <>
      {/* Main area */}
      <div className="relative flex min-h-0 flex-1">
        {/* TOC sidebar */}
        {showToc && (
          <aside className={cn("absolute inset-y-0 z-20 w-72 overflow-y-auto border-e p-3 shadow-xl", theme.ui)}>
            <p className="mb-2 px-2 text-xs font-black uppercase tracking-wide opacity-60">
              {L("الفهرس", "Table of contents")}
            </p>
            {toc.length === 0 ? (
              <p className="px-2 text-sm opacity-60">{L("لا فهرس", "No TOC")}</p>
            ) : (
              <ul className="space-y-0.5">
                {toc.map((t, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => t.href && jumpTo(t.href)}
                      className={cn(
                        "w-full truncate rounded-lg px-2 py-1.5 text-start text-sm hover:bg-black/5 dark:hover:bg-white/10",
                        currentHref && t.href?.includes(currentHref.split("/").pop() ?? "") && "bg-primary/10 font-bold text-primary",
                      )}
                      dir="auto"
                    >
                      {t.label?.trim() || L("قسم", "Section")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {bookmarks.length > 0 && (
              <>
                <p className="mb-2 mt-4 px-2 text-xs font-black uppercase tracking-wide opacity-60">
                  {L("إشاراتي المرجعية", "My bookmarks")}
                </p>
                <ul className="space-y-0.5">
                  {bookmarks.map((b, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => jumpToCfi(b.cfi)}
                        className="w-full truncate rounded-lg px-2 py-1.5 text-start text-xs hover:bg-black/5 dark:hover:bg-white/10"
                        dir="auto"
                      >
                        <Bookmark className="me-1 inline size-3" />
                        {b.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        )}

        {/* Book container */}
        <div className="relative min-w-0 flex-1">
          {!ready && !failed && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm font-semibold text-muted-foreground">
                {L("جارٍ تحضير الكتاب…", "Preparing the book…")}
              </p>
            </div>
          )}
          {failed && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
              <p className="font-bold text-destructive">{L("تعذّر تحميل الكتاب", "Failed to load the book")}</p>
              <p className="max-w-md truncate text-xs text-muted-foreground" dir="ltr">{failed}</p>
              {item.sourceUrl && (
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">
                  {L("جرّب المصدر مباشرة", "Try the source directly")}
                </a>
              )}
            </div>
          )}
          <div ref={renditionRef} className="h-full w-full" />
        </div>

        {/* Prev / Next floating */}
        {ready && prefs.flow === "paginated" && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous"
              className="absolute start-1 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition-colors hover:bg-black/40"
            >
              {lang === "ar" ? <ArrowRight className="size-5" /> : <ArrowLeft className="size-5" />}
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="absolute end-1 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur transition-colors hover:bg-black/40"
            >
              {lang === "ar" ? <ArrowLeft className="size-5" /> : <ArrowRight className="size-5" />}
            </button>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className={cn("flex items-center gap-3 border-t px-4 py-2 text-xs font-semibold", theme.ui)} dir={lang === "ar" ? "rtl" : "ltr"}>
        <span className="tabular-nums">{percent}%</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <button type="button" onClick={manualSave} className="flex items-center gap-1 hover:text-primary">
          <Save className="size-3.5" />
          {L("حفظ", "Save")}
        </button>
      </div>
        </>
      )}
    </div>
  );
}

/** Plain-text reader for .txt books (Project Gutenberg / IA text files). */
function TxtReader({
  url,
  theme,
  L,
}: {
  url: string;
  theme: { body: Record<string, string>; ui: string };
  L: (ar: string, en: string) => string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.text();
        if (!cancelled) setText(body.slice(0, 2_000_000));
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <p className="font-bold text-destructive">{L("تعذّر تحميل النص", "Failed to load the text")}</p>
        <p className="text-xs text-muted-foreground" dir="ltr">{error}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">
          {L("افتح الملف مباشرة", "Open the file directly")}
        </a>
      </div>
    );
  }
  if (text === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">{L("جارٍ تحميل النص…", "Loading text…")}</p>
      </div>
    );
  }
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <pre
        className="mx-auto max-w-3xl whitespace-pre-wrap px-6 py-8 font-serif text-[17px] leading-relaxed"
        style={{ background: theme.body.background, color: theme.body.color }}
        dir="auto"
      >
        {text}
      </pre>
    </div>
  );
}

// ---------------- helpers ----------------

function applyTheme(rendition: Rendition, prefs: ReaderPrefs) {
  const t = THEME_STYLES[prefs.theme];
  try {
    rendition.themes?.register?.("custom", {
      body: { ...t.body, "font-size": `${prefs.fontSize}%`, "font-family": prefs.font },
      p: { "font-family": `${prefs.font} !important` },
    });
    rendition.themes?.select?.("custom");
  } catch {
    /* some books lock their own styles */
  }
  void (rendition as unknown as { flow?: (f: string) => void }).flow?.(prefs.flow);
}
