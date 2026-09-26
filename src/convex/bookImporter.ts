import { v } from "convex/values";
import { mutation, query, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib";
import { validateExternalUrl, fetchWithLimit, SOURCES } from "./importSources";

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
    return rows.slice(0, args.limit ?? 100);
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
    const source = SOURCES[args.source];
    if (!source) throw new Error("مصدر غير معروف");

    let ids: string[] = [];

    if (args.mode === "ids") {
      ids = args.input
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .map((s) => {
          if (!s) return "";
          if (/^https?:\/\//.test(s)) {
            const u = validateExternalUrl(s);
            const m = u.pathname.match(/\/details\/([^/]+)/);
            return m ? decodeURIComponent(m[1]) : "";
          }
          return s;
        })
        .filter(Boolean)
        .slice(0, 200);
    } else {
      const u = validateExternalUrl(args.input);
      let q: string;
      const collectionMatch = u.pathname.match(/\/details\/([\w.-]+)$/);
      if (args.mode === "collection" && collectionMatch) {
        q = `collection:${collectionMatch[1]} AND mediatype:texts`;
      } else {
        const queryParam = u.searchParams.get("query") ?? u.searchParams.get("q");
        q = queryParam
          ? `${queryParam} AND mediatype:texts`
          : `${args.input.replace(/["<>]/g, "").slice(0, 120)} AND mediatype:texts`;
      }

      const endpoint = source.searchEndpoint
        .replace("{q}", encodeURIComponent(q))
        .replace("{page}", "1")
        .replace("{rows}", "40");
      const data = await fetchWithLimit(endpoint);
      const docs: any[] = data?.response?.docs ?? [];
      ids = docs.map((d) => String(d.identifier)).filter(Boolean).slice(0, 200);
    }

    if (ids.length === 0) throw new Error("لم يُعثر على كتب — تحقق من الرابط أو المعرفات");
    await ctx.runMutation(internal.bookImporter.seedJobItemsInternal, { jobId: args.jobId, ids });
    return { count: ids.length };
  },
});

/**
 * Admin action: fetch full metadata for ONE queued item via the official IA
 * metadata endpoint, then finalize it (dup-check + status) internally.
 */
export const fetchItemMetadata = action({
  args: { itemId: v.id("import_items") },
  handler: async (ctx: any, args) => {
    await requireAdmin(ctx as any);
    const item: any = await ctx.runMutation(internal.bookImporter.getItemQueryInternal, {
      itemId: args.itemId,
    });
    if (!item) throw new Error("العنصر غير موجود");
    const source = SOURCES[item.source] ?? SOURCES.internet_archive;
    const { fetchIaItem } = await import("./importSources");

    try {
      const norm = await fetchIaItem(item.externalId, source);
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
        coverUrl: norm.coverUrl,
        fileUrls: JSON.stringify(norm.files),
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

/** Internal read used by the fetch action (returns the doc or null). */
export const getItemQueryInternal = internalMutation({
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
    return { done: false, itemId: next._id, externalId: next.externalId };
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
