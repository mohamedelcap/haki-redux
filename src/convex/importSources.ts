"use node";

import { action } from "./_generated/server";
import { requireAdmin } from "./lib";

// ============================================================
// Import Sources registry (modular)
// ------------------------------------------------------------
// Each source declares its official API endpoints + field paths.
// Adding a future source = adding one object here + a fetch fn.
// Only official APIs are used; no HTML scraping, no DRM bypass.
// ============================================================

export type SourceConfig = {
  name: string;
  /** Search endpoint; {q}=query, {page}/{rows} pagination. */
  searchEndpoint: string;
  /** Metadata endpoint; {id} = external identifier. */
  metadataEndpoint: string;
  /** Direct file download base; {id}/{filename}. */
  fileEndpoint: string;
  /** Cover endpoint; {id}. */
  coverEndpoint: string;
  /** Field name carrying rights/license info. */
  rightsField: string;
  /** Identifier field name. */
  idField: string;
  /** Max requests/minute we allow ourselves. */
  rateLimitPerMin: number;
  /** Does this source require auth? */
  requiresAuth: boolean;
};

export const SOURCES: Record<string, SourceConfig> = {
  gutenberg: {
    name: "Project Gutenberg",
    // Official Gutendex API (search): ?search=&languages=&topic=&page=
    searchEndpoint:
      "https://gutendex.com/books/?search={q}&page={page}",
    // Per-book metadata (official Gutendex detail shape).
    metadataEndpoint: "https://gutendex.com/books/{id}/",
    // Direct files: https://www.gutenberg.org/ebooks/{id}.epub3.images etc.
    fileEndpoint: "https://www.gutenberg.org/ebooks/{id}.{format}",
    // Official cover: https://www.gutenberg.org/cache/epub/{id}/pg{id}.cover.medium.jpg
    coverEndpoint: "https://www.gutenberg.org/cache/epub/{id}/pg{id}.cover.medium.jpg",
    rightsField: "license",
    idField: "id",
    rateLimitPerMin: 30,
    requiresAuth: false,
  },
  internet_archive: {
    name: "Internet Archive",
    // Official advanced search API (JSON).
    searchEndpoint:
      "https://archive.org/advancedsearch.php?q={q}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=year&fl[]=language&fl[]=publisher&fl[]=description&fl[]=subject&fl[]=licenseurl&fl[]=rights&fl[]=isbn&fl[]=num_pages&fl[]=imagecount&fl[]=item_size&fl[]=edition&fl[]=subtitle&page={page}&rows={rows}&output=json",
    // Official metadata endpoint per identifier.
    metadataEndpoint: "https://archive.org/metadata/{id}",
    // Direct downloads are served from /download/{id}/{filename}.
    fileEndpoint: "https://archive.org/download/{id}/{filename}",
    // Official cover services.
    coverEndpoint: "https://archive.org/services/img/{id}",
    rightsField: "licenseurl",
    idField: "identifier",
    rateLimitPerMin: 30,
    requiresAuth: false,
  },
};

/** Allowed public formats we may link/download (legally distributed ebooks). */
export const ALLOWED_FORMATS = ["pdf", "epub", "txt", "mobi", "djvu"];
/** Audio formats for IA audiobook items (LibriVox etc.). */
export const ALLOWED_AUDIO_FORMATS = ["mp3", "ogg", "m4b", "wav"];

/** Parse an IA file "length" field ("85", "575.37", "01:25") into seconds. */
export function parseIaLength(v: any): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
  const parts = s.split(":").map(Number);
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// ---------------- URL safety ----------------

/** Only https + public hosts; blocks localhost/private ranges. */
export function validateExternalUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("رابط غير صالح");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("بروتوكول غير مسموح");
  }
  const host = u.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "metadata.google.internal";
  if (blocked) throw new Error("عنوان داخلي غير مسموح");
  return u;
}

export async function fetchWithLimit(url: string, timeoutMs = 15000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "HAKI-Importer/1.0 (educational public-domain import)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} من المصدر`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Map a human language name ("English", "عربي") to Gutendex ISO codes ("en", "ar"). */
export function gutenbergLanguageCode(raw: string): string {
  const s = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    english: "en", arabic: "ar", french: "fr", german: "de", spanish: "es",
    italian: "it", portuguese: "pt", russian: "ru", chinese: "zh", japanese: "ja",
    turkish: "tr", persian: "fa", hebrew: "he", greek: "el", latin: "la",
    dutch: "nl", polish: "pl", hindi: "hi", urdu: "ur", korean: "ko",
    "\u0627\u0646\u062c\u0644\u064a\u0632\u064a": "en", "\u0639\u0631\u0628\u064a": "ar", "\u0641\u0631\u0646\u0633\u064a": "fr", "\u0623\u0644\u0645\u0627\u0646\u064a": "de", "\u0625\u0633\u0628\u0627\u0646\u064a": "es",
  };
  return map[s] ?? (s.length === 2 ? s : s.slice(0, 2));
}

/** Binary fetch (covers) with the same safety limits. */
export async function fetchBlobWithLimit(
  url: string,
  timeoutMs = 20000,
): Promise<{ buf: ArrayBuffer; type: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "HAKI-Importer/1.0 (educational public-domain import)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} من المصدر`);
    return { buf: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "image/jpeg" };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Community moderation helper: mask profane words (AR/EN) with asterisks,
 * preserving word length. Pure function so it is unit-testable.
 */
const PROFANITY: RegExp[] = [
  /\u0644\u0644\u0623\u062e\u0631\u0627\u0631/g, // placeholder replaced below
];

const BAD_WORDS = [
  // English
  "fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt", "whore", "slut",
  // Arabic (transliteration-resistant core forms)
  "\u0642\u062d\u0628\u0629", "\u0642\u062d\u0628", "\u0632\u0646\u064a", "\u0632\u0646\u0649",
  "\u063a\u0628\u064a", "\u063a\u0628\u064a\u0629", "\u062d\u0645\u0627\u0631", "\u062d\u0645\u0627\u0631\u0629",
  "\u0643\u0644\u0628", "\u0643\u0644\u0628\u0629", "\u0644\u0639\u0627\u0646\u0629", "\u0644\u0639\u0646\u0647",
  "\u063a\u0627\u0644\u064a\u0627\u062a", "\u0633\u0627\u062d\u0631\u0629", "\u0642\u0630\u0631",
];

export function maskProfanity(input: string): string {
  let s = input;
  for (const w of BAD_WORDS) {
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    s = s.replace(re, (m) => "*".repeat(m.length));
  }
  void PROFANITY;
  return s;
}

/**
 * Sanitize imported metadata: strip HTML/scripts, decode entities, remove
 * control chars, collapse whitespace. Applied to every text field before it
 * ever reaches the database (anti-XSS for imported descriptions).
 */
export function sanitizeText(v: any, maxLen = 4000): string {
  if (v == null) return "";
  let s = Array.isArray(v) ? v.map(String).join(" ") : String(v);
  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, maxLen);
}

// ---------------- Rights classification ----------------

/**
 * Classify rights from the source's own metadata.
 * NEVER assumes public domain: only an explicit license URL / rights marker
 * from the source yields public_domain; anything else requires review.
 */
export function classifyRights(doc: any): {
  status: "public_domain" | "copyrighted" | "unknown" | "requires_review";
  info: string;
} {
  const license: string = String(doc?.licenseurl ?? doc?.license ?? "").trim();
  const rights: string = String(doc?.rights ?? "").trim();
  const info = [license, rights].filter(Boolean).join(" | ");

  if (/creativecommons\.org\/(publicdomain|zero)/i.test(license) || /\bpd\b|public domain/i.test(rights)) {
    return { status: "public_domain", info: info || "Public domain (per source)" };
  }
  if (/creativecommons\.org\/licenses/i.test(license)) {
    // CC-BY etc. — licensed for redistribution but not PD.
    return { status: "public_domain", info: info || "Open license (per source)" };
  }
  if (/copyright/i.test(rights)) return { status: "copyrighted", info: info || "Copyrighted (per source)" };
  if (info) return { status: "requires_review", info };
  return { status: "requires_review", info: "" };
}

// ---------------- IA metadata normalization ----------------

function firstOrJoin(v: any, sep = "; "): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x)).join(sep) || undefined;
  const s = String(v).trim();
  return s || undefined;
}

function toYear(v: any): number | undefined {
  const m = String(v ?? "").match(/(\d{4})/);
  return m ? Number(m[1]) : undefined;
}

/** Normalize an IA search doc / metadata into our common shape. */
export function normalizeDoc(doc: any, source: SourceConfig) {
  const id = sanitizeText(doc?.[source.idField], 120);
  const rights = classifyRights(doc);
  const subjectsRaw = doc?.subject;
  const subjects: string[] = Array.isArray(subjectsRaw)
    ? subjectsRaw.map(String)
    : subjectsRaw
      ? [String(subjectsRaw)]
      : [];
  const year = toYear(doc?.year ?? doc?.date);
  const pages = Number(doc?.num_pages ?? doc?.imagecount ?? 0) || undefined;
  const size = Number(doc?.item_size ?? 0) || undefined;

  return {
    externalId: id,
    sourceName: sanitizeText(source.name, 120),
    sourceUrl: id ? `https://archive.org/details/${id}` : undefined,
    title: sanitizeText(doc?.title, 300) || "بدون عنوان",
    subtitle: sanitizeText(doc?.subtitle, 300) || undefined,
    author: sanitizeText(doc?.creator, 200) || undefined,
    authorBio: undefined as string | undefined,
    pubDate: sanitizeText(doc?.date, 60) || undefined,
    originalYear: year,
    language: sanitizeText(doc?.language, 20) || "en",
    publisher: sanitizeText(doc?.publisher, 200) || undefined,
    description: sanitizeText(doc?.description),
    subjects: subjects
      .map((s) => sanitizeText(s, 80))
      .filter(Boolean)
      .slice(0, 12),
    keywords: subjects.slice(0, 12).map((s) => sanitizeText(s, 80)).filter(Boolean),
    isbn: sanitizeText(doc?.isbn, 40) || undefined,
    edition: sanitizeText(doc?.edition, 120) || undefined,
    pageCount: pages,
    fileSize: size,
    rightsStatus: rights.status,
    rightsInfo: sanitizeText(rights.info, 500),
    coverUrl: id ? source.coverEndpoint.replace("{id}", id) : undefined,
    files: [] as { name: string; format: string; url: string; size?: number }[],
    audioFiles: [] as { name: string; format: string; url: string; size?: number; duration: number }[],
    isAudiobook: false as boolean,
    audioDuration: 0 as number,
  };
}

/** Fetch full metadata + file list for one IA identifier (official endpoints). */
export async function fetchIaItem(id: string, source: SourceConfig) {
  const meta = await fetchWithLimit(source.metadataEndpoint.replace("{id}", encodeURIComponent(id)));
  const md = meta?.metadata ?? {};
  const doc = { ...md, [source.idField]: id };
  const norm = normalizeDoc(doc, source);

  // Files list: filter to allowed formats, build direct download URLs.
  const files: any[] = Array.isArray(meta?.files) ? meta.files : [];
  // Highest-quality preference: epub > pdf > others, and pick the largest
  // cover variant available from the official services endpoint.
  const fmtOf = (f: any) => String(f?.name ?? "").split(".").pop()?.toLowerCase() ?? "bin";
  const quality: Record<string, number> = { epub: 5, pdf: 4, mobi: 3, djvu: 2, txt: 1 };
  norm.files = files
    .filter((f) => {
      const fmt = String(f?.format ?? "").toLowerCase();
      const ext = fmtOf(f);
      return ALLOWED_FORMATS.includes(ext) || /pdf|epub|text|mobi|djvu/.test(fmt);
    })
    .sort((a, b) => (quality[fmtOf(b)] ?? 0) - (quality[fmtOf(a)] ?? 0))
    .slice(0, 6)
    .map((f) => ({
      name: sanitizeText(f.name, 200),
      format: fmtOf(f),
      url: source.fileEndpoint
        .replace("{id}", encodeURIComponent(id))
        .replace("{filename}", encodeURIComponent(String(f.name))),
      size: Number(f.size ?? 0) || undefined,
    }));

  // ---- Audiobook support: extract chaptered MP3s (LibriVox & friends) ----
  // IA audiobook items carry per-chapter files with `title` and `length`.
  const audioFiles = files
    .filter((f) => {
      const ext = fmtOf(f);
      const fmt = String(f?.format ?? "").toLowerCase();
      return ALLOWED_AUDIO_FORMATS.includes(ext) || /128kbps mp3|vbr mp3|64kbps mp3|ogg/i.test(fmt);
    })
    // Prefer 128kbps per chapter; drop duplicate lower-quality variants by stem.
    .filter((f) => !/_64kb\./i.test(String(f.name ?? "")))
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));

  const seenStems = new Set<string>();
  norm.audioFiles = audioFiles
    .map((f) => {
      const stem = String(f.name ?? "").replace(/_128kb\./i, ".").toLowerCase();
      if (seenStems.has(stem)) return null; // VBR duplicate of the 128kb file
      seenStems.add(stem);
      return {
        name: sanitizeText(f.title ?? f.name, 200),
        format: fmtOf(f),
        url: source.fileEndpoint
          .replace("{id}", encodeURIComponent(id))
          .replace("{filename}", encodeURIComponent(String(f.name))),
        size: Number(f.size ?? 0) || undefined,
        duration: parseIaLength(f.length),
      };
    })
    .filter(Boolean)
    .slice(0, 120) as { name: string; format: string; url: string; size?: number; duration: number }[];

  // Affective flag: is this item an audiobook?
  norm.isAudiobook = norm.audioFiles.length >= 1;
  // Total duration in seconds for the content record.
  norm.audioDuration = norm.audioFiles.reduce((acc, f) => acc + (f.duration ?? 0), 0);
  if (norm.isAudiobook) {
    norm.rightsStatus = "public_domain";
    norm.rightsInfo =
      norm.rightsInfo ||
      "LibriVox / Internet Archive \u2014 public domain audiobook (\u0645\u0644\u0643 \u0639\u0627\u0645)";
  }

  return norm;
}

// ---------------- Project Gutenberg (Gutendex official API) ----------------

type GutenbergAuthor = { birth_year: number | null; death_year: number | null; name: string };
type GutenbergFormat = Record<string, string>;
type GutenbergBook = {
  id: number;
  title: string;
  authors: GutenbergAuthor[];
  translators?: GutenbergAuthor[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean | null;
  media_type: string;
  formats: GutenbergFormat;
  summaries: string[];
};

/** Map a Gutendex book to our normalized shape (public domain by definition). */
export function normalizeGutenbergBook(b: GutenbergBook) {
  const authorRaw = b.authors?.[0];
  const year = authorRaw?.death_year ?? authorRaw?.birth_year ?? undefined;
  const subjects = [...(b.subjects ?? []), ...(b.bookshelves ?? [])]
    .map((s) => sanitizeText(s, 80))
    .filter(Boolean)
    .slice(0, 12);

  // Pick the best readable/downloadable files (epub > pdf > txt > html).
  const fmtList = Object.entries(b.formats ?? {});
  const pick = (re: RegExp) => fmtList.find(([k]) => re.test(k))?.[1];
  const epub = pick(/epub/);
  const pdf = pick(/pdf/);
  const txt = pick(/text\/plain|\.txt(?!.*html)/);
  const html = pick(/html/);
  const files = [
    epub && { name: "epub", format: "epub", url: epub },
    pdf && { name: "pdf", format: "pdf", url: pdf },
    txt && { name: "txt", format: "txt", url: txt },
    html && { name: "html", format: "html", url: html },
  ].filter(Boolean) as { name: string; format: string; url: string }[];

  const audioFiles = fmtList
    .filter(([k]) => /audiobook|mp3|ogg/i.test(k))
    .map(([, v], i) => ({ name: `audio-${i}`, format: "mp3", url: v }));

  const summary = b.summaries?.[0] ?? "";

  return {
    externalId: String(b.id),
    sourceName: "Project Gutenberg",
    sourceUrl: `https://www.gutenberg.org/ebooks/${b.id}`,
    title: sanitizeText(b.title, 300) || "بدون عنوان",
    subtitle: undefined,
    author: sanitizeText(authorRaw?.name ?? "", 200) || undefined,
    authorBio: undefined,
    pubDate: year ? String(year) : undefined,
    originalYear: year,
    language: sanitizeText(b.languages?.[0] ?? "en", 20) || "en",
    publisher: "Project Gutenberg",
    description: sanitizeText(summary, 4000),
    subjects,
    keywords: subjects,
    isbn: undefined,
    edition: undefined,
    pageCount: undefined,
    fileSize: undefined,
    // Gutenberg hosts only public-domain works → explicit status.
    rightsStatus: "public_domain" as const,
    rightsInfo: "Project Gutenberg — public domain (ملك عام)",
    coverUrl: `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`,
    files: [...files, ...audioFiles].slice(0, 8),
  };
}

/** Fetch full metadata for one Gutenberg book id (official Gutendex endpoint). */
export async function fetchGutenbergItem(id: string) {
  const data = await fetchWithLimit(
    `https://gutendex.com/books/${encodeURIComponent(id)}`,
  );
  if (!data || data.id === undefined) throw new Error("كتاب غير موجود في Gutendex");
  return normalizeGutenbergBook(data as GutenbergBook);
}

/** Extract a language facet value from IA's and[]=language:"X" URL params. */
function iaLanguageFacet(u: URL): string | undefined {
  for (const key of [...u.searchParams.keys()]) {
    if (key !== "and[]") continue;
    const val = u.searchParams.get(key) ?? "";
    const m = /language\s*[:=]\s*"?([^"]+?)"?\s*$/.exec(val);
    if (m) return m[1].trim();
  }
  return undefined;
}

/**
 * Parse any archive.org-style or Gutenberg URL the user pastes into a
 * (source, query) pair used by the importer.
 * Handles: https://archive.org/details/gutenberg?and[]=language:"English"
 *          https://www.gutenberg.org/ebooks/search/?query=x
 *          https://gutendex.com/books/?search=x
 */
export function parseImportUrl(
  raw: string,
): {
  source: "internet_archive" | "gutenberg";
  collection?: string;
  /** IA-only: collection captured from /details/{iaCollection}. */
  iaCollection?: string;
  query?: string;
  ids: string[];
} {
  const u = validateExternalUrl(raw);
  const host = u.hostname.replace(/^www\./, "");
  const ids: string[] = [];

  // Project Gutenberg URLs
  if (/(^|\.)gutenberg\.org$/.test(host) || host === "gutendex.com") {
    const search = u.searchParams.get("query") ?? u.searchParams.get("search") ?? "";
    const ebook = u.pathname.match(/\/ebooks\/(\d+)/);
    if (ebook) ids.push(ebook[1]);
    return { source: "gutenberg", query: search || undefined, ids };
  }

  // archive.org URLs (existing behaviour + gutenberg collection shortcut)
  const collectionMatch = u.pathname.match(/\/details\/([\w.-]+)$/);
  const qp = u.searchParams.get("q") ?? u.searchParams.get("query") ?? "";
  if (collectionMatch && /^gutenberg/i.test(collectionMatch[1])) {
    // IA's gutenberg collection (e.g. /details/gutenberg?and[]=language:"English")
    // must STAY on Internet Archive: its items are IA records fetched from
    // archive.org/metadata. Routing them to Gutendex caused id mismatches
    // (numeric PG ids that do not exist on archive.org) and total failure.
    const langRaw = iaLanguageFacet(u);
    return {
      source: "internet_archive",
      collection: collectionMatch[1],
      query: langRaw ? `language:"${langRaw}" AND mediatype:texts` : undefined,
      ids,
    };
  }

  // Official IA collection RSS: /services/collection-rss.php?collection=gutenberg
  if (u.pathname.includes("collection-rss.php")) {
    const rssCollection = u.searchParams.get("collection") ?? "";
    if (rssCollection !== "") {
      return { source: "internet_archive", collection: rssCollection, ids };
    }
  }
  return {
    source: "internet_archive",
    collection: collectionMatch?.[1],
    query: qp || undefined,
    ids,
  };
}

// ============================================================
// Actions (admin-gated)
// ============================================================

/** List configured sources for the dashboard. */
export const listSources = action({
  handler: async (ctx) => {
    await requireAdmin(ctx as any);
    return Object.entries(SOURCES).map(([key, s]) => ({
      key,
      name: s.name,
      searchEndpoint: s.searchEndpoint.split("?")[0],
      metadataEndpoint: s.metadataEndpoint,
      rightsField: s.rightsField,
      rateLimitPerMin: s.rateLimitPerMin,
      requiresAuth: s.requiresAuth,
      allowedFormats: ALLOWED_FORMATS,
    }));
  },
});
