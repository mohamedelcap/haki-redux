import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// Platform roles: super_admin > admin > publisher > author > user
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  PUBLISHER: "publisher",
  AUTHOR: "author",
  USER: "user",
  // legacy value kept for existing rows
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.SUPER_ADMIN),
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.PUBLISHER),
  v.literal(ROLES.AUTHOR),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);

/** How a challenge goal is measured (listened minutes, finished works, ratings). */
export const CHALLENGE_GOAL_TYPES = ["listen_minutes", "finished_works", "rated_items"] as const;
export const challengeGoalTypeValidator = v.union(
  ...CHALLENGE_GOAL_TYPES.map((t) => v.literal(t)),
);

/** Roles allowed into the admin dashboard at all. */
export const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PUBLISHER, ROLES.AUTHOR] as const;
export type Role = Infer<typeof roleValidator>;

export const CONTENT_TYPES = [
  "ebook",
  "audiobook",
  "audio_drama",
  "micro_drama",
  "podcast",
  "magazine",
  "live",
] as const;
export const contentTypeValidator = v.union(
  ...CONTENT_TYPES.map((t) => v.literal(t)),
);
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUS = ["published", "draft", "archived"] as const;
export const contentStatusValidator = v.union(
  ...CONTENT_STATUS.map((t) => v.literal(t)),
);

export const CHALLENGE_STATUS = ["upcoming", "active", "ended"] as const;
export const challengeStatusValidator = v.union(
  ...CHALLENGE_STATUS.map((t) => v.literal(t)),
);

export const SUBMISSION_STATUS = [
  "pending",
  "reviewing",
  "accepted",
  "rejected",
] as const;
export const submissionStatusValidator = v.union(
  ...SUBMISSION_STATUS.map((t) => v.literal(t)),
);

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      phone: v.optional(v.string()),
      /** Unique public handle (letters/digits/underscore), set from Settings. */
      username: v.optional(v.string()),
      // platform user preferences
      language: v.optional(v.union(v.literal("ar"), v.literal("en"))),
    })
      .index("email", ["email"])
      .index("by_username", ["username"]),

    // ---- Publishing entities ----
    authors: defineTable({
      name: v.string(),
      nameEn: v.optional(v.string()),
      bio: v.optional(v.string()),
      image: v.optional(v.string()),
    }),
    narrators: defineTable({
      name: v.string(),
      nameEn: v.optional(v.string()),
      bio: v.optional(v.string()),
      image: v.optional(v.string()),
    }),
    publishers: defineTable({
      name: v.string(),
      nameEn: v.optional(v.string()),
      bio: v.optional(v.string()),
      logo: v.optional(v.string()),
    }),
    categories: defineTable({
      name: v.string(),
      nameEn: v.optional(v.string()),
      slug: v.string(),
    }).index("by_slug", ["slug"]),

    // ---- Content ----
    content: defineTable({
      title: v.string(),
      slug: v.string(),
      description: v.string(),
      coverImage: v.optional(v.string()),
      contentType: contentTypeValidator,
      authorId: v.optional(v.id("authors")),
      narratorId: v.optional(v.id("narrators")),
      publisherId: v.optional(v.id("publishers")),
      duration: v.number(), // total seconds
      releaseDate: v.optional(v.string()),
      status: contentStatusValidator,
      isFeatured: v.boolean(),
      isTrending: v.boolean(),
      isNew: v.boolean(),
      playCount: v.number(),
      // full audio url (single-file content) – chapters have their own
      audioUrl: v.optional(v.string()),
      // e-book file (PDF/EPUB) served from storage
      fileUrl: v.optional(v.string()),
      // ---- Import provenance (Book Importer) ----
      /** Source name, e.g. "Internet Archive". */
      sourceName: v.optional(v.string()),
      /** Original URL at the source. */
      sourceUrl: v.optional(v.string()),
      /** External identifier at the source, e.g. IA identifier. */
      externalId: v.optional(v.string()),
      /** Public-domain status reported by the source or the importer. */
      rightsStatus: v.optional(v.union(
        v.literal("public_domain"),
        v.literal("copyrighted"),
        v.literal("unknown"),
        v.literal("requires_review"),
      )),
      /** Raw rights/license info string from the source. */
      rightsInfo: v.optional(v.string()),
      /** Available ebook formats detected, e.g. ["pdf","epub"]. */
      fileFormats: v.optional(v.array(v.string())),
      subtitle: v.optional(v.string()),
      originalYear: v.optional(v.number()),
      pageCount: v.optional(v.number()),
      fileSize: v.optional(v.number()),
      isbn: v.optional(v.string()),
      edition: v.optional(v.string()),
      keywords: v.optional(v.array(v.string())),
      importedAt: v.optional(v.number()),
      importMethod: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_type_status", ["contentType", "status"])
      .index("by_status", ["status"])
      .index("by_created", ["createdAt"]),

    content_categories: defineTable({
      contentId: v.id("content"),
      categoryId: v.id("categories"),
    }).index("by_content", ["contentId"]),

    /** Homepage sections managed from the admin dashboard (dynamic, no code). */
    homepage_sections: defineTable({
      key: v.string(),
      titleAr: v.string(),
      titleEn: v.string(),
      /** "trending" | "new" | "featured" | "type" | "manual" */
      sourceType: v.string(),
      /** For sourceType="type": which content type to show. */
      contentType: v.optional(contentTypeValidator),
      /** Manual item order for sourceType="manual". */
      itemIds: v.optional(v.array(v.id("content"))),
      limit: v.optional(v.number()),
      isHidden: v.optional(v.boolean()),
      order: v.number(),
    }).index("by_key", ["key"]),

    // Episodes for podcasts / audio dramas / micro dramas / magazines
    episodes: defineTable({
      contentId: v.id("content"),
      number: v.number(),
      title: v.string(),
      description: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
      duration: v.number(),
      coverImage: v.optional(v.string()),
      publishDate: v.optional(v.string()),
    }).index("by_content", ["contentId"]),

    // Chapters for audiobooks / ebooks
    chapters: defineTable({
      contentId: v.id("content"),
      number: v.number(),
      title: v.string(),
      audioUrl: v.optional(v.string()),
      duration: v.number(),
    }).index("by_content", ["contentId"]),

    // ---- Monetization ----
    subscription_plans: defineTable({
      name: v.string(),
      nameEn: v.optional(v.string()),
      description: v.optional(v.string()),
      price: v.number(),
      currency: v.string(),
      period: v.union(v.literal("monthly"), v.literal("yearly")),
      features: v.array(v.string()),
      featuresEn: v.optional(v.array(v.string())),
      isPopular: v.boolean(),
      isActive: v.boolean(),
      order: v.number(),
    }).index("by_active", ["isActive"]),

    subscriptions: defineTable({
      userId: v.id("users"),
      planId: v.id("subscription_plans"),
      status: v.union(
        v.literal("active"),
        v.literal("cancelled"),
        v.literal("expired"),
      ),
      startedAt: v.number(),
      expiresAt: v.number(),
    }).index("by_user", ["userId"]),

    // ---- User library ----
    user_library: defineTable({
      userId: v.id("users"),
      contentId: v.id("content"),
      kind: v.union(
        v.literal("mylist"),
        v.literal("saved"),
        v.literal("reading"),
      ),
      addedAt: v.number(),
    })
      .index("by_user_kind", ["userId", "kind"])
      .index("by_user_content", ["userId", "contentId"]),

    listening_history: defineTable({
      userId: v.id("users"),
      contentId: v.id("content"),
      episodeId: v.optional(v.id("episodes")),
      chapterId: v.optional(v.id("chapters")),
      position: v.number(),
      duration: v.number(),
      playedAt: v.number(),
    }).index("by_user", ["userId"]),

    listening_progress: defineTable({
      userId: v.id("users"),
      contentId: v.id("content"),
      position: v.number(), // seconds
      duration: v.number(), // seconds
      updatedAt: v.number(),
    })
      .index("by_user_content", ["userId", "contentId"])
      .index("by_user", ["userId"]),

    // ---- Engagement ----
    challenges: defineTable({
      name: v.string(),
      nameEn: v.optional(v.string()),
      description: v.string(),
      image: v.optional(v.string()),
      startDate: v.string(),
      endDate: v.string(),
      participants: v.number(),
      reward: v.optional(v.string()),
      status: challengeStatusValidator,
      isActive: v.boolean(),
      /** Goal type: what the participant must do to complete the challenge. */
      goalType: v.optional(challengeGoalTypeValidator),
      /** Goal target: e.g. 600 minutes, 3 works, 5 rated items. */
      goalTarget: v.optional(v.number()),
    }),

    challenge_participants: defineTable({
      challengeId: v.id("challenges"),
      userId: v.id("users"),
      joinedAt: v.number(),
      /** Completion time; set when progress reaches the goal. */
      completedAt: v.optional(v.number()),
    })
      .index("by_challenge", ["challengeId"])
      .index("by_user", ["userId"])
      .index("by_user_challenge", ["userId", "challengeId"]),

    live_streams: defineTable({
      title: v.string(),
      hostName: v.string(),
      description: v.optional(v.string()),
      image: v.optional(v.string()),
      streamUrl: v.optional(v.string()),
      scheduledStart: v.optional(v.string()),
      scheduledEnd: v.optional(v.string()),
      isLive: v.boolean(),
      listeners: v.number(),
    }),

    podcasts: defineTable({
      name: v.string(),
      nameEn: v.optional(v.string()),
      host: v.optional(v.string()),
      description: v.optional(v.string()),
      isActive: v.boolean(),
    }),

    // ---- Publishing flow ----
    publisher_submissions: defineTable({
      name: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      ownerType: v.string(),
      publisherName: v.optional(v.string()),
      workTitle: v.string(),
      contentType: v.string(),
      message: v.optional(v.string()),
      fileUrl: v.optional(v.string()),
      fileName: v.optional(v.string()),
      /** Studio flow: the draft work this submission publishes upon approval. */
      contentId: v.optional(v.id("content")),
      submittedBy: v.optional(v.id("users")),
      status: submissionStatusValidator,
      createdAt: v.number(),
    }),

    notifications: defineTable({
      userId: v.id("users"),
      title: v.string(),
      body: v.optional(v.string()),
      isRead: v.boolean(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    ratings: defineTable({
      contentId: v.id("content"),
      userId: v.id("users"),
      /** 1..5 */
      value: v.number(),
      review: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_content", ["contentId"])
      .index("by_user_content", ["userId", "contentId"]),

    // ---- Revenue distribution (royalties) ----
    /** Publishing contract: split of revenue attributable to a publisher's works. */
    publisher_contracts: defineTable({
      publisherId: v.id("publishers"),
      /** 0..100 — must sum with publisherPercentage to 100. */
      hakiPercentage: v.number(),
      /** 0..100 */
      publisherPercentage: v.number(),
      startDate: v.string(),
      endDate: v.optional(v.string()),
      notes: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
    }).index("by_publisher", ["publisherId"]),

    /** A revenue pool: total amount to distribute over a period. */
    revenue_pools: defineTable({
      name: v.string(),
      totalAmount: v.number(),
      currency: v.string(),
      periodStart: v.string(),
      periodEnd: v.string(),
      status: v.union(
        v.literal("draft"),
        v.literal("calculated"),
        v.literal("settled"),
      ),
      createdAt: v.number(),
    }),

    /** One row per publisher per pool, produced by the distribution run. */
    royalty_statements: defineTable({
      poolId: v.id("revenue_pools"),
      publisherId: v.optional(v.id("publishers")),
      publisherName: v.optional(v.string()),
      usageSeconds: v.number(),
      /** 0..100 — share of total listening in the period. */
      usageShare: v.number(),
      /** pool.totalAmount × usageShare. */
      grossAmount: v.number(),
      publisherAmount: v.number(),
      hakiAmount: v.number(),
      publisherPercentage: v.number(),
      hakiPercentage: v.number(),
      workCount: v.number(),
      hasContract: v.boolean(),
    }).index("by_pool", ["poolId"]),

    podcast_follows: defineTable({
      userId: v.id("users"),
      contentId: v.id("content"),
      followedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_content", ["userId", "contentId"])
      .index("by_content", ["contentId"]),

    settings: defineTable({
      key: v.string(),
      value: v.string(),
    }).index("by_key", ["key"]),

    // ---- Book Importer ----
    /** An import run (bulk or single). */
    import_jobs: defineTable({
      source: v.string(),
      /** search | collection | ids | single */
      mode: v.string(),
      /** Original input: URL or newline-separated identifiers/URLs. */
      input: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("paused"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      total: v.number(),
      processed: v.number(),
      succeeded: v.number(),
      failed: v.number(),
      /** draft | auto (publish only verified public-domain) */
      publishMode: v.string(),
      allowedFormats: v.optional(v.array(v.string())),
      createdBy: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),

    /** One queued book candidate. */
    import_items: defineTable({
      jobId: v.id("import_jobs"),
      source: v.string(),
      externalId: v.string(),
      sourceUrl: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("imported"),
        v.literal("published"),
        v.literal("draft"),
        v.literal("requires_review"),
        v.literal("failed"),
        v.literal("skipped"),
        v.literal("duplicate"),
      ),
      /** Full extracted metadata snapshot (JSON). */
      metadata: v.optional(v.string()),
      title: v.optional(v.string()),
      author: v.optional(v.string()),
      year: v.optional(v.number()),
      language: v.optional(v.string()),
      rightsStatus: v.optional(v.string()),
      formats: v.optional(v.array(v.string())),
      coverUrl: v.optional(v.string()),
      fileUrls: v.optional(v.string()),
      error: v.optional(v.string()),
      /** Content id created (when imported). */
      contentId: v.optional(v.id("content")),
      /** Existing content id when a duplicate was found. */
      duplicateOf: v.optional(v.id("content")),
      importedBy: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_job", ["jobId"]).index("by_external", ["source", "externalId"]),

    /** Admin-editable mapping from source subjects → internal category ids. */
    import_category_mappings: defineTable({
      source: v.string(),
      /** Lowercased subject keyword from the source. */
      subject: v.string(),
      categoryId: v.id("categories"),
    }).index("by_source_subject", ["source", "subject"]),

    /**
     * Manual payment requests (Fawry / STC Pay / Vodafone Cash / bank transfer):
     * user registers intent, admin reviews proof and approves → subscription.
     */
    manual_payments: defineTable({
      userId: v.id("users"),
      planId: v.id("subscription_plans"),
      /** fawry | stcpay | vodafonecash | bankTransfer */
      method: v.string(),
      /** pending | approved | rejected */
      status: v.string(),
      /** User-submitted reference (transaction id / receipt note). */
      reference: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
      /** Admin who approved/rejected. */
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      /** Subscription created upon approval. */
      subscriptionId: v.optional(v.id("subscriptions")),
      /** Idempotency: Stripe session id (webhook path). */
      stripeSessionId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_user", ["userId"]),

    /**
     * User-curated playlists: ordered lists of works (chapters feed the
     * player queue in order via "play all").
     */
    user_playlists: defineTable({
      name: v.string(),
      ownerId: v.id("users"),
      /** Ordered content ids. */
      items: v.array(v.id("content")),
      description: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_owner", ["ownerId"]),

    /** Login rate limiting: attempts per email (5/minute, cleaned opportunistically). */
    login_attempts: defineTable({
      email: v.string(),
      at: v.number(),
      success: v.boolean(),
    }).index("by_email", ["email"]),

    /** Scheduled (background) imports configured by admins. */
    import_schedules: defineTable({
      name: v.string(),
      source: v.string(),
      /** collection | search */
      mode: v.string(),
      input: v.string(),
      /** Books per run. */
      limitPerRun: v.number(),
      /** "daily" | "weekly" — frequency label (runs are batched by cron ticks). */
      frequency: v.string(),
      /** draft | auto */
      publishMode: v.string(),
      allowedFormats: v.optional(v.array(v.string())),
      minRights: v.string(),
      enabled: v.boolean(),
      lastRunAt: v.optional(v.number()),
      createdBy: v.optional(v.id("users")),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_enabled", ["enabled"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
