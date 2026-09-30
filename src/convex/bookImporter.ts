import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  internalAction,
  action,
} from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import {
  classifySourceUrl,
  selectFiles,
  iaCoverUrl,
  iaFirstPageUrl,
  iaDownloadUrl,
  bestReadableFile,
  sanitizeDescription,
  type ParsedLink,
  type UnifiedFile,
} from "./importCore";
import {
  fetchUnifiedItem,
  discoverPage,
  mapIaMetadata,
  parseIaLength,
  probeUrl,
  type UnifiedItem,
} from "./importAdapters";

// ============================================================
// Book Importer — real data-entry pipeline:
// URL → Source Analysis → Book Discovery (paginated) →
// Metadata Extraction → File Discovery → Duplicate Check →
// Preview → Import Selected → Database → Website.
// All network work goes through official source APIs via the
// unified source adapters (importAdapters.ts).
// ============================================================

// ---------------- Settings helpers ----------------

async function getSetting(ctx: any, key: string): Promise<string | null> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  return row?.value ?? null;
}

// ---------------- Small shared helpers ----------------

function isPd(status?: string): boolean {
  return status === "public_domain";
}

function itemFiles(item: any): UnifiedFile[] {
  try {
    return item.fileUrls ? JSON.parse(item.fileUrls) : [];
  } catch {
    return [];
  }
}

function toStoredFile(f: UnifiedFile) {
  return {
    name: f.name,
    format: f.format,
    kind: f.kind,
    size: f.size,
    url: f.url,
    availability: f.availability ?? "available",
    mime: f.mime,
  };
}

/**
 * Probe a bounded set of selected files against the source and stamp REAL
 * availability (available / restricted / unavailable). Metadata-derived
 * restrictions (private files, access-restricted items) are kept when the
 * probe itself cannot decide.
 */
async function probeSelectedFiles(files: UnifiedFile[], max = 6): Promise<UnifiedFile[]> {
  const selected = files.filter((f) => f.selected);
  const rest = files.filter((f) => !f.selected);
  const out: UnifiedFile[] = [];
  for (const f of selected.slice(0, max)) {
    const p = await probeUrl(f.url);
    const availability: UnifiedFile["availability"] = p.ok
      ? "available"
      : p.status === 403
        ? "restricted"
        : p.status === 404 || p.status === 410 || (p.status !== null && p.status >= 500)
          ? "unavailable"
          : (f.availability ?? "available");
    out.push({ ...f, availability });
  }
  for (const f of selected.slice(max)) out.push({ ...f });
  return [...out, ...rest];
}

/**
 * Resolve a REAL cover URL. IA answers HTTP 200 with a generic "notfound"
 * placeholder when an item has no thumbnail — detect that and fall back to
 * the item's first-page scan image ({id}_page1, typically the first page of
 * the work) so imported books almost always show a real image. When both
 * candidates are placeholders the cover is cleared (never fake).
 */
async function resolveCoverUrl(
  coverUrl?: string,
  fallbackUrl?: string,
): Promise<string | undefined> {
  if (coverUrl) {
    const p = await probeUrl(coverUrl);
    const isImage = (p.contentType ?? "").startsWith("image/");
    const placeholder = /notfound/i.test(p.finalUrl ?? "");
    if (p.ok && isImage && !placeholder) return coverUrl;
  }
  if (fallbackUrl) {
    const pf = await probeUrl(fallbackUrl);
    const isImageF = (pf.contentType ?? "").startsWith("image/");
    const placeholderF = /notfound/i.test(pf.finalUrl ?? "");
    if (pf.ok && isImageF && !placeholderF) return fallbackUrl;
  }
  return undefined;
}

/** Backwards-compatible wrapper used by the analyze stage. */
async function validCoverUrl(coverUrl?: string): Promise<string | undefined> {
  return resolveCoverUrl(coverUrl);
}

// ---------------- Stage logging + action-safe admin gate ----------------

function logStage(stage: string, fields: Record<string, unknown> = {}) {
  console.log(`[HAKI-IMPORT] ${JSON.stringify({ stage, ...fields })}`);
}

/**
 * Convex actions have NO ctx.db, so requireAdmin(ctx) (which reads the user
 * doc with ctx.db.get) crashes inside any action. The viewer is resolved
 * through an internalQuery instead — same role rules, action-safe.
 */
async function adminGate(ctx: any) {
  const viewer: { _id?: string; role?: string; name?: string } | null =
    await ctx.runQuery(internal.bookImporter.getViewerUserInternal, {});
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "super_admin")) {
    throw new ConvexError("غير مصرح: هذه العملية تتطلب صلاحيات المدير");
  }
  return viewer;
}

/** Duplicate check: externalId | sourceUrl | ISBN | title+author (req 10). */
async function findDuplicate(
  ctx: any,
  source: string,
  externalId: string,
  sourceUrl?: string,
  isbn?: string,
  title?: string,
  author?: string,
): Promise<Id<"content"> | null> {
  if (externalId) {
    const byExt = await ctx.db
      .query("content")
      .filter((q: any) => q.eq(q.field("externalId"), externalId))
      .first();
    if (byExt) return byExt._id as Id<"content">;
  }
  if (sourceUrl) {
    const byUrl = await ctx.db
      .query("content")
      .filter((q: any) => q.eq(q.field("sourceUrl"), sourceUrl))
      .first();
    if (byUrl) return byUrl._id as Id<"content">;
  }
  if (isbn) {
    const byIsbn = await ctx.db
      .query("content")
      .filter((q: any) => q.eq(q.field("isbn"), isbn))
      .first();
    if (byIsbn) return byIsbn._id as Id<"content">;
  }
  if (title && author) {
    const candidates = await ctx.db
      .query("content")
      .filter((q: any) => q.eq(q.field("title"), title))
      .take(20);
    for (const c of candidates) {
      if (c.authorId) {
        const a = await ctx.db.get(c.authorId);
        if (a?.name === author) return c._id as Id<"content">;
      }
    }
  }
  return null;
}

// ---------------- Jobs CRUD + settings ----------------

export const getImportSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [batch, publish, minRights, formats] = await Promise.all([
      getSetting(ctx, "import.batchSize"),
      getSetting(ctx, "import.publishMode"),
      getSetting(ctx, "import.minRights"),
      getSetting(ctx, "import.allowedFormats"),
    ]);
    return {
      batchSize: batch ? Number(batch) : 5,
      publishMode: publish ?? "draft",
      minRights: minRights ?? "requires_review",
      allowedFormats: formats ? formats.split(",").map((f) => f.trim()).filter(Boolean) : ["pdf", "epub", "txt", "mp3"],
    };
  },
});

export const setImportSettings = mutation({
  args: {
    batchSize: v.number(),
    publishMode: v.string(),
    minRights: v.string(),
    allowedFormats: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows: [string, string][] = [
      ["import.batchSize", String(Math.min(Math.max(args.batchSize, 1), 25))],
      ["import.publishMode", args.publishMode],
      ["import.minRights", args.minRights],
      ["import.allowedFormats", args.allowedFormats.join(",")],
    ];
    for (const [key, value] of rows) {
      const row = await ctx.db
        .query("settings")
        .withIndex("by_key", (q: any) => q.eq("key", key))
        .first();
      if (row) await ctx.db.patch(row._id, { value });
      else await ctx.db.insert("settings", { key, value });
    }
  },
});

export const createJob = mutation({
  args: {
    source: v.string(),
    mode: v.string(),
    input: v.string(),
    publishMode: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const input = args.input.trim();
    if (!input) throw new Error("أدخل رابطًا أو معرفات");
    // Classify up-front so bad links fail fast in the UI.
    let mode = args.mode;
    let source = args.source;
    if (/^https?:\/\//.test(input)) {
      const link = classifySourceUrl(input);
      source = link.source;
      mode = link.kind;
    }
    const now = Date.now();
    return await ctx.db.insert("import_jobs", {
      source,
      mode,
      input,
      status: "pending",
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      publishMode: args.publishMode,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listJobs = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("import_jobs").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.slice(0, 50);
  },
});

export const getJob = query({
  args: { id: v.id("import_jobs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const listJobItems = query({
  args: { jobId: v.id("import_jobs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("import_items")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows;
  },
});

export const setJobStatus = mutation({
  args: { id: v.id("import_jobs"), status: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, {
      status: args.status as any,
      completedAt: args.status === "completed" || args.status === "cancelled" ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
  },
});

export const cancelJob = mutation({
  args: { id: v.id("import_jobs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: "cancelled", completedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const deleteJob = mutation({
  args: { id: v.id("import_jobs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const items = await ctx.db
      .query("import_items")
      .withIndex("by_job", (q) => q.eq("jobId", args.id))
      .collect();
    for (const it of items) await ctx.db.delete(it._id);
    await ctx.db.delete(args.id);
  },
});

export const retryItem = mutation({
  args: { itemId: v.id("import_items") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.itemId, { status: "pending", error: undefined, updatedAt: Date.now() });
  },
});

export const skipItem = mutation({
  args: { itemId: v.id("import_items") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.itemId, { status: "skipped", updatedAt: Date.now() });
  },
});

// ---------------- 1-2. Analyze URL → discover books (paginated) ----------------
//
// Public actions are thin auth wrappers: Convex actions have no ctx.db, so
// the real logic lives in internalActions that verify the admin via
// getViewerUserInternal and log every stage (IMPORT_STARTED … IMPORT_FAILED).

export const getViewerUserInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/** Step 1: analyze the pasted URL and run the first discovery page (50 books). */
export const analyzeUrl = action({
  args: { url: v.string(), publishMode: v.optional(v.string()) },
  handler: async (ctx, args): Promise<any> => {
    await adminGate(ctx);
    return await ctx.runAction(internal.bookImporter.analyzeUrlInternal, args);
  },
});

export const analyzeUrlInternal = internalAction({
  args: { url: v.string(), publishMode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const url = args.url.trim();
    logStage("IMPORT_STARTED", { url });
    const link = classifySourceUrl(url); // throws Arabic error for bad links
    logStage("SOURCE_DETECTED", {
      source: link.source,
      kind: link.kind,
      collection: link.collection,
      language: link.language,
      externalId: link.externalId,
    });

    const jobId: any = await ctx.runMutation(internal.bookImporter.createJobInternal, {
      source: link.source,
      mode: link.kind,
      input: url,
      publishMode: args.publishMode ?? "draft",
      numFound: 0,
    });

    // Item URL → verify it actually exists, then seed exactly one identifier.
    if (link.kind === "item" && link.externalId) {
      // Fail fast with a clear Arabic message instead of queueing a ghost id.
      const probe = await fetchUnifiedItem(link.source, link.externalId);
      logStage("ITEM_FOUND", { externalId: link.externalId, title: probe.title });
      await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, {
        jobId,
        ids: [link.externalId],
      });
      return { jobId, kind: link.kind, discovered: 1, total: 1, page: 1 };
    }

    // Collection / search URL → official advancedsearch API, first page.
    const first = await discoverPage(link, 1, 50);
    if (first.ids.length === 0) {
      await ctx.runMutation(internal.bookImporter.setJobStatusInternal, {
        id: jobId,
        status: "completed",
        completedAt: Date.now(),
      });
      logStage("IMPORT_FAILED", { stage: "discover", url, message: "لم يُعثر على أي كتاب في هذا الرابط" });
      throw new Error("لم يُعثر على أي كتاب في هذا الرابط — جرّب رابطًا آخر");
    }
    logStage("ITEM_FOUND", { discovered: first.ids.length, sample: first.ids.slice(0, 3), total: first.total });
    await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, { jobId, ids: first.ids });
    await ctx.runMutation(internal.bookImporter.patchJobInternal, {
      id: jobId,
      patch: { numFound: first.total, lastPage: 1 },
    });
    return { jobId, kind: link.kind, discovered: first.ids.length, total: first.total, page: 1 };
  },
});

/** Load the next page of results into the same job (pagination). */
export const discoverMore = action({
  args: { jobId: v.id("import_jobs") },
  handler: async (ctx, args): Promise<any> => {
    await adminGate(ctx);
    return await ctx.runAction(internal.bookImporter.discoverMoreInternal, args);
  },
});

export const discoverMoreInternal = internalAction({
  args: { jobId: v.id("import_jobs") },
  handler: async (ctx, args) => {
    const job: any = await ctx.runQuery(internal.bookImporter.getJobInternal, { id: args.jobId });
    if (!job) throw new Error("المهمة غير موجودة");
    if (job.status === "completed") throw new Error("انتهت هذه المهمة");
    // Item links have no pages — report done instead of hitting the search API.
    if (job.mode === "item") {
      return { added: 0, page: 1, total: job.numFound ?? 1, done: true };
    }
    const link = classifySourceUrl(job.input);
    const page = (job.lastPage ?? 0) + 1;
    const next = await discoverPage(link, page, 50);
    if (next.ids.length === 0) {
      await ctx.runMutation(internal.bookImporter.patchJobInternal, {
        id: args.jobId,
        patch: { status: "completed", completedAt: Date.now() },
      });
      return { added: 0, page, total: job.numFound ?? 0, done: true };
    }
    await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, { jobId: args.jobId, ids: next.ids });
    await ctx.runMutation(internal.bookImporter.patchJobInternal, {
      id: args.jobId,
      patch: { lastPage: page, numFound: next.total },
    });
    return { added: next.ids.length, page, total: next.total, done: false };
  },
});

/**
 * Step 2: extract REAL metadata + files for a batch of pending items
 * (no publishing — everything lands in preview as analyzed).
 */
export const analyzeBatch = action({
  args: { jobId: v.id("import_jobs"), maxItems: v.optional(v.number()) },
  handler: async (ctx, args): Promise<any> => {
    await adminGate(ctx);
    return await ctx.runAction(internal.bookImporter.analyzeBatchInternal, args);
  },
});

export const analyzeBatchInternal = internalAction({
  args: { jobId: v.id("import_jobs"), maxItems: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const max = Math.min(args.maxItems ?? 10, 25);
    const pending: any[] = await ctx.runQuery(internal.bookImporter.listPendingByJobInternal, {
      jobId: args.jobId,
      limit: max,
    });
    let analyzed = 0;
    for (const it of pending) {
      await ctx.runMutation(internal.bookImporter.setItemStatusInternal, {
        itemId: it._id,
        status: "processing",
      });
      try {
        const item: UnifiedItem = await fetchUnifiedItem(it.source, it.externalId);
        let files = item.files;
        logStage("FILES_FOUND", {
          externalId: it.externalId,
          total: files.length,
          selected: files.filter((f) => f.selected).length,
        });
        // REAL availability + REAL cover: verify against the source before
        // anything is shown or stored (no fake download buttons, no fake covers).
        files = await probeSelectedFiles(files);
        const coverUrl = await resolveCoverUrl(item.coverUrl, item.coverFallbackUrl);
        const readable = bestReadableFile(files);
        logStage("METADATA_VALIDATED", {
          externalId: it.externalId,
          cover: coverUrl ?? "none",
          readable: readable ? `${readable.format}:${readable.availability ?? "available"}` : "none",
        });
        await ctx.runMutation(internal.bookImporter.finalizeAnalyzeInternal, {
          itemId: it._id,
          ok: true,
          meta: JSON.stringify(item),
          title: item.title,
          author: item.author,
          year: item.publicationYear,
          language: item.language,
          rightsStatus: item.rights.status,
          rightsInfo: item.rights.info,
          rightsVerified: item.rights.verified,
          coverUrl,
          files: JSON.stringify(files),
          formats: [...new Set(files.map((f) => f.format))],
          filesCount: files.length,
          audioCount: files.filter((f) => f.kind === "audio").length,
          isAudiobook: item.isAudiobook,
          audioDuration: item.audioDuration,
        });
        analyzed += 1;
      } catch (e: any) {
        logStage("IMPORT_FAILED", {
          stage: "metadata",
          externalId: it.externalId,
          message: String(e?.message ?? e),
        });
        await ctx.runMutation(internal.bookImporter.finalizeAnalyzeInternal, {
          itemId: it._id,
          ok: false,
          error: String(e?.message ?? e),
        });
      }
    }
    const remaining: number = await ctx.runQuery(internal.bookImporter.countPendingByJobInternal, {
      jobId: args.jobId,
    });
    return { analyzed, remaining };
  },
});

// ---------------- 8-9. Import Selected (bulk publish to the site) ----------------

/**
 * Step 3: create real content records for the SELECTED analyzed items.
 * Honors per-item selected files and the job's publish policy
 * (draft = keep off the site until review; auto = publish verified PD).
 */
export const importSelected = action({
  args: {
    itemIds: v.array(v.id("import_items")),
    /** Per-item exact checked file indices chosen in the review UI. */
    fileSelection: v.optional(v.record(v.string(), v.array(v.number()))),
  },
  handler: async (ctx, args): Promise<any> => {
    await adminGate(ctx);
    return await ctx.runAction(internal.bookImporter.importSelectedInternal, args);
  },
});

export const importSelectedInternal = internalAction({
  args: {
    itemIds: v.array(v.id("import_items")),
    fileSelection: v.optional(v.record(v.string(), v.array(v.number()))),
  },
  handler: async (ctx, args) => {
    const out: { imported: number; duplicates: number; failed: number; review: number } = {
      imported: 0,
      duplicates: 0,
      failed: 0,
      review: 0,
    };
    for (const itemId of args.itemIds.slice(0, 50)) {
      const item: any = await ctx.runQuery(internal.bookImporter.getItemPublicInternal, {
        itemId,
      });
      if (!item) continue;
      // Already imported before (or flagged by the duplicate check)? Count it
      // as a duplicate instead of silently skipping — the employee sees real numbers.
      if (item.status !== "analyzed") {
        if (["imported", "published", "draft", "requires_review", "duplicate"].includes(item.status)) {
          out.duplicates += 1;
        }
        continue;
      }
      // Apply the employee's exact per-file selection before publishing.
      const indices = args.fileSelection?.[itemId];
      if (indices && item.fileUrls) {
        const files: UnifiedFile[] = JSON.parse(item.fileUrls);
        await ctx.runMutation(internal.bookImporter.setItemFilesSelectedInternal, {
          itemId,
          files: files.map((f, i) => ({ ...f, selected: indices.includes(i) })),
        });
      }
      const meta: UnifiedItem = item.metadata ? JSON.parse(item.metadata) : null;
      if (!meta) continue;
      try {
        // Publish policy comes from the JOB (draft | auto), not per-item guesses.
        const job: any = await ctx.runQuery(internal.bookImporter.getJobInternal, { id: item.jobId });
        const auto = (job?.publishMode ?? "draft") === "auto";
        const asDraft = auto ? !isPd(meta.rights.status) : true;
        const res: any = await ctx.runMutation(internal.bookImporter.publishFromAnalysisInternal, {
          itemId,
          asDraft,
        });
        if (res?.duplicate) out.duplicates += 1;
        else if (res?.ok) {
          if (res.status === "published") {
            // Requirement 14: "imported" only after validating the live row.
            const v = await ctx.runQuery(internal.bookImporter.getContentValidationInternal, {
              contentId: res.contentId,
            });
            const unusable =
              v &&
              ((v.contentType === "ebook" && !v.fileUrl) ||
                (v.contentType === "audiobook" && v.chapters === 0) ||
                !v.description ||
                !v.sourceUrl);
            if (unusable) {
              await ctx.runMutation(internal.bookImporter.setContentNeedsReviewInternal, {
                contentId: res.contentId,
                itemId,
                issues: ["سجل غير مكتمل — ملف أو وصف أو مصدر ناقص بعد النشر"],
              });
              out.review += 1;
            } else {
              out.imported += 1;
            }
          } else out.review += 1;
        } else out.failed += 1;
      } catch (e: any) {
        logStage("IMPORT_FAILED", {
          stage: "publish",
          externalId: item.externalId,
          message: String(e?.message ?? e),
        });
        out.failed += 1;
      }
    }
    logStage("IMPORT_COMPLETED", {
      scope: "selected",
      imported: out.imported,
      duplicates: out.duplicates,
      review: out.review,
      failed: out.failed,
    });
    return out;
  },
});

/** Re-import over an existing book (req 10: update existing instead of dup). */
export const updateExisting = mutation({
  args: {
    itemId: v.id("import_items"),
    overrides: v.optional(
      v.object({
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        author: v.optional(v.string()),
        year: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const item: any = await ctx.db.get(args.itemId);
    if (!item?.contentId && !item?.duplicateOf) throw new Error("لا يوجد كتاب موجود لتحديثه");
    const targetId = (item.contentId ?? item.duplicateOf) as Id<"content">;
    const meta = item.metadata ? JSON.parse(item.metadata) : {};
    const files = itemFiles(item);
    const chosen = files.filter((f) => f.selected);
    const audio = chosen.filter((f) => f.kind === "audio");
    await ctx.db.patch(targetId, {
      title: args.overrides?.title ?? meta.title ?? undefined,
      description:
        args.overrides?.description ?? (sanitizeDescription(meta.description) || undefined),
      coverImage: item.coverUrl ?? undefined,
      fileUrl: audio.length === 0 ? (chosen.find((f) => f.kind === "electronic")?.url ?? undefined) : undefined,
      updatedAt: Date.now(),
    });
    return { ok: true, contentId: targetId };
  },
});

// ---------------- 12/24. History + report ----------------

export const listHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("import_jobs").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.slice(0, args.limit ?? 50).map((j) => ({
      _id: j._id,
      input: j.input,
      source: j.source,
      mode: j.mode,
      status: j.status,
      total: j.total,
      processed: j.processed,
      succeeded: j.succeeded,
      failed: j.failed,
      autoPublished: j.autoPublished ?? 0,
      numFound: j.numFound ?? 0,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      durationMs: j.completedAt ? j.completedAt - j.createdAt : undefined,
    }));
  },
});

/** Aggregated import-run report (requirement 24). */
export const importReport = query({
  args: { jobId: v.optional(v.id("import_jobs")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const jobs = args.jobId
      ? [await ctx.db.get(args.jobId)]
      : await ctx.db.query("import_jobs").collect();
    const items = await ctx.db.query("import_items").collect();
    const scoped = args.jobId ? items.filter((i) => i.jobId === args.jobId) : items;

    let analyzed = 0;
    let imported = 0;
    let duplicates = 0;
    let review = 0;
    let failed = 0;
    let files = 0;
    let electronic = 0;
    let audio = 0;
    let covers = 0;
    for (const it of scoped) {
      const fs = itemFiles(it);
      if (it.status === "analyzed") analyzed += 1;
      else if (["imported", "published", "draft"].includes(it.status)) imported += 1;
      else if (it.status === "duplicate") duplicates += 1;
      else if (it.status === "requires_review") review += 1;
      else if (it.status === "failed") failed += 1;
      files += fs.length;
      electronic += fs.filter((f) => f.kind === "electronic").length;
      audio += fs.filter((f) => f.kind === "audio").length;
      if (it.coverUrl) covers += 1;
    }
    const jobAny: any = jobs.find(Boolean);
    return {
      jobs: jobs.length,
      discovered: scoped.length,
      analyzed,
      imported,
      duplicates,
      review,
      failed,
      files,
      electronic,
      audio,
      covers,
      durationMs: jobAny?.completedAt ? jobAny.completedAt - jobAny.createdAt : undefined,
    };
  },
});

// ============================================================
// Public page validation + Repair / Re-sync (existing imported books)
// ============================================================

/** Live validation of one content row (req 14/15). Admin-only. */
export const getContentValidationInternal = internalQuery({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    const c: any = await ctx.db.get(args.contentId);
    if (!c) return null;
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_content", (q) => q.eq("contentId", args.contentId))
      .collect();
    return {
      slug: c.slug,
      title: c.title,
      description: c.description,
      coverImage: c.coverImage,
      contentType: c.contentType,
      fileUrl: c.fileUrl,
      importFiles: (c as any).importFiles ?? [],
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      externalId: c.externalId,
      status: c.status,
      chapters: chapters.length,
    };
  },
});

export const setContentNeedsReviewInternal = internalMutation({
  args: { contentId: v.id("content"), itemId: v.id("import_items"), issues: v.array(v.string()) },
  handler: async (ctx, args) => {
    const item: any = await ctx.db.get(args.itemId);
    if (item) {
      await ctx.db.patch(args.itemId, { status: "requires_review", updatedAt: Date.now() });
    }
    // Keep the book live but flag it in the report counters (review).
  },
});

/** Admin query: all books created by the Book Importer (import provenance). */
export const listImportedBooks = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("content")
      .filter((q) => q.neq(q.field("importedAt"), undefined))
      .collect();
    rows.sort((a, b) => (b.importedAt ?? 0) - (a.importedAt ?? 0));
    return rows.slice(0, args.limit ?? 300).map((c) => ({
      _id: c._id,
      title: c.title,
      slug: c.slug,
      status: c.status,
      contentType: c.contentType,
      fileUrl: c.fileUrl,
      coverImage: c.coverImage,
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      externalId: c.externalId,
      fileFormats: c.fileFormats,
      importFiles: c.importFiles,
      importedAt: c.importedAt,
      importMethod: c.importMethod,
    }));
  },
});

/**
 * Repair / Re-sync ONE book (req 12): re-fetch source metadata, re-match
 * files with REAL availability probes, repair the cover, repair files,
 * repair source info and missing metadata. Never creates a new book or a
 * duplicate — the row is patched in place.
 */
export const resyncBook = action({
  args: { contentId: v.id("content") },
  handler: async (ctx, args): Promise<any> => {
    await adminGate(ctx);
    return await ctx.runAction(internal.bookImporter.resyncBookInternal, args);
  },
});

export const resyncBookInternal = internalAction({
  args: { contentId: v.id("content") },
  handler: async (ctx, args): Promise<any> => {
    const book: any = await ctx.runQuery(internal.bookImporter.getContentValidationInternal, {
      contentId: args.contentId,
    });
    if (!book || !book.externalId) throw new Error("هذا الكتاب ليس مستوردًا — لا يمكن إعادة المزامنة");
    const source = (book as any).importMethod ?? "internet_archive";
    const changed: string[] = [];
    let failed = "";

    try {
      const item: UnifiedItem = await fetchUnifiedItem(source, book.externalId);
      logStage("REPAIR_STARTED", { externalId: book.externalId, title: book.title });

      let files = await probeSelectedFiles(item.files);
      const cover = await resolveCoverUrl(item.coverUrl, item.coverFallbackUrl);
      const readable = bestReadableFile(files);
      const chosen = files.filter((f) => f.selected);

      const electronic = chosen.filter((f) => f.kind === "electronic" && f.availability === "available");
      const audio = chosen.filter((f) => f.kind === "audio" && f.availability === "available");
      // Same honest fallback as the batch repair path.
      const readableFinal =
        readable && readable.availability === "available" ? readable : electronic[0];

      await ctx.runMutation(internal.bookImporter.applyRepairInternal, {
        contentId: args.contentId,
        patch: {
          fileUrl: audio.length === 0 ? readableFinal?.url : undefined,
          coverImage: cover ?? "",
          description: item.description
            ? (sanitizeDescription(item.description) || undefined)
            : undefined,
          releaseDate: item.publicationDate,
          subtitle: item.subtitle,
          isbn: item.isbn,
          publisher: item.publisher,
          fileFormats: [...new Set(chosen.filter((f) => f.kind === "electronic" || f.kind === "audio").map((f) => f.format))],
          importFiles: chosen.map(toStoredFile),
          sourceName: item.source === "gutenberg" ? "Project Gutenberg" : item.source === "open_library" ? "Open Library" : "Internet Archive",
          sourceUrl: item.sourceUrl,
          externalId: book.externalId,
          rightsStatus: item.rights.status,
          rightsInfo: item.rights.info,
          fileSize: chosen.reduce((a, f) => a + (f.size ?? 0), 0) || undefined,
        },
        chapters: audio.map((f) => ({ title: f.name, url: f.url, duration: f.duration ?? 0 })),
      });
      changed.push("files", "cover", "metadata", "source");

      const v = await ctx.runQuery(internal.bookImporter.getContentValidationInternal, {
        contentId: args.contentId,
      });
      const broken =
        ((v as any).contentType === "ebook" && !(v as any).fileUrl) ||
        ((v as any).contentType === "audiobook" && (v as any).chapters === 0);
      if (broken) failed = "بقي الكتاب بلا ملف قابل للقراءة أو صوتي بعد المزامنة";
      logStage("REPAIR_COMPLETED", { externalId: book.externalId, fileUrl: (v as any).fileUrl, chapters: (v as any).chapters });
    } catch (e: any) {
      failed = String(e?.message ?? e);
      logStage("REPAIR_FAILED", { externalId: book.externalId, message: failed });
    }

    return { ok: !failed, changed, failed, validation: await ctx.runQuery(internal.bookImporter.getContentValidationInternal, { contentId: args.contentId }) };
  },
});

/** DB patcher used by resyncBookInternal (mutations own writes). */
export const applyRepairInternal = internalMutation({
  args: {
    contentId: v.id("content"),
    patch: v.object({
      fileUrl: v.optional(v.string()),
      coverImage: v.optional(v.string()),
      description: v.optional(v.string()),
      releaseDate: v.optional(v.string()),
      subtitle: v.optional(v.string()),
      isbn: v.optional(v.string()),
      publisher: v.optional(v.string()),
      fileFormats: v.optional(v.array(v.string())),
      importFiles: v.optional(v.array(v.any())),
      sourceName: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      externalId: v.optional(v.string()),
      rightsStatus: v.optional(v.string()),
      rightsInfo: v.optional(v.string()),
      fileSize: v.optional(v.number()),
    }),
    chapters: v.array(v.object({ title: v.string(), url: v.string(), duration: v.number() })),
  },
  handler: async (ctx, args) => {
    const c: any = await ctx.db.get(args.contentId);
    if (!c) return { ok: false };
    const p: any = { ...args.patch, updatedAt: Date.now() };
    // Derive the readable URL (epub > pdf > txt) from the verified file list.
    const stored: any[] = Array.isArray(p.importFiles) ? p.importFiles : [];
    if (p.fileUrl === undefined && stored.length > 0) {
      const avail = stored.filter((f) => f.availability === "available");
      const isAudioContent = avail.some((f) => f.kind === "audio");
      if (!isAudioContent) {
        const pick =
          avail.find((f) => f.kind === "electronic" && f.format === "epub") ??
          avail.find((f) => f.kind === "electronic" && f.format === "pdf") ??
          avail.find((f) => f.kind === "electronic" && f.format === "txt");
        if (pick) p.fileUrl = pick.url;
      }
    }
    // publisher lives on the publishers table — keep a keyword instead
    if (p.publisher) {
      p.keywords = [...new Set([...(c.keywords ?? []), `publisher:${p.publisher}`])];
      delete p.publisher;
    }
    // Never blank out a good value with undefined — optional args that were
    // not provided are removed before patching.
    for (const k of Object.keys(p)) {
      if (p[k] === undefined) delete p[k];
    }
    // BUT: an empty cover string is the explicit "cover is fake/missing"
    // signal — patching undefined REMOVES the stored field (no fake covers).
    if (p.coverImage === "") {
      p.coverImage = undefined;
    }
    if (p.importFiles) p.importFiles = p.importFiles as any;
    await ctx.db.patch(args.contentId, p);

    // Rebuild chapters only when the source provides chaptered audio.
    if (args.chapters.length > 0) {
      const old = await ctx.db
        .query("chapters")
        .withIndex("by_content", (q) => q.eq("contentId", args.contentId))
        .collect();
      for (const ch of old) await ctx.db.delete(ch._id);
      let i = 1;
      for (const ch of args.chapters) {
        await ctx.db.insert("chapters", {
          contentId: args.contentId,
          number: i++,
          title: ch.title,
          audioUrl: ch.url,
          duration: ch.duration,
        });
      }
    }
    return { ok: true };
  },
});

/** Batch re-sync for every previously imported book (req 12, batched). */
export const resyncAllBooks = action({
  args: { batchSize: v.optional(v.number()), maxBatches: v.optional(v.number()) },
  handler: async (ctx, args): Promise<any> => {
    await adminGate(ctx);
    return await ctx.runAction(internal.bookImporter.resyncAllInternal, args);
  },
});

export const resyncAllInternal = internalAction({
  args: { batchSize: v.optional(v.number()), maxBatches: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batchSize = Math.min(Math.max(args.batchSize ?? 10, 1), 25);
    const maxBatches = Math.min(args.maxBatches ?? 20, 50);
    const all: any[] = await ctx.runQuery(internal.bookImporter.listImportedBooksInternal, {
      limit: 500,
    });
    let checked = 0;
    let repaired = 0;
    let failed = 0;
    for (let b = 0; b < maxBatches; b++) {
      const slice = all.slice(checked, checked + batchSize);
      if (slice.length === 0) break;
      for (const book of slice) {
        const r: any = await ctx.runAction(internal.bookImporter.resyncBookInternal, {
          contentId: book._id,
        });
        checked += 1;
        if (r.ok) repaired += 1;
        else failed += 1;
      }
    }
    return {
      totalImported: all.length,
      checked,
      repaired,
      failed,
      remaining: Math.max(0, all.length - checked),
    };
  },
});

export const listImportedBooksInternal = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("content")
      .filter((q) => q.neq(q.field("importedAt"), undefined))
      .collect();
    rows.sort((a, b) => (b.importedAt ?? 0) - (a.importedAt ?? 0));
    return rows.slice(0, args.limit).map((c) => ({
      _id: c._id,
      externalId: c.externalId,
      title: c.title,
      importMethod: (c as any).importMethod,
    }));
  },
});

/** Aggregated live repair report over previously imported books (real DB). */
export const repairReport = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("content")
      .filter((q) => q.neq(q.field("importedAt"), undefined))
      .collect();
    let withWorkingFiles = 0;
    let withBrokenFiles = 0;
    let missingSource = 0;
    let missingCover = 0;
    let restricted = 0;
    let totalFiles = 0;
    let availableFiles = 0;
    for (const c of rows) {
      const files: any[] = (c as any).importFiles ?? [];
      totalFiles += files.length;
      availableFiles += files.filter((f) => f.availability === "available").length;
      restricted += files.filter((f) => f.availability && f.availability !== "available").length;
      const usable =
        c.contentType === "audiobook"
          ? files.some((f) => f.kind === "audio" && f.availability === "available")
          : Boolean(c.fileUrl) ||
            files.some(
              (f) =>
                f.kind === "electronic" &&
                ["epub", "pdf", "txt"].includes(f.format) &&
                f.availability === "available",
            );
      if (usable) withWorkingFiles += 1;
      else withBrokenFiles += 1;
      if (!c.sourceUrl || !c.sourceName) missingSource += 1;
      if (!c.coverImage) missingCover += 1;
    }
    return {
      importedBooks: rows.length,
      withWorkingFiles,
      withBrokenFiles,
      missingSource,
      missingCover,
      totalFiles,
      availableFiles,
      restrictedFiles: restricted,
    };
  },
});

// ============================================================
// Internal state machinery (mutations/queries used by actions + cron)
// ============================================================

export const createJobInternal = internalMutation({
  args: {
    source: v.string(),
    mode: v.string(),
    input: v.string(),
    publishMode: v.string(),
    numFound: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("import_jobs", {
      source: args.source,
      mode: args.mode,
      input: args.input,
      status: "pending",
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      publishMode: args.publishMode,
      numFound: args.numFound,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const patchJobInternal = internalMutation({
  args: {
    id: v.id("import_jobs"),
    patch: v.object({
      status: v.optional(v.string()),
      completedAt: v.optional(v.number()),
      numFound: v.optional(v.number()),
      lastPage: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const patch: any = { ...args.patch, updatedAt: Date.now() };
    if (patch.status) patch.status = patch.status as any;
    await ctx.db.patch(args.id, patch);
  },
});

export const setJobStatusInternal = internalMutation({
  args: { id: v.id("import_jobs"), status: v.string(), completedAt: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status as any, updatedAt: Date.now() });
  },
});

export const getJobInternal = internalQuery({
  args: { id: v.id("import_jobs") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

export const seedJobItemsInternal = internalMutation({
  args: { jobId: v.id("import_jobs"), ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("المهمة غير موجودة");
    let added = 0;
    for (const id of args.ids) {
      // Seed-level duplicate protection: never queue the same id twice.
      const existing = await ctx.db
        .query("import_items")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
        .filter((q) => q.eq(q.field("externalId"), id))
        .first();
      if (existing) continue;
      await ctx.db.insert("import_items", {
        jobId: args.jobId,
        source: job.source,
        externalId: id,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      added += 1;
    }
    const all = await ctx.db
      .query("import_items")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    await ctx.db.patch(args.jobId, {
      total: all.length,
      status: job.status === "pending" ? "processing" : job.status,
      updatedAt: Date.now(),
    });
    return { added };
  },
});

export const setItemStatusInternal = internalMutation({
  args: { itemId: v.id("import_items"), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, { status: args.status as any, updatedAt: Date.now() });
  },
});

export const setItemFilesSelectedInternal = internalMutation({
  args: { itemId: v.id("import_items"), files: v.array(v.any()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, { fileUrls: JSON.stringify(args.files), updatedAt: Date.now() });
  },
});

export const listPendingByJobInternal = internalQuery({
  args: { jobId: v.id("import_jobs"), limit: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("import_items")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    return rows
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, args.limit);
  },
});

export const countPendingByJobInternal = internalQuery({
  args: { jobId: v.id("import_jobs") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("import_items")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    return rows.filter((r) => r.status === "pending").length;
  },
});

export const getItemPublicInternal = internalQuery({
  args: { itemId: v.id("import_items") },
  handler: async (ctx, args) => (await ctx.db.get(args.itemId)) ?? null,
});

/** Analysis finalize: NO publishing — items land in preview (analyzed). */
export const finalizeAnalyzeInternal = internalMutation({
  args: {
    itemId: v.id("import_items"),
    ok: v.boolean(),
    error: v.optional(v.string()),
    meta: v.optional(v.string()),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    year: v.optional(v.number()),
    language: v.optional(v.string()),
    rightsStatus: v.optional(v.string()),
    rightsInfo: v.optional(v.string()),
    rightsVerified: v.optional(v.boolean()),
    coverUrl: v.optional(v.string()),
    files: v.optional(v.string()),
    formats: v.optional(v.array(v.string())),
    filesCount: v.optional(v.number()),
    audioCount: v.optional(v.number()),
    isAudiobook: v.optional(v.boolean()),
    audioDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item: any = await ctx.db.get(args.itemId);
    if (!item) return { ok: false };
    const now = Date.now();
    const job: any = await ctx.db.get(item.jobId);

    if (!args.ok) {
      await ctx.db.patch(args.itemId, { status: "failed", error: args.error, updatedAt: now });
      logStage("IMPORT_FAILED", { stage: "metadata_finalize", itemId: args.itemId, message: args.error });
      if (job) {
        await ctx.db.patch(item.jobId, {
          processed: (job.processed ?? 0) + 1,
          failed: (job.failed ?? 0) + 1,
          updatedAt: now,
        });
      }
      return { ok: false };
    }

    const rightsOk = args.rightsStatus === "public_domain" && args.rightsVerified === true;
    await ctx.db.patch(args.itemId, {
      status: "analyzed",
      metadata: args.meta,
      title: args.title,
      author: args.author,
      year: args.year,
      language: args.language,
      rightsStatus: args.rightsStatus,
      // Keep the source rights statement even when unverified (req 18).
      fileUrls: args.files,
      formats: args.formats,
      filesCount: args.filesCount,
      audioCount: args.audioCount,
      isAudiobook: args.isAudiobook ?? false,
      audioDuration: args.audioDuration,
      coverUrl: args.coverUrl,
      error: undefined,
      updatedAt: now,
    });
    if (job) {
      await ctx.db.patch(item.jobId, {
        processed: (job.processed ?? 0) + 1,
        succeeded: (job.succeeded ?? 0) + 1,
        updatedAt: now,
      });
    }
    void rightsOk;
    return { ok: true, status: "analyzed" };
  },
});

/**
 * Publish an ANALYZED item into real site content (database → website).
 * Duplicate-checked; creates chapters for audiobooks from selected audio files.
 */
export const publishFromAnalysisInternal = internalMutation({
  args: {
    itemId: v.id("import_items"),
    asDraft: v.boolean(),
  },
  handler: async (ctx, args) => {
    const item: any = await ctx.db.get(args.itemId);
    if (!item) return { ok: false };
    const meta: UnifiedItem | null = item.metadata ? JSON.parse(item.metadata) : null;
    if (!meta) return { ok: false };

    const files = itemFiles(item);
    const chosen = files.filter((f) => f.selected);
    const audioChapters = chosen
      .filter((f) => f.kind === "audio")
      .map((f) => ({ title: f.name, url: f.url, duration: f.duration ?? 0 }));
    const isAudiobook = audioChapters.length > 0;
    // The readable file is chosen by REAL usability (epub > pdf > txt), never
    // "the first file in the list" and never a zip/torrent container.
    const readable = bestReadableFile(chosen);
    // Honest pipeline: fileUrl is a verified-available readable file only.
    // When nothing qualifies, the post-publish validation flags needs_review.
    const bestFile = isAudiobook ? undefined : readable?.url;

    // Duplicate check right before insert (req 10).
    logStage("DUPLICATE_CHECK", { externalId: item.externalId, title: item.title ?? meta.title });
    const dup = await findDuplicate(
      ctx,
      item.source,
      item.externalId,
      meta.sourceUrl,
      meta.isbn,
      item.title,
      item.author,
    );
    if (dup) {
      await ctx.db.patch(args.itemId, { status: "duplicate", duplicateOf: dup, updatedAt: Date.now() });
      logStage("IMPORT_COMPLETED", { externalId: item.externalId, duplicate: true, contentId: dup });
      return { ok: true, duplicate: true, contentId: dup };
    }

    const title = (item.title ?? meta.title ?? "كتاب مستورد").trim();
    const description = sanitizeDescription(meta.description) || "كتاب مستورد من مصدر عام.";
    const authorName = (item.author ?? meta.author ?? "").trim();

    let authorId: Id<"authors"> | undefined;
    if (authorName) {
      const existing = await ctx.db
        .query("authors")
        .filter((q) => q.eq(q.field("name"), authorName))
        .first();
      if (existing) authorId = existing._id;
      else authorId = await ctx.db.insert("authors", { name: authorName });
    }

    let narratorId: Id<"narrators"> | undefined;
    if (isAudiobook && meta.narrator) {
      const existing = await ctx.db
        .query("narrators")
        .filter((q) => q.eq(q.field("name"), meta.narrator))
        .first();
      if (existing) narratorId = existing._id;
      else narratorId = await ctx.db.insert("narrators", { name: meta.narrator });
    }

    const categoryIds: Id<"categories">[] = [];
    for (const s of (meta.subjects ?? []).slice(0, 12)) {
      const mapping = await ctx.db
        .query("import_category_mappings")
        .withIndex("by_source_subject", (q) =>
          q.eq("source", item.source).eq("subject", String(s).toLowerCase()),
        )
        .first();
      if (mapping && !categoryIds.includes(mapping.categoryId)) {
        categoryIds.push(mapping.categoryId);
      }
    }

    const slugBase =
      title
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || `book-${item.externalId}`;
    const slug = `${slugBase}-${item.externalId.slice(0, 8)}`;
    const now = Date.now();

    logStage("DATABASE_INSERT", {
      externalId: item.externalId,
      title,
      contentType: isAudiobook ? "audiobook" : "ebook",
    });
    const contentId = await ctx.db.insert("content", {
      title,
      slug,
      description: description || "كتاب مستورد من مصدر عام.",
      coverImage: item.coverUrl ?? undefined,
      contentType: isAudiobook ? "audiobook" : "ebook",
      authorId,
      narratorId,
      duration: audioChapters.reduce((a, c) => a + c.duration, 0),
      releaseDate: meta.publicationDate,
      status: args.asDraft ? "draft" : "published",
      isFeatured: false,
      isTrending: false,
      isNew: true,
      playCount: 0,
      fileUrl: bestFile,
      sourceName: item.source === "gutenberg" ? "Project Gutenberg" : item.source === "open_library" ? "Open Library" : "Internet Archive",
      sourceUrl: meta.sourceUrl,
      externalId: item.externalId,
      rightsStatus: (item.rightsStatus ?? "unknown") as any,
      rightsInfo: meta.rights.info,
      fileFormats: [...new Set(chosen.filter((f) => f.kind === "electronic" || f.kind === "audio").map((f) => f.format))],
      // Per-file records with REAL availability (verified in the analyze step).
      importFiles: chosen.map(toStoredFile),
      subtitle: meta.subtitle,
      originalYear: item.year ?? meta.publicationYear,
      pageCount: undefined,
      fileSize: chosen.reduce((a, f) => a + (f.size ?? 0), 0) || undefined,
      isbn: meta.isbn,
      edition: undefined,
      keywords: [...(meta.keywords ?? []), item.language ? `lang:${item.language}` : null].filter(Boolean) as string[],
      importedAt: now,
      importMethod: item.source,
      createdAt: now,
      updatedAt: now,
    });

    for (const categoryId of categoryIds) {
      await ctx.db.insert("content_categories", { contentId, categoryId });
    }
    for (let i = 0; i < audioChapters.length; i++) {
      const ch = audioChapters[i];
      await ctx.db.insert("chapters", {
        contentId,
        number: i + 1,
        title: ch.title,
        audioUrl: ch.url,
        duration: ch.duration,
      });
    }

    await ctx.db.patch(args.itemId, {
      status: args.asDraft ? "draft" : "published",
      contentId,
      updatedAt: now,
    });
    logStage("IMPORT_COMPLETED", {
      externalId: item.externalId,
      contentId,
      status: args.asDraft ? "draft" : "published",
      slug,
    });
    const job: any = await ctx.db.get(item.jobId);
    if (job) {
      await ctx.db.patch(item.jobId, {
        autoPublished: (job.autoPublished ?? 0) + (args.asDraft ? 0 : 1),
        updatedAt: now,
      });
    }
    return { ok: true, contentId, status: args.asDraft ? "draft" : "published" };
  },
});

// ---------------- Legacy admin review publish (kept for compatibility) ----------------

export const publishItem = mutation({
  args: {
    itemId: v.id("import_items"),
    publish: v.boolean(),
    overrides: v.optional(
      v.object({
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        author: v.optional(v.string()),
        year: v.optional(v.number()),
        categoryId: v.optional(v.id("categories")),
        coverImage: v.optional(v.string()),
        fileUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const item: any = await ctx.db.get(args.itemId);
    if (!item) throw new Error("العنصر غير موجود");
    if (item.status !== "analyzed") throw new Error("حلّل الكتاب أولًا قبل النشر");
    const res: any = await ctx.runMutation(internal.bookImporter.publishFromAnalysisInternal, {
      itemId: args.itemId,
      asDraft: !args.publish,
    });
    await ctx.db.patch(args.itemId, { importedBy: admin._id, updatedAt: Date.now() });
    return res;
  },
});

// ---------------- Cron compatibility (scheduled imports keep working) ----------------

export const listPendingJobsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("import_jobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return rows.filter((r) => (r.total ?? 0) === 0).sort((a, b) => a.createdAt - b.createdAt).slice(0, 5);
  },
});

export const setJobStatusInternal2 = internalMutation({
  args: { id: v.id("import_jobs"), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status as any, updatedAt: Date.now() });
  },
});

export const listPendingInternal = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("import_items").collect();
    return rows
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, args.limit);
  },
});

export const getJob2Internal = internalQuery({
  args: { id: v.id("import_jobs") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

/** Cron: discover pending jobs via the unified adapters. */
export const autoDiscoverPendingInternal = internalAction({
  args: { maxJobs: v.optional(v.number()) },
  handler: async (ctx: any, args) => {
    const maxJobs = Math.min(args.maxJobs ?? 3, 5);
    const jobs: any[] = await ctx.runQuery(internal.bookImporter.listPendingJobsInternal, {});
    let handled = 0;
    for (const job of jobs) {
      if (handled >= maxJobs) break;
      let ids: string[] = [];
      try {
        const link = classifySourceUrl(job.input);
        if (link.kind === "item" && link.externalId) {
          ids = [link.externalId];
        } else {
          const page = await discoverPage(link, 1, 60);
          ids = page.ids;
        }
      } catch {
        await ctx.runMutation(internal.bookImporter.setJobStatusInternal, { id: job._id, status: "completed" });
        continue;
      }
      if (ids.length > 0) {
        await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, { jobId: job._id, ids });
        handled += 1;
      } else {
        await ctx.runMutation(internal.bookImporter.setJobStatusInternal, { id: job._id, status: "completed" });
      }
    }
    return { discovered: handled };
  },
});

/** Cron: analyze a small batch (metadata only, no auto publish). */
export const cronProcessBatchInternal = internalAction({
  args: { maxItems: v.optional(v.number()) },
  handler: async (ctx: any, args) => {
    const max = Math.min(args.maxItems ?? 5, 10);
    const pending: any[] = await ctx.runQuery(internal.bookImporter.listPendingInternal, { limit: max });
    let done = 0;
    for (const it of pending) {
      const job: any = await ctx.runQuery(internal.bookImporter.getJobInternal, { id: it.jobId });
      if (!job || job.status === "cancelled" || job.status === "paused") continue;
      try {
        const item: UnifiedItem = await fetchUnifiedItem(it.source, it.externalId);
        await ctx.runMutation(internal.bookImporter.finalizeAnalyzeInternal, {
          itemId: it._id,
          ok: true,
          meta: JSON.stringify(item),
          title: item.title,
          author: item.author,
          year: item.publicationYear,
          language: item.language,
          rightsStatus: item.rights.status,
          rightsInfo: item.rights.info,
          rightsVerified: item.rights.verified,
          coverUrl: item.coverUrl,
          files: JSON.stringify(item.files),
          formats: [...new Set(item.files.map((f) => f.format))],
          filesCount: item.files.length,
          audioCount: item.files.filter((f) => f.kind === "audio").length,
          isAudiobook: item.isAudiobook,
          audioDuration: item.audioDuration,
        });
        done += 1;
      } catch (e: any) {
        await ctx.runMutation(internal.bookImporter.finalizeAnalyzeInternal, {
          itemId: it._id,
          ok: false,
          error: String(e?.message ?? e),
        });
      }
    }
    return { processed: done };
  },
});

// ---------------- Schedules ----------------

export const listSchedules = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("import_schedules").collect();
  },
});

export const createSchedule = mutation({
  args: {
    name: v.string(),
    source: v.string(),
    mode: v.string(),
    input: v.string(),
    limitPerRun: v.number(),
    frequency: v.string(),
    publishMode: v.string(),
    minRights: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    return await ctx.db.insert("import_schedules", {
      name: args.name,
      source: args.source,
      mode: args.mode,
      input: args.input,
      limitPerRun: args.limitPerRun,
      frequency: args.frequency,
      publishMode: args.publishMode,
      allowedFormats: [],
      minRights: args.minRights,
      enabled: true,
      createdBy: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setScheduleEnabled = mutation({
  args: { id: v.id("import_schedules"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { enabled: args.enabled, updatedAt: Date.now() });
  },
});

export const deleteSchedule = mutation({
  args: { id: v.id("import_schedules") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const ensureDefaultScheduleInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("import_schedules")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    const now = Date.now();
    const defaults = [
      {
        name: "\u062c\u0644\u0628 \u064a\u0648\u0645\u064a \u2014 \u0643\u062a\u0628 \u0635\u0648\u062a\u064a\u0629 LibriVox (\u0623\u0631\u0634\u064a\u0641 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a)",
        source: "internet_archive",
        mode: "collection",
        input: "https://archive.org/details/librivoxaudio",
        allowedFormats: ["mp3"],
      },
      {
        name: "\u062c\u0644\u0628 \u064a\u0648\u0645\u064a \u2014 \u0643\u062a\u0628 \u0646\u0635\u064a\u0629 \u0645\u0644\u0643 \u0639\u0627\u0645 (\u0623\u0631\u0634\u064a\u0641 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a)",
        source: "internet_archive",
        mode: "collection",
        input: "https://archive.org/details/gutenberg",
        allowedFormats: ["pdf", "epub", "txt"],
      },
    ];
    for (const d of defaults) {
      if (existing.some((s) => s.name === d.name)) continue;
      await ctx.db.insert("import_schedules", {
        name: d.name,
        source: d.source,
        mode: d.mode,
        input: d.input,
        limitPerRun: 20,
        frequency: "daily",
        publishMode: "draft",
        allowedFormats: d.allowedFormats,
        minRights: "requires_review",
        enabled: true,
        createdBy: undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { created: true };
  },
});

export const runDueSweepInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.bookImporter.ensureDefaultScheduleInternal, {});
    const now = Date.now();
    const schedules = await ctx.db
      .query("import_schedules")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    let enqueued = 0;
    for (const s of schedules) {
      const due =
        s.frequency === "weekly"
          ? now - (s.lastRunAt ?? 0) >= 6.5 * 24 * 3600_000
          : now - (s.lastRunAt ?? 0) >= 23 * 3600_000;
      if (!due) continue;
      await ctx.db.insert("import_jobs", {
        source: s.source,
        mode: "collection",
        input: s.input,
        status: "pending",
        total: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        publishMode: s.publishMode,
        allowedFormats: s.allowedFormats,
        createdBy: s.createdBy,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(s._id, { lastRunAt: now, updatedAt: now });
      enqueued += 1;
      if (enqueued >= 3) break;
    }
    return { enqueued };
  },
});

// ---------------- Category mappings (mapping layer UI) ----------------

export const listCategoryMappings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("import_category_mappings").collect();
    const out = [];
    for (const m of rows) {
      const c = await ctx.db.get(m.categoryId);
      out.push({ _id: m._id, subject: m.subject, source: m.source, categoryName: c?.name ?? "?" });
    }
    return out;
  },
});

export const upsertCategoryMapping = mutation({
  args: { subject: v.string(), categoryId: v.id("categories"), source: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const source = args.source ?? "internet_archive";
    const subject = args.subject.trim().toLowerCase();
    const existing = await ctx.db
      .query("import_category_mappings")
      .withIndex("by_source_subject", (q) => q.eq("source", source).eq("subject", subject))
      .first();
    if (existing) await ctx.db.patch(existing._id, { categoryId: args.categoryId });
    else await ctx.db.insert("import_category_mappings", { source, subject, categoryId: args.categoryId });
  },
});

export const deleteCategoryMapping = mutation({
  args: { id: v.id("import_category_mappings") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ---------------- Sources registry (for the Sources tab) ----------------

export const listSources = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return [
      {
        key: "internet_archive",
        name: "Internet Archive",
        endpoints: ["archive.org/metadata/{id}", "archive.org/advancedsearch.php"],
        rateLimitPerMin: 30,
        officialApi: true,
      },
      {
        key: "gutenberg",
        name: "Project Gutenberg (Gutendex)",
        endpoints: ["gutendex.com/books/"],
        rateLimitPerMin: 30,
        officialApi: true,
      },
      {
        key: "open_library",
        name: "Open Library",
        endpoints: ["openlibrary.org/works/{id}", "covers.openlibrary.org"],
        rateLimitPerMin: 30,
        officialApi: true,
      },
    ];
  },
});
