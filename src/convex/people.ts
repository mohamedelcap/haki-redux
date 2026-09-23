import { v } from "convex/values";
import { query } from "./_generated/server";
import { enrichContent } from "./lib";

/**
 * Public profile for an author or narrator plus their published works.
 * kind: "author" | "narrator"
 */
export const getPerson = query({
  args: { kind: v.union(v.literal("author"), v.literal("narrator")), id: v.id("authors") },
  handler: async (ctx, args) => {
    const table = args.kind === "author" ? "authors" : "narrators";
    const person = await ctx.db.get(args.id as any);
    if (!person) return null;

    const all = await ctx.db
      .query("content")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    const theirs = all.filter((c) =>
      args.kind === "author" ? (c as any).authorId === args.id : (c as any).narratorId === args.id,
    );
    theirs.sort((a, b) => b.playCount - a.playCount);

    const works = await enrichContent(ctx, theirs.slice(0, 30));
    return {
      person: {
        _id: person._id,
        name: (person as any).name,
        nameEn: (person as any).nameEn,
        bio: (person as any).bio,
        image: (person as any).image,
      },
      works,
    };
  },
});
