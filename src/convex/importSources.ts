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
      headers: { "User-Agent": "HAKI-Importer/1.0 (educational public-domain import)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} من المصدر`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
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

  return norm;
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
