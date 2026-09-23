import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

/** Get the current user doc or null. */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

/** Get current user id or null. */
export async function getUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

/** Throws unless the caller is admin or super_admin (content management, users). */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || !isAdminRole(user.role)) {
    throw new ConvexError("غير مصرح: هذه العملية تتطلب صلاحيات المدير");
  }
  return user;
}

/** Throws unless the caller is admin or super_admin (user management, system settings). */
export async function requireSuperAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
    throw new ConvexError("غير مصرح: هذه العملية تتطلب صلاحيات مدير النظام");
  }
  return user;
}

/** Throws unless the caller is admin/super_admin/publisher/author. */
export async function requireStaff(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || !isStaff(user.role)) {
    throw new ConvexError("غير مصرح: هذه الصفحة لفريق الإدارة");
  }
  return user;
}

/** True for super_admin / admin / publisher / author (also legacy "member" → treated as user). */
export function isStaff(role?: string): boolean {
  return role === "super_admin" || role === "admin" || role === "publisher" || role === "author";
}

/** True for admin-level roles only. */
export function isAdminRole(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

/**
 * Content ownership check for the publisher/author content model:
 * - admin & super_admin: everything.
 * - publisher: content rows published by this publisher only.
 * - author: content authored by this author only.
 * Returns the caller (for owner ids) — throws when the caller lacks access to `contentId`.
 */
export async function requireContentAccess(
  ctx: QueryCtx | MutationCtx,
  contentRow: Doc<"content"> | null,
): Promise<Doc<"users">> {
  const user = await requireStaff(ctx);
  if (!contentRow) throw new ConvexError("المحتوى غير موجود");
  if (isAdminRole(user.role)) return user;

  // Resolve the caller's author/publisher entity
  if (user.role === "publisher") {
    const entity = await ctx.db
      .query("publishers")
      .filter((q) => q.eq(q.field("name"), user.name ?? ""))
      .first();
    if (entity && contentRow.publisherId === entity._id) return user;
  }
  if (user.role === "author") {
    const entity = await ctx.db
      .query("authors")
      .filter((q) => q.eq(q.field("name"), user.name ?? ""))
      .first();
    if (entity && contentRow.authorId === entity._id) return user;
  }
  throw new ConvexError("غير مصرح: لا تملك صلاحية تعديل هذا المحتوى");
}

export type PublicContent = Doc<"content">;

export type EnrichedContent = Omit<Doc<"content">, "authorId" | "narratorId" | "publisherId"> & {
  authorName: string | null;
  authorId: Id<"authors"> | null;
  authorImage: string | null;
  narratorName: string | null;
  narratorId: Id<"narrators"> | null;
  narratorImage: string | null;
  publisherName: string | null;
  publisherLogo: string | null;
  categories: { id: Id<"categories">; name: string; slug: string }[];
  chapterCount: number;
  episodeCount: number;
};

/** Attach author/narrator/publisher/category names to content rows. */
export async function enrichContent(
  ctx: QueryCtx,
  rows: Doc<"content">[],
): Promise<EnrichedContent[]> {
  const out: EnrichedContent[] = [];
  for (const row of rows) {
    const [author, narrator, publisher, cats, chapters, episodes] =
      await Promise.all([
        row.authorId ? ctx.db.get(row.authorId) : null,
        row.narratorId ? ctx.db.get(row.narratorId) : null,
        row.publisherId ? ctx.db.get(row.publisherId) : null,
        getContentCategories(ctx, row._id),
        ctx.db
          .query("chapters")
          .withIndex("by_content", (q) => q.eq("contentId", row._id))
          .collect(),
        ctx.db
          .query("episodes")
          .withIndex("by_content", (q) => q.eq("contentId", row._id))
          .collect(),
      ]);
    out.push({
      ...row,
      authorId: row.authorId ?? null,
      narratorId: row.narratorId ?? null,
      authorName: author?.name ?? null,
      authorImage: author?.image ?? null,
      narratorName: narrator?.name ?? null,
      narratorImage: narrator?.image ?? null,
      publisherName: publisher?.name ?? null,
      publisherLogo: publisher?.logo ?? null,
      categories: cats,
      chapterCount: chapters.length,
      episodeCount: episodes.length,
    });
  }
  return out;
}

async function getContentCategories(ctx: QueryCtx, contentId: Id<"content">) {
  const links = await ctx.db
    .query("content_categories")
    .withIndex("by_content", (q) => q.eq("contentId", contentId))
    .collect();
  const cats: { id: Id<"categories">; name: string; slug: string }[] = [];
  for (const link of links) {
    const cat = await ctx.db.get(link.categoryId);
    if (cat) cats.push({ id: cat._id, name: cat.name, slug: cat.slug });
  }
  return cats;
}

/** Format seconds as "3 س 24 د" or "45 د". */
export function formatDurationArabic(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} س ${minutes} د`;
  return `${minutes} د`;
}
