// ============================================================
// Import core (pure): URL classification + unified data shapes
// + automatic file-selection rules. No Convex APIs, no network
// calls here — everything unit-testable.
// ============================================================

export type SourceKey = "internet_archive" | "gutenberg" | "open_library";

export type LinkKind = "collection" | "search" | "item" | "unknown";

export type ParsedLink = {
  source: SourceKey;
  kind: LinkKind;
  /** IA collection handle (e.g. "gutenberg"). */
  collection?: string;
  /** Language facet value for IA collections (e.g. "English"). */
  language?: string;
  /** Free-text / boolean query for search links. */
  query?: string;
  /** Single-item identifier (IA identifier / PG id / OL id). */
  externalId?: string;
};

/** IA handles that are collections, not items. */
const IA_COLLECTIONS = new Set([
  "gutenberg",
  "librivoxaudio",
  "librivox",
  "arabic_books",
  "americanlibraries",
  "opensource_books",
  "opensource_audio",
  "opensourcefilms",
  "universallibrary",
  "additional_collections",
  "communitytexts",
  "toronto",
  "microfilm",
  "inlibrary",
  "internetarchivebooks",
  "bostonpubliclibrary",
  "americana",
  "europeanlibraries",
]);

/** Extract a language facet value from IA's and[]=language:"X" params. */
function iaLanguageFacet(u: URL): string | undefined {
  for (const key of [...u.searchParams.keys()]) {
    if (key !== "and[]" && key !== "and%5B%5D") continue;
    const val = u.searchParams.get(key) ?? "";
    const m = /language\s*[:=]\s*"?([^"]+?)"?\s*$/.exec(val);
    if (m) return m[1].trim();
  }
  return undefined;
}

/**
 * Classify any pasted source URL into (source, kind, params).
 * Throws a user-readable Arabic error for unsupported/invalid URLs.
 */
export function classifySourceUrl(raw: string): ParsedLink {
  const trimmed = (raw ?? "").trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error("رابط غير صالح — الصق رابطًا كاملًا يبدأ بـ http أو https");
  }
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname;

  // ---------- Internet Archive ----------
  if (host === "archive.org" || host.endsWith(".archive.org")) {
    // Official collection RSS feed.
    if (path.includes("collection-rss.php")) {
      const c = u.searchParams.get("collection");
      if (!c) throw new Error("رابط RSS ناقص — أضف ?collection=اسم-المجموعة");
      return { source: "internet_archive", kind: "collection", collection: c };
    }
    // Search results page.
    if (/\/search\.php$/.test(path) || path === "/search") {
      const q = u.searchParams.get("query") ?? u.searchParams.get("q") ?? "";
      if (!q.trim()) throw new Error("رابط بحث بلا كلمات — أضف query إلى الرابط");
      return { source: "internet_archive", kind: "search", query: q };
    }
    // Direct download link → treat as item.
    const dl = path.match(/^\/download\/([\w.-]+)/);
    if (dl) return { source: "internet_archive", kind: "item", externalId: dl[1] };

    // /details/{handle} — item OR collection page.
    const details = path.match(/^\/details\/([\w.-]+)/);
    if (details) {
      const handle = details[1];
      const hasFacets = [...u.searchParams.keys()].some(
        (k) => k.startsWith("and") || k === "sort" || k === "query",
      );
      if (IA_COLLECTIONS.has(handle) || hasFacets) {
        const language = iaLanguageFacet(u);
        return {
          source: "internet_archive",
          kind: "collection",
          collection: handle,
          language,
        };
      }
      return { source: "internet_archive", kind: "item", externalId: handle };
    }
    throw new Error("رابط أرشيف الإنترنت غير مدعوم — استخدم رابط details أو search أو collection-rss");
  }

  // ---------- Project Gutenberg / Gutendex ----------
  if (/(^|\.)gutenberg\.org$/.test(host) || host === "gutendex.com") {
    const ebook = path.match(/\/ebooks\/(\d+)/);
    if (ebook) {
      return { source: "gutenberg", kind: "item", externalId: ebook[1] };
    }
    const q = u.searchParams.get("query") ?? u.searchParams.get("search") ?? "";
    if (host === "gutendex.com" && /languages=/.test(u.search)) {
      return { source: "gutenberg", kind: "search", query: u.searchParams.get("languages")! };
    }
    if (!q.trim()) {
      throw new Error("رابط غوتنبرغ غير مفهوم — استخدم رابط كتاب أو رابط بحث يحتوي كلمات");
    }
    return { source: "gutenberg", kind: "search", query: q };
  }

  // ---------- Open Library ----------
  if (host === "openlibrary.org") {
    const work = path.match(/^\/works\/(OL\w+)/);
    const edition = path.match(/^\/books\/(OL\w+)/);
    const isbn = path.match(/^\/isbn\/([\dXx-]+)/);
    if (work) return { source: "open_library", kind: "item", externalId: work[1] };
    if (edition) return { source: "open_library", kind: "item", externalId: edition[1] };
    if (isbn) return { source: "open_library", kind: "item", externalId: isbn[1].replace(/-/g, "") };
    if (path === "/search") {
      const q = u.searchParams.get("q") ?? "";
      if (!q.trim()) throw new Error("رابط بحث Open Library بلا كلمات");
      return { source: "open_library", kind: "search", query: q };
    }
    throw new Error("رابط Open Library غير مدعوم — استخدم رابط work أو book أو search");
  }

  throw new Error("مصدر غير مدعوم حاليًا — المدعوم: archive.org و gutenberg.org و openlibrary.org");
}

// ---------------- Unified file model ----------------

export type UnifiedFile = {
  /** File name on the source. */
  name: string;
  /** File extension, lowercased (epub, pdf, mp3…). */
  format: string;
  /** Electronic | audio | archive | other. */
  kind: "electronic" | "audio" | "archive" | "other";
  size?: number;
  /** Direct download URL. */
  url: string;
  /** Duration in seconds (audio only, when known). */
  duration?: number;
  /** Automatic selection for publishing. */
  selected: boolean;
  /** Real availability, verified against the source (default available). */
  availability?: "available" | "restricted" | "unavailable";
  /** MIME type reported by the source when known. */
  mime?: string;
};

export const ELECTRONIC_PRIORITY = ["epub", "pdf", "mobi", "azw3", "azw", "djvu", "txt", "html"];
export const AUDIO_EXTS = ["mp3", "m4b", "ogg", "wav"];
const ARCHIVE_EXTS = ["zip", "rar", "torrent"];

export function extOf(nameOrFormat: string): string {
  const s = String(nameOrFormat ?? "").toLowerCase();
  const m = /\.([a-z0-9]{2,5})$/.exec(s);
  if (m) {
    if (m[1] === "htm") return "html";
    return m[1];
  }
  // Format labels like "Text PDF" / "EPUB" / "128Kbps MP3".
  if (/pdf/.test(s)) return "pdf";
  if (/epub/.test(s)) return "epub";
  if (/mobi|azw/.test(s)) return "mobi";
  if (/djvu/.test(s)) return "djvu";
  if (/torrent/.test(s)) return "torrent";
  if (/zip/.test(s)) return "zip";
  if (/mp3/.test(s)) return "mp3";
  if (/ogg/.test(s)) return "ogg";
  if (/m4b/.test(s)) return "m4b";
  if (/wav/.test(s)) return "wav";
  if (/html/.test(s)) return "html";
  if (/text|plain/.test(s)) return "txt";
  return "other";
}

function kindOfExt(ext: string): UnifiedFile["kind"] {
  if ((ELECTRONIC_PRIORITY as string[]).includes(ext)) return "electronic";
  if (AUDIO_EXTS.includes(ext)) return "audio";
  if (ARCHIVE_EXTS.includes(ext)) return "archive";
  return "other";
}

/**
 * Automatic file-selection rules (requirement 6):
 * - Electronic: mark the best formats present, in priority order
 *   epub > pdf > mobi > azw3 > azw > djvu > txt (max 3 selected).
 * - Audio: select every chapter file (max 150) — they form the audiobook.
 * - Archives/other: listed but NOT selected automatically.
 * - Never removes any file: the data-entry employee can toggle manually.
 */
export function selectFiles(
  raw: { name: string; format?: string; size?: number; url: string; duration?: number; availability?: UnifiedFile["availability"]; mime?: string }[],
): UnifiedFile[] {
  // De-duplicate by (ext + stem), preferring the largest size (drops 64kb dupes).
  const byKey = new Map<string, { name: string; format?: string; size?: number; url: string; duration?: number; availability?: UnifiedFile["availability"]; mime?: string }>();
  for (const f of raw) {
    if (!f?.url) continue;
    const ext = extOf(f.format ?? f.name);
    if (ext === "other" && !/\.[a-z0-9]{2,5}$/i.test(String(f.name ?? ""))) continue;
    const stem = String(f.name ?? "").toLowerCase().replace(/_(128kb|64kb)\./i, ".");
    const key = `${ext}:${stem}`;
    const prev = byKey.get(key);
    if (!prev || (f.size ?? 0) > (prev.size ?? 0)) byKey.set(key, f);
  }

  const files: UnifiedFile[] = [...byKey.values()].map((f) => {
    const ext = extOf(f.format ?? f.name);
    return {
      name: String(f.name ?? "file"),
      format: ext,
      kind: kindOfExt(ext),
      size: f.size,
      url: f.url,
      duration: f.duration,
      selected: false,
      availability: f.availability ?? "available",
      mime: f.mime,
    };
  });

  // Electronic: top-3 by priority.
  const electronic = files
    .filter((f) => f.kind === "electronic")
    .sort((a, b) => ELECTRONIC_PRIORITY.indexOf(a.format) - ELECTRONIC_PRIORITY.indexOf(b.format));
  electronic.slice(0, 3).forEach((f) => (f.selected = true));

  // Audio: all chapter files selected.
  files
    .filter((f) => f.kind === "audio")
    .slice(0, 150)
    .forEach((f) => (f.selected = true));

  return files;
}

export function audioDurationOf(files: UnifiedFile[]): number {
  return files
    .filter((f) => f.kind === "audio" && f.selected)
    .reduce((acc, f) => acc + (f.duration ?? 0), 0);
}

/**
 * The single most usable file for the built-in reader, in REAL usability
 * order: EPUB (epub.js) > PDF (embeddable) > TXT (text reader).
 * Never returns archive containers (zip/torrent) — they are not readable.
 * Availability is respected: restricted/unavailable files are skipped first.
 */
export function bestReadableFile(files: UnifiedFile[]): UnifiedFile | undefined {
  // Only VERIFIED-available files qualify — the reader must never open a
  // restricted/broken file, and returning one would fake a working button.
  const open = files.filter(
    (f) => f.selected && f.availability === "available",
  );
  for (const ext of ["epub", "pdf", "txt", "html"]) {
    const found = open.find((f) => f.format === ext);
    if (found) return found;
  }
  return undefined;
}

export function iaCoverUrl(id: string): string {
  return `https://archive.org/services/img/${encodeURIComponent(id)}`;
}

export function iaDownloadUrl(id: string, filename: string): string {
  // Encode path SEGMENTS only: "/" separates IA subfolders and must stay raw
  // (encoding it to %2F breaks archive.org downloads with HTTP 500).
  const seg = encodeURIComponent(filename).replace(/%2F/gi, "/");
  return `https://archive.org/download/${encodeURIComponent(id)}/${seg}`;
}

/** Format bytes for the preview UI (kept here so tests cover it). */
export function formatBytes(n?: number): string {
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
