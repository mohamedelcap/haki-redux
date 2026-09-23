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

/** Throws if the caller is not an admin. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || user.role !== "admin") {
    throw new ConvexError("غير مصرح: هذه العملية تتطلب صلاحيات المدير");
  }
  return user;
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
