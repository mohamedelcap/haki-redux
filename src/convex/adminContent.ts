import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin, requireContentAccess, requireSuperAdmin, isAdminRole, auditLog } from "./lib";
import {
  contentTypeValidator,
  contentStatusValidator,
  challengeStatusValidator,
  challengeGoalTypeValidator,
  submissionStatusValidator,
} from "./schema";

// ============ Content CRUD (admin) ============

export const upsertContent = mutation({
  args: {
    id: v.optional(v.id("content")),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    coverImage: v.optional(v.string()),
    contentType: contentTypeValidator,
    authorId: v.optional(v.id("authors")),
    narratorId: v.optional(v.id("narrators")),
    publisherId: v.optional(v.id("publishers")),
    duration: v.optional(v.number()),
    status: contentStatusValidator,
    isFeatured: v.boolean(),
    isTrending: v.boolean(),
    isNew: v.boolean(),
    audioUrl: v.optional(v.string()),
    categoryIds: v.optional(v.array(v.id("categories"))),
  },
  handler: async (ctx, args) => {
    const caller = await requireAdmin(ctx);
    const now = Date.now();
    const {
      id,
      categoryIds,
      duration,
      authorId,
      narratorId,
      publisherId,
      audioUrl,
      coverImage,
      ...data
    } = args;

    // Ownership model: publishers/authors may only touch their own rows.
    if (id) {
      const existing = await ctx.db.get(id);
      await requireContentAccess(ctx, existing);
      // Non-admin callers cannot change ownership fields.
      if (!isAdminRole(caller.role)) {
        if (authorId !== undefined || publisherId !== undefined) {
          throw new Error("تغيير مالك المحتوى يتطلب صلاحيات الإدارة");
        }
      }
    } else if (!isAdminRole(caller.role)) {
      // New rows: publisher/author create content owned by their entity.
      if (caller.role === "publisher") {
        const entity = await ctx.db
          .query("publishers")
          .filter((q) => q.eq(q.field("name"), caller.name ?? ""))
          .first();
        if (!entity) throw new Error("لم يتم ربط حسابك بدار نشر — تواصل مع الإدارة");
        args.publisherId = entity._id;
      } else if (caller.role === "author") {
        const entity = await ctx.db
          .query("authors")
          .filter((q) => q.eq(q.field("name"), caller.name ?? ""))
          .first();
        if (!entity) throw new Error("لم يتم ربط حسابك بملف مؤلف — تواصل مع الإدارة");
        args.authorId = entity._id;
      }
    }
    if (id) {
      await ctx.db.patch(id, {
        ...data,
        ...(authorId !== undefined ? { authorId } : {}),
        ...(narratorId !== undefined ? { narratorId } : {}),
        ...(publisherId !== undefined ? { publisherId } : {}),
        ...(audioUrl !== undefined ? { audioUrl } : {}),
        ...(coverImage !== undefined ? { coverImage } : {}),
        ...(duration !== undefined ? { duration } : {}),
        updatedAt: now,
      });
      if (categoryIds) {
        const links = await ctx.db
          .query("content_categories")
          .withIndex("by_content", (q) => q.eq("contentId", id))
          .collect();
        for (const link of links) await ctx.db.delete(link._id);
        for (const categoryId of categoryIds) {
          await ctx.db.insert("content_categories", { contentId: id, categoryId });
        }
      }
      return id;
    }
    const newId = await ctx.db.insert("content", {
      title: data.title,
      slug: data.slug,
      description: data.description,
      coverImage,
      contentType: data.contentType,
      authorId,
      narratorId,
      publisherId,
      duration: duration ?? 0,
      releaseDate: new Date().toISOString().slice(0, 10),
      status: data.status,
      isFeatured: data.isFeatured,
      isTrending: data.isTrending,
      isNew: data.isNew,
      playCount: 0,
      audioUrl,
      createdAt: now,
      updatedAt: now,
    });
    if (categoryIds) {
      for (const categoryId of categoryIds) {
        await ctx.db.insert("content_categories", { contentId: newId, categoryId });
      }
    }
    return newId;
  },
});

export const deleteContent = mutation({
  args: { id: v.id("content") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    const callerAudit = await requireContentAccess(ctx, existing);
    const links = await ctx.db
      .query("content_categories")
      .withIndex("by_content", (q) => q.eq("contentId", args.id))
      .collect();
    for (const link of links) await ctx.db.delete(link._id);
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_content", (q) => q.eq("contentId", args.id))
      .collect();
    for (const c of chapters) await ctx.db.delete(c._id);
    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_content", (q) => q.eq("contentId", args.id))
      .collect();
    for (const e of episodes) await ctx.db.delete(e._id);
    await auditLog(ctx, callerAudit, "delete_content", "content", { entityId: args.id, detail: existing?.title });
    await ctx.db.delete(args.id);
  },
});

// ============ Chapters & Episodes ============

export const upsertChapter = mutation({
  args: {
    id: v.optional(v.id("chapters")),
    contentId: v.id("content"),
    number: v.number(),
    title: v.string(),
    audioUrl: v.optional(v.string()),
    duration: v.number(),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.contentId);
    await requireContentAccess(ctx, parent);
    const { id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("chapters", data);
  },
});

export const deleteChapter = mutation({
  args: { id: v.id("chapters") },
  handler: async (ctx, args) => {
    const chapter = await ctx.db.get(args.id);
    if (!chapter) throw new Error("الفصل غير موجود");
    const parent = await ctx.db.get(chapter.contentId);
    await requireContentAccess(ctx, parent);
    await ctx.db.delete(args.id);
  },
});

export const upsertEpisode = mutation({
  args: {
    id: v.optional(v.id("episodes")),
    contentId: v.id("content"),
    number: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    duration: v.number(),
    coverImage: v.optional(v.string()),
    publishDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.contentId);
    await requireContentAccess(ctx, parent);
    const { id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    }
    const episodeId = await ctx.db.insert("episodes", data);

    // New episode on a podcast → notify followers of the show.
    if (parent && parent.contentType === "podcast") {
      await ctx.runMutation(internal.podcastFollows.notifyFollowersInternal, {
        contentId: args.contentId,
        episodeTitle: args.title,
      });
    }
    return episodeId;
  },
});

export const deleteEpisode = mutation({
  args: { id: v.id("episodes") },
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.id);
    if (!episode) throw new Error("الحلقة غير موجودة");
    const parent = await ctx.db.get(episode.contentId);
    await requireContentAccess(ctx, parent);
    await ctx.db.delete(args.id);
  },
});

// ============ Challenges (admin) ============

export const upsertChallenge = mutation({
  args: {
    id: v.optional(v.id("challenges")),
    name: v.string(),
    nameEn: v.optional(v.string()),
    description: v.string(),
    startDate: v.string(),
    endDate: v.string(),
    reward: v.optional(v.string()),
    status: challengeStatusValidator,
    isActive: v.boolean(),
    goalType: v.optional(challengeGoalTypeValidator),
    goalTarget: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const { id, ...data } = args;
    if (id) {
      await ctx.db.patch(id, data);
      return id;
    }
    return await ctx.db.insert("challenges", { ...data, participants: 0 });
  },
});

export const deleteChallenge = mutation({
  args: { id: v.id("challenges") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ============ Live streams (admin) ============

export const upsertLiveStream = mutation({
  args: {
    id: v.optional(v.id("live_streams")),
    title: v.string(),
    hostName: v.string(),
    description: v.optional(v.string()),
    streamUrl: v.optional(v.string()),
    embedUrl: v.optional(v.string()),
    scheduledStart: v.optional(v.string()),
    scheduledEnd: v.optional(v.string()),
    isLive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const { id, embedUrl, ...data } = args;
    // Sanitize embed URL: only YouTube / Twitch embed hosts are allowed.
    let safeEmbed: string | undefined;
    if (embedUrl) {
      try {
        const u = new URL(embedUrl);
        const host = u.hostname.replace(/^www\./, "");
        const ok =
          host === "youtube.com" ||
          host === "youtube-nocookie.com" ||
          host === "m.youtube.com" ||
          host === "player.twitch.tv";
        if (!ok || u.protocol !== "https:") throw new Error("bad host");
        safeEmbed = u.toString();
      } catch {
        throw new Error("رابط التضمين يجب أن يكون من youtube.com أو twitch.tv فقط");
      }
    }
    if (id) {
      await ctx.db.patch(id, { ...data, embedUrl: safeEmbed });
      return id;
    }
    return await ctx.db.insert("live_streams", { ...data, embedUrl: safeEmbed, listeners: 0 });
  },
});

export const deleteLiveStream = mutation({
  args: { id: v.id("live_streams") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

// ============ Settings (admin) ============

export const listSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query("settings").collect();
  },
});

export const setSetting = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: args.value });
    }
  },
});

// ============ Publisher submissions ============

export const submitPublisherForm = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    ownerType: v.string(),
    publisherName: v.optional(v.string()),
    workTitle: v.string(),
    contentType: v.string(),
    message: v.optional(v.string()),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("publisher_submissions", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
    return id;
  },
});

export const listSubmissions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("publisher_submissions").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows;
  },
});

export const updateSubmissionStatus = mutation({
  args: {
    id: v.id("publisher_submissions"),
    status: submissionStatusValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.patch(args.id, { status: args.status });
    await auditLog(ctx, admin, "update_submission_status", "publisher_submissions", { entityId: args.id, detail: args.status });
  },
});
