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
import {
  validateExternalUrl,
  fetchWithLimit,
  fetchBlobWithLimit,
  SOURCES,
  parseImportUrl,
} from "./importSources";

// ---------------- Settings helpers ----------------

async function getSetting(ctx: any, key: string) {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  return row?.value ?? null;
}

async function setSetting(ctx: any, key: string, value: string) {    const row = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", key))
      .first();
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("settings", { key, value });
}

// ---------------- Import settings ----------------

export const getImportSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [batch, publish, minRights, formats] = await Promise.all([
      getSetting(ctx, "import_batch_size"),
      getSetting(ctx, "import_publish_mode"),
      getSetting(ctx, "import_min_rights"),
      getSetting(ctx, "import_allowed_formats"),
    ]);
    return {
      batchSize: Number(batch ?? 5),
      publishMode: publish ?? "draft",
      minRights: minRights ?? "requires_review",
      allowedFormats: formats ? JSON.parse(formats) : ["pdf", "epub", "txt"],
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
    await setSetting(ctx, "import_batch_size", String(Math.min(Math.max(args.batchSize, 1), 25)));
    await setSetting(ctx, "import_publish_mode", args.publishMode);
    await setSetting(ctx, "import_min_rights", args.minRights);
    await setSetting(ctx, "import_allowed_formats", JSON.stringify(args.allowedFormats));
  },
});

// ---------------- Category mapping ----------------

export const listCategoryMappings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("import_category_mappings").collect();
    return await Promise.all(
      rows.map(async (m) => {
        const cat = await ctx.db.get(m.categoryId);
        return { ...m, categoryName: cat?.name ?? "—" };
      }),
    );
  },
});

export const upsertCategoryMapping = mutation({
  args: { id: v.optional(v.id("import_category_mappings")), subject: v.string(), categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const subject = args.subject.trim().toLowerCase();
    if (!subject) throw new Error("الموضوع مطلوب");
    if (args.id) {
      await ctx.db.patch(args.id, { subject, categoryId: args.categoryId });
      return args.id;
    }
    const existing = await ctx.db
      .query("import_category_mappings")
      .withIndex("by_source_subject", (q) => q.eq("source", "internet_archive").eq("subject", subject))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { categoryId: args.categoryId });
      return existing._id;
    }
    return await ctx.db.insert("import_category_mappings", {
      source: "internet_archive",
      subject,
      categoryId: args.categoryId,
    });
  },
});

export const deleteCategoryMapping = mutation({
  args: { id: v.id("import_category_mappings") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ---------------- Duplicate detection ----------------

async function findDuplicate(
  ctx: any,
  externalId: string,
  sourceUrl: string | undefined,
  isbn: string | undefined,
  title: string,
  author: string | undefined,
): Promise<Id<"content"> | null> {
  if (externalId) {
    const byId = await ctx.db
      .query("content")
      .filter((q: any) => q.eq(q.field("externalId"), externalId))
      .first();
    if (byId) return byId._id;
  }
  if (isbn) {
    const byIsbn = await ctx.db
      .query("content")
      .filter((q: any) => q.eq(q.field("isbn"), isbn))
      .first();
    if (byIsbn) return byIsbn._id;
  }
  if (sourceUrl) {
    const byUrl = await ctx.db
      .query("content")
      .filter((q: any) => q.eq(q.field("sourceUrl"), sourceUrl))
      .first();
    if (byUrl) return byUrl._id;
  }
  if (title) {
    const byTitle = await ctx.db
      .query("content")
      .filter((q: any) =>
        q.and(q.eq(q.field("title"), title), author ? q.eq(q.field("importAuthor") ?? q.field("title"), author) : q.eq(q.field("title"), title)),
      )
      .first();
    if (byTitle) return byTitle._id;
  }
  return null;
}

// ---------------- Jobs ----------------

export const createJob = mutation({
  args: {
    source: v.string(),
    mode: v.string(),
    input: v.string(),
    publishMode: v.string(),
    allowedFormats: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const input = args.input.trim();
    if (!input) throw new Error("أدخل رابطًا أو معرفات");
    return await ctx.db.insert("import_jobs", {
      source: args.source,
      mode: args.mode,
      input,
      status: "pending",
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      publishMode: args.publishMode,
      allowedFormats: args.allowedFormats,
      createdBy: admin._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
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

/** Full import history (recent items across jobs). */
export const listHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("import_items").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    const recent = rows.slice(0, args.limit ?? 100);
    // Attach importer usernames for the "Imported by" column.
    const out = [];
    for (const r of recent) {
      let importedByName: string | undefined;
      if (r.importedBy) {
        const u = await ctx.db.get(r.importedBy);
        importedByName = (u as any)?.name ?? (u as any)?.email ?? undefined;
      }
      out.push({ ...r, importedByName });
    }
    return out;
  },
});

export const setJobStatus = mutation({
  args: {
    id: v.id("import_jobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
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
    for (const i of items) await ctx.db.delete(i._id);
    await ctx.db.delete(args.id);
  },
});

/** Cancel a running job: marks it cancelled and skips pending items. */
export const cancelJob = mutation({
  args: { id: v.id("import_jobs") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: "cancelled", updatedAt: Date.now() });
    const items = await ctx.db
      .query("import_items")
      .withIndex("by_job", (q) => q.eq("jobId", args.id))
      .collect();
    for (const i of items) {
      if (i.status === "pending" || i.status === "processing") {
        await ctx.db.patch(i._id, { status: "skipped", updatedAt: Date.now() });
      }
    }
  },
});

// ---------------- Scheduled imports ----------------

export const listSchedules = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("import_schedules").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
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
    allowedFormats: v.optional(v.array(v.string())),
    minRights: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const now = Date.now();
    return await ctx.db.insert("import_schedules", {
      ...args,
      limitPerRun: Math.min(Math.max(args.limitPerRun, 1), 200),
      enabled: true,
      createdBy: admin._id,
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

/**
 * Background sweep (cron, every 6h): enqueue one job per due schedule and
 * process a small pending batch from existing jobs. Frequency (daily/weekly)
 * is respected by comparing lastRunAt with the current time.
 */
/**
 * Ensures the default auto-import schedule exists: a daily Gutenberg pull
 * (English) that publishes public-domain books automatically. Created once,
 * safe to call on every sweep.
 */
export const ensureDefaultScheduleInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("import_schedules")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    if (existing.some((s) => s.source === "gutenberg")) return { created: false };

    const now = Date.now();
    await ctx.db.insert("import_schedules", {
      name: "\u062c\u0644\u0628 \u064a\u0648\u0645\u064a \u2014 \u063a\u0648\u062a\u0646\u0628\u0631\u063a (\u0625\u0646\u062c\u0644\u064a\u0632\u064a) \u0645\u0644\u0643 \u0639\u0627\u0645",
      source: "gutenberg",
      mode: "search",
      input: "languages=en",
      limitPerRun: 20,
      frequency: "daily",
      publishMode: "auto",
      allowedFormats: ["epub", "txt", "html"],
      minRights: "public_domain",
      enabled: true,
      createdBy: undefined,
      createdAt: now,
      updatedAt: now,
    });
    return { created: true };
  },
});

export const runDueSweepInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Self-heal: make sure the default Gutenberg auto-import exists.
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

      const jobId = await ctx.db.insert("import_jobs", {
        source: s.source,
        mode: s.mode,
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
      if (enqueued >= 3) break; // Gentle: max 3 scheduled jobs per sweep.
      void jobId;
    }
    return { enqueued };
  },
});

/**
 * Auto-discovery step (cron): finds jobs still "pending" with zero items
 * (created by the sweep from schedules or auto-tasks) and resolves their
 * candidate ids via the official APIs — Gutenberg via Gutendex, others via
 * the IA advancedsearch endpoint. Fully automatic: publishes public-domain
 * Gutenberg books when the job's publishMode is "auto".
 */
export const autoDiscoverPendingInternal = internalAction({
  args: { maxJobs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const maxJobs = Math.min(args.maxJobs ?? 3, 5);
    const jobs: any[] = await ctx.runQuery(internal.bookImporter.listPendingJobsInternal, {});
    let handled = 0;
    for (const job of jobs) {
      if (handled >= maxJobs) break;

      let ids: string[] = [];
      if (job.source === "gutenberg") {
        // Schedule input may be "languages=en" style query or free text.
        const raw = String(job.input ?? "");
        const q = raw.startsWith("languages=")
          ? `https://gutendex.com/books?${raw}&page=1`
          : `https://gutendex.com/books?search=${encodeURIComponent(raw)}&page=1`;
        const data = await fetchWithLimit(q);
        const results: any[] = data?.results ?? [];
        ids = results.map((b) => String(b.id)).filter(Boolean).slice(0, 60);
      } else {
        const q = `${job.input} AND mediatype:texts`;
        const endpoint = SOURCES.internet_archive.searchEndpoint
          .replace("{q}", encodeURIComponent(q))
          .replace("{page}", "1")
          .replace("{rows}", "60");
        const data = await fetchWithLimit(endpoint);
        const docs: any[] = data?.response?.docs ?? [];
        ids = docs.map((d) => String(d.identifier)).filter(Boolean).slice(0, 60);
      }

      if (ids.length > 0) {
        await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, {
          jobId: job._id,
          ids,
        });
        handled += 1;
      } else {
        // Nothing found — fail the job so it is not retried forever.
        await ctx.runMutation(internal.bookImporter.setJobStatusInternal, {
          id: job._id,
          status: "completed",
        });
      }
    }
    return { discovered: handled };
  },
});

export const listPendingJobsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("import_jobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return rows
      .filter((r) => (r.total ?? 0) === 0)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 5);
  },
});

export const setJobStatusInternal = internalMutation({
  args: { id: v.id("import_jobs"), status: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status as any, updatedAt: Date.now() });
  },
});

/**
 * Background batch processor (cron path, no admin session): fetches pending
 * items through the SAME core logic as the admin action, via the shared
 * internal core (no auth check needed — internal functions are not callable
 * from clients).
 */
export const cronProcessBatchInternal = internalAction({
  args: { maxItems: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const max = Math.min(args.maxItems ?? 5, 10);
    const pending: any[] = await ctx.runQuery(internal.bookImporter.listPendingInternal, { limit: max });
    let done = 0;
    for (const it of pending) {
      const job: any = await ctx.runQuery(internal.bookImporter.getJobInternal, { id: it.jobId });
      if (!job || job.status !== "processing") continue;
      const res: any = await ctx.runAction(internal.bookImporter.fetchItemCore, {
        itemId: it._id,
        publishMode: job.publishMode,
      });
      if (res?.ok) done += 1;
    }
    return { processed: done };
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

export const getJobInternal = internalQuery({
  args: { id: v.id("import_jobs") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

type FetchCoreResult = {
  ok: boolean;
  title?: string;
  rights?: string;
  error?: string;
};

/**
 * Shared core: fetch one item's metadata + store cover. Used by both the
 * admin action (with requireAdmin) and the cron batch processor.
 */
export const fetchItemCore = internalAction({
  args: {
    itemId: v.id("import_items"),
    publishMode: v.optional(v.string()),
  },
  handler: async (ctx: any, args): Promise<FetchCoreResult> => {
    const item: any = await ctx.runQuery(internal.bookImporter.getItemQueryInternalQuery, {
      itemId: args.itemId,
    });
    if (!item) throw new Error("العنصر غير موجود");
    const source = SOURCES[item.source] ?? SOURCES.internet_archive;
    const { fetchIaItem } = await import("./importSources");

    try {
      const norm = await fetchIaItem(item.externalId, source);

      // Download the cover into platform storage when available.
      let storedCover: string | undefined;
      if (norm.coverUrl) {
        try {
          const { buf, type } = await fetchBlobWithLimit(norm.coverUrl);
          if (buf.byteLength > 0 && buf.byteLength < 3_000_000 && type.startsWith("image/")) {
            const storageId = await ctx.storage.store(new Uint8Array(buf), { type });
            storedCover = (await ctx.storage.getUrl(storageId)) ?? undefined;
          }
        } catch {
          // Cover download is best-effort; keep the source URL as fallback.
        }
      }

      await ctx.runMutation(internal.bookImporter.finalizeItemInternal, {
        itemId: args.itemId,
        ok: true,
        metadata: JSON.stringify(norm),
        title: norm.title,
        author: norm.author,
        year: norm.originalYear,
        language: norm.language,
        rightsStatus: norm.rightsStatus,
        formats: norm.files.map((f: any) => f.format),
        coverUrl: storedCover ?? norm.coverUrl,
        fileUrls: JSON.stringify(norm.files),
        publishMode: args.publishMode,
      });
      return { ok: true, title: norm.title, rights: norm.rightsStatus };
    } catch (e: any) {
      await ctx.runMutation(internal.bookImporter.finalizeItemInternal, {
        itemId: args.itemId,
        ok: false,
        error: String(e?.message ?? e),
      });
      return { ok: false, error: String(e?.message ?? e) };
    }
  },
});

// ---------------- Discovery (network actions) ----------------

/**
 * Admin action: given a search/collection URL or identifiers, resolve the
 * candidate external IDs via the official IA advancedsearch API and enqueue
 * them. Network work happens here; queue state lives in mutations.
 */
export const discoverCandidates = action({
  args: {
    jobId: v.id("import_jobs"),
    source: v.string(),
    mode: v.string(),
    input: v.string(),
  },
  handler: async (ctx: any, args) => {
    await requireAdmin(ctx as any);
    let source = args.source;
    let mode = args.mode;
    let input = args.input;

    // Auto-detect pasted URLs (archive.org gutenberg collections, gutenberg.org,
    // gutendex.com) and route to the right source without admin configuration.
    if (/^https?:\/\//.test(input.trim())) {
      const parsed = parseImportUrl(input.trim());
      source = parsed.source;
      const gutenbergSource = parsed.source === "gutenberg";

      // Explicit ids found in the URL (single ebook pages).
      if (parsed.ids.length > 0) {
        await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, {
          jobId: args.jobId,
          ids: parsed.ids,
        });
        return { count: parsed.ids.length };
      }

      if (gutenbergSource) {
        // Gutendex search/collection query.
        const q = parsed.query ?? "";
        const endpoint = `https://gutendex.com/books?${q}${q ? "&" : ""}page=1`;
        const data = await fetchWithLimit(endpoint);
        const results: any[] = data?.results ?? [];
        const ids = results.map((b) => String(b.id)).filter(Boolean).slice(0, 200);
        if (ids.length === 0) throw new Error("\u0644\u0645 \u064a\u064f\u0639\u062b\u0631 \u0639\u0644\u0649 \u0643\u062a\u0628 \u2014 \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0627\u0628\u0637 \u0623\u0648 \u0627\u0644\u0645\u0639\u0631\u0641\u0627\u062a");
        await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, { jobId: args.jobId, ids });
        return { count: ids.length };
      }

      // Internet Archive: derive query from the URL (existing behaviour).
      const collectionMatch = parsed.collection;
      const q = parsed.query
        ? `${parsed.query} AND mediatype:texts`
        : collectionMatch
          ? `collection:${collectionMatch} AND mediatype:texts`
          : `${input.replace(/["<>]/g, "").slice(0, 120)} AND mediatype:texts`;
      const iaEndpoint = SOURCES.internet_archive.searchEndpoint
        .replace("{q}", encodeURIComponent(q))
        .replace("{page}", "1")
        .replace("{rows}", "40");
      const data = await fetchWithLimit(iaEndpoint);
      const docs: any[] = data?.response?.docs ?? [];
      const ids = docs.map((d) => String(d.identifier)).filter(Boolean).slice(0, 200);
      if (ids.length === 0) throw new Error("\u0644\u0645 \u064a\u064f\u0639\u062b\u0631 \u0639\u0644\u0649 \u0643\u062a\u0628 \u2014 \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0627\u0628\u0637 \u0623\u0648 \u0627\u0644\u0645\u0639\u0631\u0641\u0627\u062a");
      await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, { jobId: args.jobId, ids });
      return { count: ids.length };
    }

    // ---- No URL pasted: original id-list / collection / search flows ----
    const sourceCfg = SOURCES[source];
    if (!sourceCfg) throw new Error("\u0645\u0635\u062f\u0631 \u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641");
    let ids: string[] = [];

    if (mode === "ids") {
      ids = input
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 200);
    } else if (source === "gutenberg") {
      const endpoint = `https://gutendex.com/books?search=${encodeURIComponent(input)}&page=1`;
      const data = await fetchWithLimit(endpoint);
      const results: any[] = data?.results ?? [];
      ids = results.map((b) => String(b.id)).filter(Boolean).slice(0, 200);
    } else {
      const q =
        mode === "collection"
          ? `collection:${input} AND mediatype:texts`
          : `${input.replace(/["<>]/g, "").slice(0, 120)} AND mediatype:texts`;
      const endpoint = sourceCfg.searchEndpoint
        .replace("{q}", encodeURIComponent(q))
        .replace("{page}", "1")
        .replace("{rows}", "40");
      const data = await fetchWithLimit(endpoint);
      const docs: any[] = data?.response?.docs ?? [];
      ids = docs.map((d) => String(d.identifier)).filter(Boolean).slice(0, 200);
    }

    if (ids.length === 0) throw new Error("\u0644\u0645 \u064a\u064f\u0639\u062b\u0631 \u0639\u0644\u0649 \u0643\u062a\u0628 \u2014 \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0627\u0628\u0637 \u0623\u0648 \u0627\u0644\u0645\u0639\u0631\u0641\u0627\u062a");
    await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, { jobId: args.jobId, ids });
    return { count: ids.length };
  },
});

/**
 * Admin action: fetch full metadata for ONE queued item via the official IA
 * metadata endpoint, then finalize it (dup-check + status) internally.
 */
export const fetchItemMetadata = action({
  args: {
    itemId: v.id("import_items"),
    publishMode: v.optional(v.string()),
  },
  handler: async (ctx: any, args): Promise<FetchCoreResult> => {
    await requireAdmin(ctx as any);
    // Delegate to the shared internal core (same logic as the cron path).
    return await ctx.runAction(internal.bookImporter.fetchItemCore, {
      itemId: args.itemId,
      publishMode: args.publishMode,
    });
  },
});

/** Internal: discover candidates and enqueue them (no external calls here). */
export const seedJobItemsInternal = internalMutation({
  args: { jobId: v.id("import_jobs"), ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("المهمة غير موجودة");
    for (const id of args.ids) {
      await ctx.db.insert("import_items", {
        jobId: args.jobId,
        source: job.source,
        externalId: id,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(args.jobId, {
      total: args.ids.length,
      status: "processing",
      updatedAt: Date.now(),
    });
  },
});

/** Internal read used by the fetch core (returns the doc or null). */
export const getItemQueryInternalQuery = internalQuery({
  args: { itemId: v.id("import_items") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.itemId);
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  },
});

/** Internal: process ONE item in a batch (called repeatedly by the client loop). */
export const processNextItemInternal = internalMutation({
  args: { jobId: v.id("import_jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "processing") return { done: true };

    const pending = await ctx.db
      .query("import_items")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
    const next = pending.find((p) => p.status === "pending");
    if (!next) {
      const failed = pending.filter((p) => p.status === "failed").length;
      await ctx.db.patch(args.jobId, {
        status: "completed",
        processed: pending.length,
        succeeded: pending.length - failed,
        failed,
        updatedAt: Date.now(),
      });
      return { done: true };
    }

    await ctx.db.patch(next._id, { status: "processing", updatedAt: Date.now() });
    return {
      done: false,
      itemId: next._id,
      externalId: next.externalId,
      publishMode: job.publishMode,
    };
  },
});

/** Internal: finish an item with fetched metadata (called from the action). */
export const finalizeItemInternal = internalMutation({
  args: {
    itemId: v.id("import_items"),
    ok: v.boolean(),
    error: v.optional(v.string()),
    metadata: v.optional(v.string()),
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    year: v.optional(v.number()),
    language: v.optional(v.string()),
    rightsStatus: v.optional(v.string()),
    formats: v.optional(v.array(v.string())),
    coverUrl: v.optional(v.string()),
    fileUrls: v.optional(v.string()),
    publishMode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) return { ok: false };

    if (!args.ok) {
      await ctx.db.patch(args.itemId, {
        status: "failed",
        error: args.error ?? "خطأ غير معروف",
        updatedAt: Date.now(),
      });
      // Advance job progress on failure too.
      const job0 = await ctx.db.get(item.jobId);
      if (job0) {
        await ctx.db.patch(item.jobId, {
          processed: job0.processed + 1,
          failed: job0.failed + 1,
          updatedAt: Date.now(),
        });
      }
      return { ok: false };
    }

    // Duplicate protection (externalId / ISBN / sourceUrl / title+author).
    const meta = args.metadata ? JSON.parse(args.metadata) : {};
    const dup = await findDuplicate(
      ctx,
      item.externalId,
      meta.sourceUrl,
      meta.isbn,
      args.title ?? "",
      args.author,
    );

    if (dup) {
      await ctx.db.patch(args.itemId, {
        status: "duplicate",
        duplicateOf: dup,
        metadata: args.metadata,
        title: args.title,
        author: args.author,
        updatedAt: Date.now(),
      });
      const jobD = await ctx.db.get(item.jobId);
      if (jobD) {
        await ctx.db.patch(item.jobId, { processed: jobD.processed + 1, updatedAt: Date.now() });
      }
      return { ok: true, duplicate: true, contentId: dup };
    }

    // Default status by publish mode + rights.
    let status: string;
    if (args.publishMode === "auto" && args.rightsStatus === "public_domain") {
      status = "published";
    } else if (args.publishMode === "auto") {
      status = "requires_review";
    } else {
      status = "draft";
    }

    await ctx.db.patch(args.itemId, {
      status: status as any,
      metadata: args.metadata,
      title: args.title,
      author: args.author,
      year: args.year,
      language: args.language,
      rightsStatus: args.rightsStatus,
      formats: args.formats,
      coverUrl: args.coverUrl,
      fileUrls: args.fileUrls,
      updatedAt: Date.now(),
    });
    const jobF = await ctx.db.get(item.jobId);
    if (jobF) {
      await ctx.db.patch(item.jobId, { processed: jobF.processed + 1, updatedAt: Date.now() });
    }
    return { ok: true, status };
  },
});

/** Admin: publish/import one queued item as a content record (editable first). */
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
        language: v.optional(v.string()),
        categoryId: v.optional(v.id("categories")),
        coverImage: v.optional(v.string()),
        fileUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("العنصر غير موجود");
    const meta = item.metadata ? JSON.parse(item.metadata) : {};

    const title = (args.overrides?.title ?? item.title ?? meta.title ?? "كتاب مستورد").trim();
    const description = (args.overrides?.description ?? meta.description ?? "").slice(0, 4000);
    const authorName = (args.overrides?.author ?? item.author ?? meta.author ?? "").trim();

    // Resolve or create the author entity.
    let authorId: Id<"authors"> | undefined;
    if (authorName) {
      const existing = await ctx.db
        .query("authors")
        .filter((q) => q.eq(q.field("name"), authorName))
        .first();
      if (existing) authorId = existing._id;
      else {
        authorId = await ctx.db.insert("authors", {
          name: authorName,
          nameEn: meta.authorEn,
          bio: meta.authorBio,
          image: undefined,
        });
      }
    }

    // Map subjects → internal categories via admin-editable mappings.
    const categoryIds: Id<"categories">[] = [];
    const subjects: string[] = meta.subjects ?? [];
    for (const s of subjects) {
      const mapping = await ctx.db
        .query("import_category_mappings")
        .withIndex("by_source_subject", (q) =>
          q.eq("source", item.source).eq("subject", s.toLowerCase()),
        )
        .first();
      if (mapping && !categoryIds.includes(mapping.categoryId)) {
        categoryIds.push(mapping.categoryId);
      }
    }
    if (args.overrides?.categoryId && !categoryIds.includes(args.overrides.categoryId)) {
      categoryIds.push(args.overrides.categoryId);
    }

    const slugBase =
      title
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || `book-${item.externalId}`;
    const slug = `${slugBase}-${item.externalId.slice(0, 8)}`;

    const now = Date.now();
    const bestFile =
      args.overrides?.fileUrl ??
      (meta.files?.length ? meta.files.find((f: any) => f.format === "pdf")?.url ?? meta.files[0]?.url : undefined);

    const contentId = await ctx.db.insert("content", {
      title,
      slug,
      description: description || "كتاب مستورد من مصدر عام.",
      coverImage: args.overrides?.coverImage ?? item.coverUrl ?? undefined,
      contentType: "ebook",
      authorId,
      duration: 0,
      releaseDate: meta.pubDate,
      status: args.publish ? "published" : "draft",
      isFeatured: false,
      isTrending: false,
      isNew: true,
      playCount: 0,
      fileUrl: bestFile,
      sourceName: meta.sourceName ?? "Internet Archive",
      sourceUrl: meta.sourceUrl ?? item.sourceUrl,
      externalId: item.externalId,
      rightsStatus: (item.rightsStatus ?? "requires_review") as any,
      rightsInfo: meta.rightsInfo,
      fileFormats: item.formats ?? [],
      subtitle: meta.subtitle,
      originalYear: args.overrides?.year ?? item.year ?? meta.originalYear,
      pageCount: meta.pageCount,
      fileSize: meta.fileSize,
      isbn: meta.isbn,
      edition: meta.edition,
      // language is not a content column; keep it in keywords as provenance.
      keywords: [...(meta.keywords ?? []), item.language ? `lang:${item.language}` : null].filter(
        Boolean,
      ) as string[],
      importedAt: now,
      importMethod: item.source,
      createdAt: now,
      updatedAt: now,
    });

    for (const categoryId of categoryIds) {
      await ctx.db.insert("content_categories", { contentId, categoryId });
    }

    await ctx.db.patch(args.itemId, {
      status: args.publish ? "published" : "draft",
      contentId,
      importedBy: admin._id,
      updatedAt: now,
    });

    return { ok: true, contentId, slug };
  },
});

export const skipItem = mutation({
  args: { itemId: v.id("import_items") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.itemId, { status: "skipped", updatedAt: Date.now() });
  },
});

export const retryItem = mutation({
  args: { itemId: v.id("import_items") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.itemId, { status: "pending", error: undefined, updatedAt: Date.now() });
  },
});
