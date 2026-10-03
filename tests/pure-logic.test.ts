import { describe, expect, it } from "vitest";
import {
  classifyRights,
  maskProfanity,
  sanitizeText,
  parseImportUrl,
  normalizeGutenbergBook,
  parseIaLength,
} from "../src/convex/importSources";
import {
  classifySourceUrl,
  selectFiles,
  extOf,
  sanitizeDescription,
  pickAudioTitle,
  pickAudioFormat,
} from "../src/convex/importCore";
import { computePoolShares } from "../src/convex/royalties";
import { computeChallengeProgress, statusFor } from "../src/convex/engagement";
import {
  DEFAULT_TIMEZONE,
  MAX_PUBLISH_ATTEMPTS,
  isBlockingScheduleStatus,
  isValidTimezone,
  nextOccurrenceUtc,
  parseFormDateTime,
  retryDelayMs,
  scheduleStatusAr,
  validateContentForPublish,
  zonedDateStr,
  zonedTimeStr,
  zonedToUtc,
} from "../src/convex/scheduleLogic";

// ---------------- importSources.classifyRights ----------------

describe("classifyRights", () => {
  it("detects public domain from CC0/publicdomain license URLs", () => {
    expect(classifyRights({ licenseurl: "https://creativecommons.org/publicdomain/zero/1.0/" }).status).toBe("public_domain");
    expect(classifyRights({ licenseurl: "http://creativecommons.org/publicdomain/mark/1.0/" }).status).toBe("public_domain");
  });

  it("treats open CC-BY licenses as public_domain (redistributable)", () => {
    expect(classifyRights({ licenseurl: "https://creativecommons.org/licenses/by/4.0/" }).status).toBe("public_domain");
  });

  it("marks explicit 'public domain' rights text", () => {
    expect(classifyRights({ rights: "This work is in the public domain" }).status).toBe("public_domain");
  });

  it("never assumes public domain without evidence → requires_review", () => {
    expect(classifyRights({}).status).toBe("requires_review");
    expect(classifyRights({ title: "Some book" }).status).toBe("requires_review");
  });

  it("detects copyright statements", () => {
    expect(classifyRights({ rights: "Copyright reserved by the author" }).status).toBe("copyrighted");
  });

  it("passes through info string", () => {
    const r = classifyRights({ rights: "Public Domain", licenseurl: "https://x" });
    expect(r.info).toContain("Public Domain");
  });
});

// ---------------- importSources.sanitizeText ----------------

describe("sanitizeText", () => {
  it("strips script/style/iframe and all tags", () => {
    expect(sanitizeText("<script>alert(1)</script>hello")).toBe("hello");
    expect(sanitizeText("<style>.x{}</style>hi")).toBe("hi");
    expect(sanitizeText("<iframe src='//evil'></iframe>ok")).toBe("ok");
    expect(sanitizeText("<b>bold</b> text")).toBe("bold text");
  });

  it("decodes entities exactly once (&amp;lt; → &lt; not <)", () => {
    expect(sanitizeText("&lt;p&gt;")).toBe("<p>");
    expect(sanitizeText("&amp;")).toBe("&");
    expect(sanitizeText("&quot;q&quot;&#39;a&#39;&nbsp;b")).toBe('"q"\'a\' b');
  });

  it("removes control characters and collapses whitespace", () => {
    expect(sanitizeText("a\u0000b\u0007c")).toBe("abc");
    expect(sanitizeText("a \t b\n\n c")).toBe("a b c");
  });

  it("truncates to maxLen", () => {
    expect(sanitizeText("abcdef", 3)).toBe("abc");
  });

  it("handles null/undefined/arrays", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
    expect(sanitizeText(["a", "b"])).toBe("a b");
  });
});

// ---------------- importSources.maskProfanity ----------------

describe("maskProfanity", () => {
  it("masks bad words preserving length, case-insensitively", () => {
    const out = maskProfanity("this is shit");
    expect(out).toBe("this is ****");
    expect(maskProfanity("FuCk off")).toBe("**** off");
  });

  it("masks Arabic profanity", () => {
    const out = maskProfanity("يا كلب");
    expect(out).not.toContain("كلب");
    expect(out).toContain("*");
  });

  it("leaves clean text untouched", () => {
    expect(maskProfanity("مراجعة جميلة جدًا، شكرًا!")).toBe("مراجعة جميلة جدًا، شكرًا!");
    expect(maskProfanity("great audiobook")).toBe("great audiobook");
  });
});

// ---------------- royalties.computePoolShares ----------------

describe("computePoolShares", () => {
  const contracts = {
    pub1: { publisherPercentage: 70, hakiPercentage: 30 },
    pub2: { publisherPercentage: 50, hakiPercentage: 50 },
  };

  it("splits proportionally by usage seconds", () => {
    const rows = computePoolShares(
      1000,
      [
        { publisherId: "pub1", seconds: 300 },
        { publisherId: "pub2", seconds: 100 },
      ],
      contracts,
    );
    // pub1 has 75% of usage → 750 gross → 70% = 525
    // pub2 has 25% of usage → 250 gross → 50% = 125
    const p1 = rows.find((r) => r.publisherId === "pub1")!;
    const p2 = rows.find((r) => r.publisherId === "pub2")!;
    expect(p1.grossAmount).toBeCloseTo(750, 0);
    expect(p1.publisherAmount).toBeCloseTo(525, 0);
    expect(p2.publisherAmount).toBeCloseTo(125, 0);
    expect(rows[0].publisherId).toBe("pub1"); // sorted by gross desc
  });

  it("without a contract, the whole gross is held by HAKI", () => {
    const rows = computePoolShares(1000, [{ publisherId: "pubX", seconds: 10 }], {});
    expect(rows[0].hasContract).toBe(false);
    expect(rows[0].publisherAmount).toBe(0);
    expect(rows[0].hakiAmount).toBeCloseTo(1000, 0);
  });

  it("returns empty for zero usage and ignores negative seconds", () => {
    expect(computePoolShares(1000, [], {})).toEqual([]);
    expect(computePoolShares(1000, [{ publisherId: "a", seconds: 0 }], {})).toEqual([]);
    const rows = computePoolShares(
      100,
      [
        { publisherId: "a", seconds: -5 },
        { publisherId: "b", seconds: 10 },
      ],
      {},
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].publisherId).toBe("b");
  });

  it("shares sum to ~100%", () => {
    const rows = computePoolShares(
      999,
      [
        { publisherId: "pub1", seconds: 7 },
        { publisherId: "pub2", seconds: 3 },
      ],
      contracts,
    );
    const totalShare = rows.reduce((a, r) => a + r.usageShare, 0);
    expect(totalShare).toBeCloseTo(100, 0);
  });
});

// ---------------- engagement: statusFor + computeChallengeProgress ----------------

describe("statusFor", () => {
  const now = new Date("2026-09-27T12:00:00");

  it("classifies upcoming/active/ended", () => {
    expect(statusFor("2026-10-01", "2026-10-15", now)).toBe("upcoming");
    expect(statusFor("2026-09-01", "2026-09-30", now)).toBe("active");
    expect(statusFor("2026-08-01", "2026-08-31", now)).toBe("ended");
  });

  it("start day counts as active (00:00 boundary)", () => {
    expect(statusFor("2026-09-27", "2026-09-28", now)).toBe("active");
  });

  it("end day counts as active (23:59 boundary)", () => {
    expect(statusFor("2026-09-20", "2026-09-27", now)).toBe("active");
  });
});

describe("computeChallengeProgress", () => {
  it("completes when progress reaches the target", () => {
    expect(computeChallengeProgress(300, 300).completed).toBe(true);
    expect(computeChallengeProgress(301, 300).completed).toBe(true);
    expect(computeChallengeProgress(299, 300).completed).toBe(false);
  });

  it("clamps target to >= 1 and non-negative progress", () => {
    expect(computeChallengeProgress(0, 0).target).toBe(1);
    expect(computeChallengeProgress(0, -10).target).toBe(1);
    expect(computeChallengeProgress(-5, 10).progress).toBe(0);
    expect(computeChallengeProgress(2.6, 10).progress).toBe(3);
  });

  it("defaults target to 1 when missing", () => {
    const r = computeChallengeProgress(1, null);
    expect(r.target).toBe(1);
    expect(r.completed).toBe(true);
  });
});

// ---------------- Gutenberg URL parsing + normalization ----------------

describe("parseImportUrl", () => {
  it("keeps the IA gutenberg collection on Internet Archive with a language query", () => {
    const r = parseImportUrl('https://archive.org/details/gutenberg?and%5B%5D=language%3A%22English%22');
    expect(r.source).toBe("internet_archive");
    expect(r.collection).toBe("gutenberg");
    // Items are IA records fetched from archive.org/metadata — routing them to
    // Gutendex produced numeric ids that do not exist on archive.org.
    expect(r.query).toBe('language:"English" AND mediatype:texts');
  });

  it("parses the IA collection RSS link into a gutenberg collection import", () => {
    const r = parseImportUrl("https://archive.org/services/collection-rss.php?collection=gutenberg");
    expect(r.source).toBe("internet_archive");
    expect(r.collection).toBe("gutenberg");
  });

  it("extracts language facets from and[] params on any IA collection", () => {
    const r = parseImportUrl('https://archive.org/details/gutenberg?and%5B%5D=language%3A%22Arabic%22');
    expect(r.source).toBe("internet_archive");
    expect(r.query).toBe('language:"Arabic" AND mediatype:texts');
  });

  it("routes gutenberg.org ebook pages to direct ids", () => {
    const r = parseImportUrl("https://www.gutenberg.org/ebooks/1342");
    expect(r.source).toBe("gutenberg");
    expect(r.ids).toEqual(["1342"]);
  });

  it("routes gutenberg search URLs to a query", () => {
    const r = parseImportUrl("https://www.gutenberg.org/ebooks/search/?query=poetry");
    expect(r.source).toBe("gutenberg");
    expect(r.query).toBe("poetry");
  });

  it("keeps plain archive.org collections on internet_archive", () => {
    const r = parseImportUrl("https://archive.org/details/arabic_books");
    expect(r.source).toBe("internet_archive");
    expect(r.collection).toBe("arabic_books");
  });
});

// ---------------- New import core: URL classification + file rules ----------------

describe("classifySourceUrl", () => {
  it("classifies the gutenberg IA collection link with a language facet", () => {
    const r = classifySourceUrl('https://archive.org/details/gutenberg?and%5B%5D=language%3A%22English%22');
    expect(r.source).toBe("internet_archive");
    expect(r.kind).toBe("collection");
    expect(r.collection).toBe("gutenberg");
    expect(r.language).toBe("English");
  });

  it("classifies plain IA collection links", () => {
    const r = classifySourceUrl("https://archive.org/details/librivoxaudio");
    expect(r.kind).toBe("collection");
    expect(r.collection).toBe("librivoxaudio");
  });

  it("classifies IA search links", () => {
    const r = classifySourceUrl("https://archive.org/search?query=poetry+arabic");
    expect(r.kind).toBe("search");
    expect(r.query).toBe("poetry arabic");
  });

  it("classifies single IA item links", () => {
    const r = classifySourceUrl("https://archive.org/details/theboyalliesatli12656gut");
    expect(r.kind).toBe("item");
    expect(r.externalId).toBe("theboyalliesatli12656gut");
  });

  it("classifies the IA collection RSS link", () => {
    const r = classifySourceUrl("https://archive.org/services/collection-rss.php?collection=gutenberg");
    expect(r.kind).toBe("collection");
    expect(r.collection).toBe("gutenberg");
  });

  it("classifies gutenberg.org book and search links", () => {
    expect(classifySourceUrl("https://www.gutenberg.org/ebooks/1342").kind).toBe("item");
    const s = classifySourceUrl("https://www.gutenberg.org/ebooks/search/?query=poetry");
    expect(s.kind).toBe("search");
    expect(s.query).toBe("poetry");
  });

  it("classifies Open Library works and rejects unknown hosts", () => {
    const w = classifySourceUrl("https://openlibrary.org/works/OL12345W");
    expect(w.source).toBe("open_library");
    expect(w.kind).toBe("item");
    expect(() => classifySourceUrl("https://example.com/books")).toThrow();
    expect(() => classifySourceUrl("not-a-url")).toThrow();
  });
});

describe("selectFiles (automatic selection rules)", () => {
  it("selects best electronic formats and all audio chapters, keeps others unselected", () => {
    const files = selectFiles([
      { name: "book.epub", format: "epub", url: "u-epub", size: 100 },
      { name: "book.pdf", format: "pdf", url: "u-pdf", size: 200 },
      { name: "book.txt", format: "txt", url: "u-txt", size: 50 },
      { name: "ch1_128kb.mp3", format: "128Kbps MP3", url: "u-ch1", size: 1000, duration: 120 },
      { name: "ch1_64kb.mp3", format: "64Kbps MP3", url: "u-ch1-low", size: 500, duration: 120 },
      { name: "book.zip", format: "ZIP", url: "u-zip", size: 300 },
    ]);
    const byUrl = Object.fromEntries(files.map((f) => [f.url, f]));
    expect(byUrl["u-epub"].selected).toBe(true);
    expect(byUrl["u-pdf"].selected).toBe(true);
    expect(byUrl["u-txt"].selected).toBe(false); // beyond top-3 priority with epub+pdf first
    expect(byUrl["u-ch1"].selected).toBe(true); // 128kb chapter kept
    expect(byUrl["u-ch1-low"]).toBeUndefined(); // 64kb duplicate dropped entirely
    expect(byUrl["u-zip"].selected).toBe(false);
    expect(files.find((f) => f.kind === "archive")).toBeTruthy();
  });

  it("maps IA gutenberg-mirror text/zip files without inventing formats", () => {
    const files = selectFiles([
      { name: "2657.txt", format: "Text", url: "u-txt", size: 711901 },
      { name: "2657.zip", format: "ZIP", url: "u-zip", size: 249027 },
    ]);
    expect(files.map((f) => f.format).sort()).toEqual(["txt", "zip"]);
    // HAKI policy: txt IS auto-published (epub/pdf/txt) as a last-resort
    // readable format; zip stays unselected.
    expect(files.find((f) => f.format === "txt")!.selected).toBe(true);
  });

  it("auto-selects EPUB, PDF and TXT among electronic formats (HAKI policy)", () => {
    const files = selectFiles([
      { name: "book.epub", format: "epub", url: "u-epub", size: 100 },
      { name: "book.pdf", format: "Text PDF", url: "u-pdf", size: 200 },
      { name: "book.txt", format: "Text", url: "u-txt", size: 50 },
      { name: "book.html", format: "HTML", url: "u-html", size: 60 },
    ]);
    const byUrl = Object.fromEntries(files.map((f) => [f.url, f]));
    expect(byUrl["u-epub"].selected).toBe(true);
    expect(byUrl["u-pdf"].selected).toBe(true);
    expect(byUrl["u-txt"].selected).toBe(true);
    expect(byUrl["u-html"].selected).toBe(false);
  });

  it("computes extensions from names and IA format labels", () => {
    expect(extOf("file.epub")).toBe("epub");
    expect(extOf("Text PDF")).toBe("pdf");
    expect(extOf("128Kbps MP3")).toBe("mp3");
  });
});

// ---------------- New import core: URL classification + file rules ----------------

describe("classifySourceUrl", () => {
  it("classifies the gutenberg IA collection link with a language facet", () => {
    const r = classifySourceUrl('https://archive.org/details/gutenberg?and%5B%5D=language%3A%22English%22');
    expect(r.source).toBe("internet_archive");
    expect(r.kind).toBe("collection");
    expect(r.collection).toBe("gutenberg");
    expect(r.language).toBe("English");
  });

  it("classifies plain IA collections, search links, items and RSS", () => {
    expect(classifySourceUrl("https://archive.org/details/librivoxaudio")).toMatchObject({ kind: "collection", collection: "librivoxaudio" });
    expect(classifySourceUrl("https://archive.org/search?query=poetry")).toMatchObject({ kind: "search", query: "poetry" });
    expect(classifySourceUrl("https://archive.org/details/theboyalliesatli12656gut")).toMatchObject({ kind: "item", externalId: "theboyalliesatli12656gut" });
    expect(classifySourceUrl("https://archive.org/services/collection-rss.php?collection=gutenberg")).toMatchObject({ kind: "collection", collection: "gutenberg" });
  });

  it("classifies gutenberg.org and Open Library links, rejects unknown hosts", () => {
    expect(classifySourceUrl("https://www.gutenberg.org/ebooks/1342")).toMatchObject({ kind: "item", externalId: "1342" });
    expect(classifySourceUrl("https://openlibrary.org/works/OL12345W")).toMatchObject({ source: "open_library", kind: "item" });
    expect(() => classifySourceUrl("https://example.com/books")).toThrow();
    expect(() => classifySourceUrl("not-a-url")).toThrow();
  });
});

describe("selectFiles (automatic selection rules)", () => {
  it("selects best electronic formats and audio chapters, drops dupes, keeps others listed", () => {
    const files = selectFiles([
      { name: "book.epub", format: "epub", url: "u-epub", size: 100 },
      { name: "book.pdf", format: "pdf", url: "u-pdf", size: 200 },
      { name: "book.txt", format: "txt", url: "u-txt", size: 50 },
      { name: "ch1_128kb.mp3", format: "128Kbps MP3", url: "u-ch1", size: 1000, duration: 120 },
      { name: "ch1_64kb.mp3", format: "64Kbps MP3", url: "u-ch1-low", size: 500, duration: 120 },
      { name: "book.zip", format: "ZIP", url: "u-zip", size: 300 },
    ]);
    const byUrl = Object.fromEntries(files.map((f) => [f.url, f]));
    expect(byUrl["u-epub"].selected).toBe(true);
    expect(byUrl["u-pdf"].selected).toBe(true);
    expect(byUrl["u-txt"].selected).toBe(false);
    expect(byUrl["u-ch1"].selected).toBe(true);
    expect(byUrl["u-ch1-low"]).toBeUndefined(); // 64kb duplicate dropped entirely
    expect(byUrl["u-zip"].selected).toBe(false);
    expect(files.find((f) => f.kind === "archive")).toBeTruthy();
  });

  it("maps IA gutenberg-mirror Text/ZIP files without inventing formats", () => {
    const files = selectFiles([
      { name: "2657.txt", format: "Text", url: "u-txt", size: 711901 },
      { name: "2657.zip", format: "ZIP", url: "u-zip", size: 249027 },
    ]);
    expect(files.map((f) => f.format).sort()).toEqual(["txt", "zip"]);
    // HAKI policy: txt IS auto-published (epub/pdf/txt) as a last-resort
    // readable format; zip stays unselected.
    expect(files.find((f) => f.format === "txt")!.selected).toBe(true);
  });

  it("auto-selects EPUB, PDF and TXT among electronic formats (HAKI policy)", () => {
    const files = selectFiles([
      { name: "book.epub", format: "epub", url: "u-epub", size: 100 },
      { name: "book.pdf", format: "Text PDF", url: "u-pdf", size: 200 },
      { name: "book.txt", format: "Text", url: "u-txt", size: 50 },
      { name: "book.html", format: "HTML", url: "u-html", size: 60 },
    ]);
    const byUrl = Object.fromEntries(files.map((f) => [f.url, f]));
    expect(byUrl["u-epub"].selected).toBe(true);
    expect(byUrl["u-pdf"].selected).toBe(true);
    expect(byUrl["u-txt"].selected).toBe(true);
    expect(byUrl["u-html"].selected).toBe(false);
  });

  it("computes extensions from names and IA format labels", () => {
    expect(extOf("file.epub")).toBe("epub");
    expect(extOf("Text PDF")).toBe("pdf");
    expect(extOf("128Kbps MP3")).toBe("mp3");
  });
});

describe("normalizeGutenbergBook", () => {
  const book = {
    id: 1342,
    title: "Pride and Prejudice",
    authors: [{ birth_year: 1775, death_year: 1817, name: "Austen, Jane" }],
    subjects: ["England -- Fiction", "Courtship"],
    bookshelves: ["Best Books Ever Listings"],
    languages: ["en"],
    copyright: false,
    media_type: "Text",
    formats: {
      "application/epub+zip": "https://www.gutenberg.org/ebooks/1342.epub3.images",
      "application/pdf": "https://www.gutenberg.org/ebooks/1342.pdf.images",
      "text/plain; charset=us-ascii": "https://www.gutenberg.org/ebooks/1342.txt.utf-8",
      "text/html": "https://www.gutenberg.org/ebooks/1342.html.images",
    },
    summaries: ["A classic novel of manners."],
  };

  it("marks everything public domain with Gutenberg provenance", () => {
    const n = normalizeGutenbergBook(book);
    expect(n.rightsStatus).toBe("public_domain");
    expect(n.sourceName).toBe("Project Gutenberg");
    expect(n.rightsInfo).toContain("public domain");
  });

  it("maps author, language, subjects and files", () => {
    const n = normalizeGutenbergBook(book);
    expect(n.title).toBe("Pride and Prejudice");
    expect(n.author).toContain("Austen");
    expect(n.originalYear).toBe(1817);
    expect(n.language).toBe("en");
    expect(n.subjects).toContain("Courtship");
    const fmts = n.files.map((f) => f.format);
    expect(fmts).toContain("epub");
    expect(fmts).toContain("pdf");
    expect(fmts).toContain("txt");
  });

  it("builds cover + source urls from the book id", () => {
    const n = normalizeGutenbergBook(book);
    expect(n.coverUrl).toContain("/1342/");
    expect(n.sourceUrl).toBe("https://www.gutenberg.org/ebooks/1342");
  });
});

// ---------------- IA audio support ----------------

describe("parseIaLength", () => {
  it("parses plain seconds", () => {
    expect(parseIaLength("85")).toBe(85);
    expect(parseIaLength("575.37")).toBe(575);
    expect(parseIaLength(123)).toBe(123);
  });

  it("parses MM:SS and HH:MM:SS", () => {
    expect(parseIaLength("01:25")).toBe(85);
    expect(parseIaLength("1:02:03")).toBe(3723);
  });

  it("returns 0 for junk/undefined", () => {
    expect(parseIaLength(undefined)).toBe(0);
    expect(parseIaLength("")).toBe(0);
    expect(parseIaLength("not-a-time")).toBe(0);
  });
});

// ---------------- Imported description sanitization ----------------

describe("sanitizeDescription", () => {
  it("strips HTML tags and decodes entities", () => {
    const out = sanitizeDescription("First part.<br /><br />Second part &amp; more &lt;info&gt;");
    expect(out).toContain("First part.");
    expect(out).toContain("Second part & more");
    expect(out).not.toMatch(/<[^>]+>/);
    expect(out).not.toContain("&amp;");
  });

  it("removes URLs and source-site domains entirely", () => {
    const out = sanitizeDescription("Read online at https://librivox.org/tombstone/ today.");
    expect(out).not.toContain("librivox.org");
    expect(out).not.toContain("https://");
  });

  it("drops link-anchored promotional sentences (LibriVox boilerplate)", () => {
    const raw =
      "A LibriVox recording of Tombstone: An Iliad of the Southwest by Walter Noble Burns. " +
      "First published in 1927, the book defined the legend of Wyatt Earp. " +
      "For further information, including links to online text, please go to the " +
      '<a href="https://librivox.org/tombstone/">LibriVox catalog page</a> for this recording. ' +
      "For more free audio books or to become a volunteer reader, visit " +
      '<a href="https://librivox.org/">librivox.org</a>.';
    const out = sanitizeDescription(raw);
    expect(out).toContain("defined the legend of Wyatt Earp");
    expect(out).not.toMatch(/for further information/i);
    expect(out).not.toMatch(/volunteer reader/i);
    expect(out).not.toContain("librivox.org");
  });

  it("keeps only the work's own synopsis when source mention is embedded", () => {
    const out = sanitizeDescription("Great novel of the desert. More info at archive.org/details/x.");
    expect(out).toContain("Great novel of the desert");
    expect(out).not.toContain("archive.org");
  });

  it("removes narrator summary credits and recording headers", () => {
    const out = sanitizeDescription("LibriVox recording of Moby Dick. The whale strikes. - Summary by John Doe");
    expect(out).not.toMatch(/librivox recording/i);
    expect(out).not.toMatch(/summary by/i);
    expect(out).toContain("The whale strikes");
  });

  it("handles null/empty gracefully", () => {
    expect(sanitizeDescription(null)).toBe("");
    expect(sanitizeDescription(undefined)).toBe("");
    expect(sanitizeDescription("")).toBe("");
  });
});

// ---------------- Chapter naming + single-format policy ----------------

describe("pickAudioTitle", () => {
  it("uses the source's published title when provided (IA chapter names)", () => {
    expect(pickAudioTitle("tombstone_01_burns.mp3", "Chapter 01"), "Chapter 01").toBe("Chapter 01");
    expect(pickAudioTitle("track02.mp3", "Tomstone — Section 2")).toBe("Tomstone — Section 2");
  });

  it("prettifies raw file names when the source has no title", () => {
    expect(pickAudioTitle("tombstone_an_iliad_01_128kb.mp3")).toBe("tombstone an iliad 01");
    expect(pickAudioTitle("tom_sawyer_ch_03_librivox_64kb.mp3")).toBe("tom sawyer ch 03");
    expect(pickAudioTitle("Chapter_02.mp3")).toBe("Chapter_02".replace("_", " "));
  });

  it("falls back to the raw name minus extension when prettifying is meaningless", () => {
    expect(pickAudioTitle("12.mp3")).toBe("12");
    expect(pickAudioTitle("librivox.mp3")).toBe("librivox");
  });
});

describe("pickAudioFormat", () => {
  it("prefers mp3 when present among several audio formats", () => {
    expect(pickAudioFormat(["ogg", "m4b", "mp3"])).toBe("mp3");
    expect(pickAudioFormat(["mp3"])).toBe("mp3");
  });

  it("falls back to a known audio format, then to the first entry", () => {
    expect(pickAudioFormat(["m4b", "ogg"])).toBe("m4b");
    expect(pickAudioFormat(["flac"])).toBe("flac");
    expect(pickAudioFormat([])).toBeUndefined();
  });
});

// ---------------- scheduleLogic (content scheduling) ----------------

describe("scheduleLogic: timezone conversion", () => {
  it("round-trips Cairo wall clock through UTC (winter, UTC+2)", () => {
    const utc = zonedToUtc("2026-01-15", "20:30", "Africa/Cairo");
    // Cairo is UTC+2 in winter: 20:30 local → 18:30 UTC
    expect(new Date(utc).toISOString()).toBe("2026-01-15T18:30:00.000Z");
    expect(zonedDateStr(utc, "Africa/Cairo")).toBe("2026-01-15");
    expect(zonedTimeStr(utc, "Africa/Cairo")).toBe("20:30");
  });

  it("round-trips Cairo wall clock through UTC (summer, UTC+3)", () => {
    const utc = zonedToUtc("2026-07-10", "09:00", "Africa/Cairo");
    // Cairo is UTC+3 in summer (DST resumed 2023): 09:00 local → 06:00 UTC
    expect(new Date(utc).toISOString()).toBe("2026-07-10T06:00:00.000Z");
    expect(zonedDateStr(utc, "Africa/Cairo")).toBe("2026-07-10");
    expect(zonedTimeStr(utc, "Africa/Cairo")).toBe("09:00");
  });

  it("rejects invalid timezones and accepts real ones", () => {
    expect(isValidTimezone("Africa/Cairo")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Bogus/Zone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
  });

  it("uses Africa/Cairo as the platform default", () => {
    expect(DEFAULT_TIMEZONE).toBe("Africa/Cairo");
  });

  it("parses form date/time and rejects malformed input", () => {
    expect(parseFormDateTime("2026-05-01", "08:05")).toEqual({ date: "2026-05-01", time: "08:05" });
    expect(parseFormDateTime("bad", "08:05")).toEqual({ error: "اختر تاريخ النشر" });
    expect(parseFormDateTime("2026-05-01", "")).toEqual({ error: "اختر وقت النشر" });
  });
});

describe("scheduleLogic: nextOccurrenceUtc", () => {
  const base = zonedToUtc("2026-03-01", "09:00", "Africa/Cairo");

  it("returns null for one-off (freq none)", () => {
    expect(
      nextOccurrenceUtc(base, { freq: "none", timeOfDay: "09:00" }, DEFAULT_TIMEZONE),
    ).toBeNull();
  });

  it("computes the next daily occurrence strictly after the anchor", () => {
    const next = nextOccurrenceUtc(base, { freq: "daily", timeOfDay: "09:00" }, DEFAULT_TIMEZONE);
    expect(next).not.toBeNull();
    // Exactly +1 day at the same wall clock
    expect(next! - base).toBe(24 * 3600_000);
  });

  it("weekly picks the next matching weekday", () => {
    // 2026-03-01 is a Sunday. Next Sunday is the 8th.
    const next = nextOccurrenceUtc(
      base,
      { freq: "weekly", weekdays: [0], timeOfDay: "09:00" },
      DEFAULT_TIMEZONE,
    );
    expect(next).not.toBeNull();
    expect(zonedDateStr(next!, DEFAULT_TIMEZONE)).toBe("2026-03-08");
    expect(zonedTimeStr(next!, DEFAULT_TIMEZONE)).toBe("09:00");
  });

  it("weekly can match tomorrow when today's weekday is not selected", () => {
    // Monday Mar 2 → next Thursday Mar 5 (weekdays: [4])
    const monday = zonedToUtc("2026-03-02", "10:00", DEFAULT_TIMEZONE);
    const next = nextOccurrenceUtc(
      monday,
      { freq: "weekly", weekdays: [4], timeOfDay: "10:00" },
      DEFAULT_TIMEZONE,
    );
    expect(zonedDateStr(next!, DEFAULT_TIMEZONE)).toBe("2026-03-05");
  });

  it("monthly clamps to the last day of short months (day 30 → Feb 28)", () => {
    // Jan 30 09:00 Cairo, monthly on day 30 → Feb 28 2026 (non-leap)
    const jan30 = zonedToUtc("2026-01-30", "09:00", DEFAULT_TIMEZONE);
    const next = nextOccurrenceUtc(
      jan30,
      { freq: "monthly", monthDay: 30, timeOfDay: "09:00" },
      DEFAULT_TIMEZONE,
    );
    expect(next).not.toBeNull();
    expect(zonedDateStr(next!, DEFAULT_TIMEZONE)).toBe("2026-02-28");
  });

  it("interval_days skips N-1 days between occurrences", () => {
    const next = nextOccurrenceUtc(
      base,
      { freq: "interval_days", intervalDays: 3, timeOfDay: "09:00" },
      DEFAULT_TIMEZONE,
    );
    expect(next).not.toBeNull();
    expect(zonedDateStr(next!, DEFAULT_TIMEZONE)).toBe("2026-03-04");
  });

  it("stops at endsAt when the next occurrence would exceed it", () => {
    const next = nextOccurrenceUtc(
      base,
      {
        freq: "daily",
        timeOfDay: "09:00",
        endsAt: base + 2 * 24 * 3600_000,
      },
      DEFAULT_TIMEZONE,
    );
    // base+1d ≤ endsAt → still allowed; base+2d === endsAt boundary: first call returns base+1d
    expect(next).not.toBeNull();
    expect(next! - base).toBe(24 * 3600_000);

    // After that, the series ends.
    const after = nextOccurrenceUtc(
      next!,
      { freq: "daily", timeOfDay: "09:00", endsAt: base + 2 * 24 * 3600_000 },
      DEFAULT_TIMEZONE,
    );
    // next = base+1d; candidate base+2d > endsAt? base+2d == endsAt → allowed... but next candidate base+3d > endsAt → null
    // base+2d is allowed since next > endsAt is false (equal), so we get base+2d.
    expect(after).not.toBeNull();
    // Third call: from base+2d, next would be base+3d > endsAt → null.
    const third = nextOccurrenceUtc(
      after!,
      { freq: "daily", timeOfDay: "09:00", endsAt: base + 2 * 24 * 3600_000 },
      DEFAULT_TIMEZONE,
    );
    expect(third).toBeNull();
  });
});

describe("scheduleLogic: publish validation & retry policy", () => {
  it("accepts complete content with an audio URL", () => {
    const r = validateContentForPublish(
      { title: "كتاب", description: "وصف", audioUrl: "https://x/a.mp3" },
      { chapters: 0, episodes: 0 },
    );
    expect(r.ok).toBe(true);
    expect(r.info).toContain("ملف صوتي");
  });

  it("accepts content with chapters as the delivery mechanism", () => {
    const r = validateContentForPublish(
      { title: "كتاب", description: "وصف" },
      { chapters: 3, episodes: 0 },
    );
    expect(r.ok).toBe(true);
  });

  it("rejects content without a description", () => {
    const r = validateContentForPublish(
      { title: "كتاب", description: "" },
      { chapters: 0, episodes: 0 },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("وصف");
  });

  it("rejects content with no delivery mechanism", () => {
    const r = validateContentForPublish(
      { title: "كتاب", description: "وصف" },
      { chapters: 0, episodes: 0 },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toContain("لا يمكن نشره");
  });

  it("treats unavailable import files as missing", () => {
    const r = validateContentForPublish(
      {
        title: "كتاب",
        description: "وصف",
        importFiles: [{ url: "https://x/a.mp3", availability: "unavailable" }],
      },
      { chapters: 0, episodes: 0 },
    );
    expect(r.ok).toBe(false);
  });

  it("retry backoff is 1 min, 5 min, 15 min and caps at 3 attempts", () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(5 * 60_000);
    expect(retryDelayMs(3)).toBe(15 * 60_000);
    expect(MAX_PUBLISH_ATTEMPTS).toBe(3);
  });

  it("blocking statuses are exactly scheduled and publishing", () => {
    expect(isBlockingScheduleStatus("scheduled")).toBe(true);
    expect(isBlockingScheduleStatus("publishing")).toBe(true);
    expect(isBlockingScheduleStatus("draft")).toBe(false);
    expect(isBlockingScheduleStatus("failed")).toBe(false);
    expect(isBlockingScheduleStatus("published")).toBe(false);
    expect(isBlockingScheduleStatus("cancelled")).toBe(false);
  });

  it("labels every schedule status in Arabic", () => {
    expect(scheduleStatusAr("draft")).toBe("مسودة");
    expect(scheduleStatusAr("scheduled")).toBe("مجدول");
    expect(scheduleStatusAr("publishing")).toBe("قيد النشر");
    expect(scheduleStatusAr("published")).toBe("منشور");
    expect(scheduleStatusAr("failed")).toBe("فشل النشر");
    expect(scheduleStatusAr("cancelled")).toBe("ملغي");
    expect(scheduleStatusAr("unknown")).toBe("unknown");
  });
});