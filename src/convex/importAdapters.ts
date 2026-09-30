"use node";
// ============================================================
// Source adapters — one adapter per public-domain source.
// Every adapter returns the SAME unified shape (UnifiedItem) so
// the importer UI, the DB layer and the cron pipeline are
// source-agnostic. Adding a new source = adding one adapter.
//
// Mapping layer (source field → site field) is explicit per
// adapter (requirement 16): creator → author, description →
// description, subject → subjects, date → publicationDate,
// identifier → externalId, files → files, rights → rights.
// Only official APIs are used — no HTML scraping, no DRM bypass.
// ============================================================
import {
  classifySourceUrl,
  selectFiles,
  iaCoverUrl,
  iaFirstPageUrl,
  iaDownloadUrl,
  audioDurationOf,
  sanitizeDescription,
  type ParsedLink,
  type UnifiedFile,
} from "./importCore";

const UA = "HAKI-Importer/2.0 (educational public-domain import)";

async function getJson(url: string, timeoutMs = 20000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": UA } });
    console.log(
      `[HAKI-IMPORT] ${JSON.stringify({ stage: "HTTP_RESPONSE", endpoint: url, httpStatus: res.status, ms: Date.now() - started })}`,
    );
    if (!res.ok) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 300);
      } catch {
        body = "";
      }
      console.error(
        `[HAKI-IMPORT] ${JSON.stringify({ stage: "HTTP_ERROR", endpoint: url, httpStatus: res.status, body })}`,
      );
      throw new Error(`HTTP ${res.status} من المصدر`);
    }
    return await res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      console.error(`[HAKI-IMPORT] ${JSON.stringify({ stage: "HTTP_ERROR", endpoint: url, message: "timeout" })}`);
      throw new Error("انتهت مهلة الاتصال بالمصدر — حاول مرة أخرى");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

function str(v: any): string | undefined {
  if (v == null) return undefined;
  const s = (Array.isArray(v) ? v.join("; ") : String(v)).trim();
  return s || undefined;
}

function arr(v: any): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);
}

function yearOf(v: any): number | undefined {
  const m = String(v ?? "").match(/(\d{4})/);
  return m ? Number(m[1]) : undefined;
}

function rightsFrom(licenseurl?: string, rights?: string): {
  status: "public_domain" | "copyrighted" | "unknown" | "requires_review";
  info?: string;
  verified: boolean;
} {
  const lic = (licenseurl ?? "").trim();
  const r = (rights ?? "").trim();
  const info = [lic, r].filter(Boolean).join(" | ") || undefined;
  if (/creativecommons\.org\/(publicdomain|zero)/i.test(lic)) return { status: "public_domain", info, verified: true };
  if (/copyright/i.test(r)) return { status: "copyrighted", info, verified: true };
  if (info) return { status: "requires_review", info, verified: false };
  return { status: "unknown", info: undefined, verified: false };
}

/** Seconds from IA's varied length formats: "85" | "575.37" | "01:25" | "1:02:03". */
export function parseIaLength(v: any): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
  const parts = s.split(":").map(Number);
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) return parts[0] * 60 + parts[1];
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

/**
 * Probe a REAL URL against the source: HEAD first, ranged GET fallback.
 * Returns HTTP status / content-type / final URL so the importer never
 * invents availability. Never throws — network failures come back as
 * { ok:false, status:null } and callers keep the metadata-derived state.
 */
export type ProbeResult = {
  ok: boolean;
  status: number | null;
  contentType?: string;
  contentLength?: number;
  finalUrl?: string;
  error?: string;
};

export async function probeUrl(url: string, timeoutMs = 12000): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    let res = await fetch(url, {
      method: "HEAD",
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA },
    });
    // Fall back to a 1-byte ranged GET only when HEAD itself is unsupported
    // (405/501) — a 4xx/5xx from HEAD is the node's REAL answer and must be
    // trusted, otherwise broken files would hang the check instead of failing.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": UA, Range: "bytes=0-0" },
        signal: ctrl.signal,
        redirect: "follow",
      });
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
    }
    const result: ProbeResult = {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") ?? undefined,
      contentLength: Number(res.headers.get("content-length") ?? 0) || undefined,
      finalUrl: res.url || url,
    };
    console.log(
      `[HAKI-IMPORT] ${JSON.stringify({ stage: "PROBE", url, httpStatus: res.status, contentType: result.contentType, ms: Date.now() - started })}`,
    );
    return result;
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "timeout" : String(e?.message ?? e);
    console.error(`[HAKI-IMPORT] ${JSON.stringify({ stage: "PROBE_ERROR", url, message: msg })}`);
    return { ok: false, status: null, error: msg };
  } finally {
    clearTimeout(t);
  }
}

// ---------------- Unified item shape ----------------

export type UnifiedItem = {
  source: "internet_archive" | "gutenberg" | "open_library";
  externalId: string;
  sourceUrl?: string;
  title?: string;
  subtitle?: string;
  author?: string;
  authors?: string[];
  translator?: string;
  narrator?: string;
  language?: string;
  publicationDate?: string;
  publicationYear?: number;
  description?: string;
  subjects: string[];
  keywords: string[];
  isbn?: string;
  publisher?: string;
  coverUrl?: string;
  /** Secondary cover candidate (IA first-page scan) used when coverUrl is a placeholder. */
  coverFallbackUrl?: string;
  coverFound: boolean;
  rights: { status: string; info?: string; verified: boolean };
  files: UnifiedFile[];
  isAudiobook: boolean;
  audioDuration: number;
};

function emptyItem(source: UnifiedItem["source"], externalId: string): UnifiedItem {
  return {
    source,
    externalId,
    subjects: [],
    keywords: [],
    coverFound: false,
    rights: { status: "unknown", verified: false },
    files: [],
    isAudiobook: false,
    audioDuration: 0,
  };
}

// ============================================================
// Internet Archive adapter (metadata + advancedsearch official APIs)
// ============================================================

/** Map one IA /metadata/{id} payload into the unified shape. */
export function mapIaMetadata(meta: any, id: string): UnifiedItem {
  const md = meta?.metadata ?? {};
  const item = emptyItem("internet_archive", id);
  item.sourceUrl = `https://archive.org/details/${id}`;
  item.title = str(md.title);
  item.subtitle = str(md.subtitle);
  const creators = arr(md.creator);
  item.author = creators[0];
  item.authors = creators;
  item.translator = str(md.translator);
  item.narrator = str(md.narrator) || str(md.reader);
  const lang = str(md.language);
  item.language = lang ? lang.replace(/^eng$/i, "en").replace(/^ara$/i, "ar") : undefined;
  item.publicationDate = str(md.date);
  item.publicationYear = yearOf(md.date ?? md.year);
  // Strip HTML/external links/source boilerplate — only the work's synopsis
  // ever reaches the site.
  item.description = sanitizeDescription(md.description) || undefined;
  item.subjects = [...arr(md.subject), ...arr(md.keywords)];
  item.keywords = [...arr(md.subject), ...arr(md.keywords)];
  item.isbn = str(md.isbn);
  item.publisher = str(md.publisher);

  const rights = rightsFrom(str(md.licenseurl), str(md.rights));
  item.rights = rights;
  const cols = arr(md.collection);
  // PG mirrors on IA are curated public-domain uploads (source-declared).
  if (cols.includes("gutenberg") || /^Book from Project Gutenberg/i.test(String(md.description ?? ""))) {
    item.rights = { status: "public_domain", info: item.rights.info ?? "Project Gutenberg (IA mirror)", verified: true };
  }

  // Files (real file list from the metadata API). IA marks restricted items
  // with access-restricted-item and private files with private:true — we keep
  // them but flag availability so the UI never fakes a working download.
  const restrictedItem = String(md["access-restricted-item"] ?? "").trim() !== "";
  const rawFiles = (Array.isArray(meta?.files) ? meta.files : [])
    .map((f: any) => ({
      name: String(f.name ?? ""),
      format: String(f.format ?? "") || (String(f.name ?? "").split(".").pop() ?? ""),
      size: Number(f.size ?? 0) || undefined,
      url: iaDownloadUrl(id, String(f.name ?? "")),
      duration: parseIaLength(f.length),
      availability: (restrictedItem || Boolean(f.private) || String(f.source ?? "") === "private")
        ? ("restricted" as const)
        : ("available" as const),
      mime: String(f["content-type"] ?? f.mimetype ?? "") || undefined,
    }))
    .filter((f: any) => f.name && !f.name.endsWith("_files.xml") && !f.name.endsWith("_meta.xml"));
  item.files = selectFiles(rawFiles);
  item.isAudiobook = item.files.some((f) => f.kind === "audio" && f.selected);
  item.audioDuration = audioDurationOf(item.files);

  // Cover (official services endpoint). IA returns a generic "notfound"
  // placeholder image with HTTP 200 when the item has no cover — the live
  // HEAD validation in the importer detects that and falls back to the
  // item's "first page" scan image ({id}_page1, typically the first page of
  // the work) before ever showing the site without a cover.
  item.coverUrl = iaCoverUrl(id);
  item.coverFallbackUrl = iaFirstPageUrl(id);
  item.coverFound = true;
  return item;
}

export async function fetchIaItem(id: string): Promise<UnifiedItem> {
  const endpoint = `https://archive.org/metadata/${encodeURIComponent(id)}`;
  console.log(
    `[HAKI-IMPORT] ${JSON.stringify({ stage: "METADATA_FETCH_STARTED", externalId: id, endpoint })}`,
  );
  const meta = await getJson(endpoint);
  if (!meta || (meta.metadata == null && !Array.isArray(meta.files))) {
    throw new Error("تعذر قراءة صفحة الكتاب من أرشيف الإنترنت (لا بيانات)");
  }
  if (!meta.metadata || Object.keys(meta.metadata).length === 0) {
    throw new Error("الكتاب غير موجود على أرشيف الإنترنت (معرف غير صالح أو محجوب)");
  }
  const item = mapIaMetadata(meta, id);
  console.log(
    `[HAKI-IMPORT] ${JSON.stringify({ stage: "METADATA_RECEIVED", externalId: id, title: item.title, files: item.files.length, cover: item.coverUrl })}`,
  );
  return item;
}

/** Discover IA ids from a collection/search link (paginated advancedsearch). */
export async function discoverIa(link: ParsedLink, page: number, rows: number): Promise<{ ids: string[]; total: number }> {
  const parts: string[] = [];
  if (link.collection) parts.push(`collection:${link.collection}`);
  // IA's index stores ISO codes ("eng") while the site facet uses names
  // ("English") — mirror the pasted value with its common code so the count
  // matches what the user sees on archive.org (English: 11 vs eng: 28,926).
  if (link.language) {
    const lang = link.language.replace(/"/g, "");
    const codes: Record<string, string> = {
      english: "eng", arabic: "ara", french: "fre", german: "ger", spanish: "spa",
      italian: "ita", portuguese: "por", russian: "rus", chinese: "chi", japanese: "jpn",
      korean: "kor", greek: "gre", latin: "lat", dutch: "dut", polish: "pol",
      hindi: "hin", turkish: "tur", persian: "per", hebrew: "heb",
    };
    const code = codes[lang.toLowerCase()];
    if (code) parts.push(`language:("${lang}" OR "${code}")`);
    else parts.push(`language:"${lang}"`);
  }
  if (link.query) parts.push(link.query.replace(/"[<>]/g, ""));
  if (!parts.some((p) => p.includes("mediatype:"))) parts.push("mediatype:texts");
  const q = parts.join(" AND ");
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
    `&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=date&fl[]=language&page=${page}&rows=${rows}&output=json`;
  console.log(
    `[HAKI-IMPORT] ${JSON.stringify({ stage: "SEARCH_REQUEST_STARTED", endpoint: url, query: q })}`,
  );
  const data = await getJson(url);
  const docs: any[] = data?.response?.docs ?? [];
  const total = Number(data?.response?.numFound ?? 0);
  console.log(
    `[HAKI-IMPORT] ${JSON.stringify({ stage: "SEARCH_RESPONSE_RECEIVED", query: q, numFound: total, returned: docs.length })}`,
  );
  return {
    ids: docs.map((d) => String(d.identifier)).filter(Boolean),
    total,
  };
}

// ============================================================
// Project Gutenberg adapter (official Gutendex API)
// ============================================================

export function mapGutenbergBook(b: any): UnifiedItem {
  const item = emptyItem("gutenberg", String(b.id));
  item.sourceUrl = `https://www.gutenberg.org/ebooks/${b.id}`;
  item.title = str(b.title);
  const authors = (b.authors ?? []).map((a: any) => String(a.name));
  item.author = authors[0];
  item.authors = authors;
  item.translator = str((b.translators ?? []).map((a: any) => a.name).join("; ")) || undefined;
  item.language = arr(b.languages)[0];
  const year = b.authors?.[0]?.death_year ?? b.authors?.[0]?.birth_year ?? undefined;
  item.publicationYear = year ?? undefined;
  item.publicationDate = year ? String(year) : undefined;
  item.description = sanitizeDescription(b.summaries?.join(" ")) || undefined;
  item.subjects = [...arr(b.subjects), ...arr(b.bookshelves)];
  item.keywords = item.subjects;
  item.rights = { status: "public_domain", info: "Project Gutenberg — public domain", verified: true };

  const fmtEntries: [string, string][] = Object.entries(b.formats ?? {});
  const rawFiles = fmtEntries.map(([mime, url], i) => {
    const ext =
      /epub/.test(mime) ? "epub" : /pdf/.test(mime) ? "pdf"
      : /\/plain/.test(mime) ? "txt" : /html/.test(mime) ? "html"
      : /mp3/.test(mime) ? "mp3" : `f${i}`;
    return { name: `${item.externalId}.${ext}`, format: ext, url, size: undefined, duration: undefined };
  });
  item.files = selectFiles(rawFiles);
  item.isAudiobook = item.files.some((f) => f.kind === "audio" && f.selected);
  item.audioDuration = audioDurationOf(item.files);
  item.coverUrl = `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.cover.medium.jpg`;
  item.coverFound = true;
  return item;
}

export async function fetchGutenbergItem(id: string): Promise<UnifiedItem> {
  const endpoint = `https://gutendex.com/books/${encodeURIComponent(id)}/`;
  console.log(
    `[HAKI-IMPORT] ${JSON.stringify({ stage: "METADATA_FETCH_STARTED", externalId: id, endpoint })}`,
  );
  const data = await getJson(endpoint);
  if (!data || data.id === undefined) throw new Error("كتاب غير موجود في مشروع غوتنبرغ");
  const item = mapGutenbergBook(data);
  console.log(
    `[HAKI-IMPORT] ${JSON.stringify({ stage: "METADATA_RECEIVED", externalId: id, title: item.title, files: item.files.length, cover: item.coverUrl })}`,
  );
  return item;
}

export async function discoverGutenberg(link: ParsedLink, page: number): Promise<{ ids: string[]; total: number }> {
  const lang = link.query && /^languages=/.test(link.query) ? link.query.replace("languages=", "") : link.query;
  const q = new URLSearchParams();
  if (lang) q.set("languages", lang);
  q.set("page", String(page));
  const data = await getJson(`https://gutendex.com/books/?${q.toString()}`);
  return {
    ids: (data?.results ?? []).map((b: any) => String(b.id)).filter(Boolean),
    total: Number(data?.count ?? 0),
  };
}

// ============================================================
// Open Library adapter (official API) — metadata enrichment source
// ============================================================

export async function fetchOpenLibraryItem(id: string): Promise<UnifiedItem> {
  const isWork = id.startsWith("OL") && id.endsWith("W");
  const base = isWork ? `https://openlibrary.org/works/${id}` : `https://openlibrary.org/books/${id}`;
  const data = await getJson(`${base}.json`);
  if (!data) throw new Error("كتاب غير موجود في Open Library");

  const item = emptyItem("open_library", id);
  item.sourceUrl = base;
  item.title = str(data.title);
  item.subtitle = str(data.subtitle);
  item.description =
    sanitizeDescription(
      typeof data.description === "string" ? data.description : data.description?.value,
    ) || undefined;
  item.subjects = arr(data.subjects);
  item.keywords = item.subjects;
  item.publicationDate = str(data.first_publish_date);
  item.publicationYear = yearOf(data.first_publish_date) ?? yearOf(data.created?.value);

  // Editions → ISBN / publishers / files-ish data.
  try {
    const eds = isWork
      ? await getJson(`${base}/editions.json`)
      : { entries: [data] };
    const entries: any[] = eds?.entries ?? [];
    const withIsbn = entries.find((e) => e.isbn_13?.[0] || e.isbn_10?.[0]);
    if (withIsbn) {
      item.isbn = str(withIsbn.isbn_13?.[0]) ?? str(withIsbn.isbn_10?.[0]);
      item.publisher = str(withIsbn.publishers?.[0]?.name ?? withIsbn.publishers?.[0]);
      item.publicationDate = item.publicationDate ?? str(withIsbn.publication_date);
      item.publicationYear = item.publicationYear ?? yearOf(withIsbn.publication_date);
    }
    const withEbook = entries.find((e) => e.ebooks?.[0]);
    if (withEbook) {
      const eb = withEbook.ebooks[0];
      const olid = withEbook.key?.split("/").pop();
      if (olid) {
        item.files = selectFiles([
          {
            name: `${olid}.pdf`,
            format: "pdf",
            url: `https://archive.org/download/${eb.identifier ?? olid}/${olid}.pdf`,
            size: undefined,
            duration: undefined,
          },
        ]);
      }
    }
  } catch {
    /* editions enrichment is best-effort */
  }

  // Authors via work records.
  try {
    const authData = isWork
      ? data
      : await getJson(`https://openlibrary.org/works/${data.works?.[0]?.key?.split("/").pop()}.json`);
    const authorKeys: string[] = (authData?.authors ?? []).map((a: any) => a.author?.key).filter(Boolean);
    if (authorKeys.length > 0) {
      const a1 = await getJson(`https://openlibrary.org${authorKeys[0]}.json`);
      item.author = str(a1?.name);
      item.authors = [item.author].filter(Boolean) as string[];
    }
  } catch {
    /* author enrichment is best-effort */
  }

  item.coverUrl = `https://covers.openlibrary.org/b/olid/${id}-L.jpg`;
  item.coverFound = true;
  item.rights = { status: "unknown", verified: false, info: undefined };
  return item;
}

// ============================================================
// Unified entry points used by the importer
// ============================================================

export async function fetchUnifiedItem(source: string, externalId: string): Promise<UnifiedItem> {
  if (source === "gutenberg") return fetchGutenbergItem(externalId);
  if (source === "open_library") return fetchOpenLibraryItem(externalId);
  return fetchIaItem(externalId);
}

export type DiscoveryPage = { ids: string[]; total: number };

export async function discoverPage(link: ParsedLink, page: number, rows: number): Promise<DiscoveryPage> {
  if (link.source === "gutenberg") return discoverGutenberg(link, page);
  return discoverIa(link, page, rows);
}

export { classifySourceUrl };
