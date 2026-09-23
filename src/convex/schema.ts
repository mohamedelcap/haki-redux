import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
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
      // platform user preferences
      language: v.optional(v.union(v.literal("ar"), v.literal("en"))),
    }).index("email", ["email"]),

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
      startDate: v.string(),
      endDate: v.string(),
      participants: v.number(),
      reward: v.optional(v.string()),
      status: challengeStatusValidator,
      isActive: v.boolean(),
    }),

    challenge_participants: defineTable({
      challengeId: v.id("challenges"),
      userId: v.id("users"),
      joinedAt: v.number(),
    }).index("by_challenge", ["challengeId"]),

    live_streams: defineTable({
      title: v.string(),
      hostName: v.string(),
      description: v.optional(v.string()),
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

    settings: defineTable({
      key: v.string(),
      value: v.string(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
