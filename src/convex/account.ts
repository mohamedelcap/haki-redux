import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUser } from "./lib";
import type { Id } from "./_generated/dataModel";

/**
 * Account extras: unique username, my stats, account deletion,
 * and a simple login rate limit (5 attempts / minute).
 */

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** Check username availability (live validation in Settings). */
export const usernameAvailable = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const uname = args.username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) return { ok: false, reason: "invalid" as const };
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();
    return { ok: !existing, reason: existing ? ("taken" as const) : undefined };
  },
});

/**
 * Google sign-in readiness for the auth page UI.
 * Never exposes the values — only whether the client id/secret exist.
 */
export const googleAuthStatus = query({
  args: {},
  handler: async () => {
    const id = process.env.AUTH_GOOGLE_ID;
    const secret = process.env.AUTH_GOOGLE_SECRET;
    return { configured: Boolean(id && secret) };
  },
});

/** Set or change my username (unique, 3–20 chars: letters/digits/_). */
export const setUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("غير مصرح");
    const uname = args.username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) {
      throw new Error("اسم المستخدم: 3-20 حرفًا إنجليزيًا/أرقامًا/شرطة سفلية فقط");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();
    if (existing && existing._id !== user._id) {
      throw new Error("اسم المستخدم محجوز — جرّب اسمًا آخر");
    }
    await ctx.db.patch(user._id, { username: uname });
    return { ok: true };
  },
});

/** Public profile by username → /profile/u/:username pages. */
export const publicByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const uname = args.username.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();
    if (!user) return null;
    return {
      name: user.name ?? null,
      username: user.username ?? null,
      image: user.image ?? null,
      joinedAt: user._creationTime,
    };
  },
});

/** My account stats: listens, works, minutes, ratings, playlists count. */
export const myStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const [history, progress, ratings, library] = await Promise.all([
      ctx.db.query("listening_history").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("listening_progress").withIndex("by_user", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("ratings").withIndex("by_user_content", (q) => q.eq("userId", user._id)).collect(),
      ctx.db.query("user_library").withIndex("by_user_kind", (q) => q.eq("userId", user._id).eq("kind", "mylist")).collect(),
    ]);
    const works = new Set(history.map((h) => h.contentId)).size;
    const minutes = Math.round(
      history.reduce((s, r) => s + Math.min(r.duration || 0, r.position || 0), 0) / 60,
    );
    return {
      listens: history.length,
      works,
      minutes,
      ratings: ratings.length,
      myList: library.length,
      inProgress: progress.length,
    };
  },
});

/** Permanently delete my account and its personal rows. */
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("غير مصرح");
    if (user.role === "admin" || user.role === "super_admin") {
      throw new Error("لا يمكن حذف حساب مدير — أزِل الدور أولًا");
    }
    const uid = user._id;
    for (const table of [
      "listening_history",
      "listening_progress",
      "user_library",
      "ratings",
      "notifications",
      "challenge_participants",
      "podcast_follows",
      "manual_payments",
    ] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const r of rows) {
        if ((r as any).userId === uid) await ctx.db.delete(r._id);
      }
    }
    // Cancel any active subscriptions.
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    for (const s of subs) await ctx.db.delete(s._id);
    // Delete auth account (sessions + credentials cascade).
    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), uid))
      .collect();
    for (const a of authAccounts) await ctx.db.delete(a._id);
    const sessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), uid))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    await ctx.db.delete(uid);
    return { ok: true };
  },
});

// ---------------- Login rate limit (5 attempts / minute) ----------------

/** Public user lookup by id (used by email actions). */
export const currentUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) return null;
    return { name: user.name ?? null, email: user.email ?? null, image: user.image ?? null };
  },
});

/** Throws when the email exceeded 5 failed attempts in the last 60s. */
export const checkLoginAllowed = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const since = Date.now() - 60_000;
    const rows = await ctx.db
      .query("login_attempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    const recent = rows.filter((r) => r.at >= since && !r.success);
    if (recent.length >= 5) {
      throw new Error("محاولات كثيرة — انتظر دقيقة ثم أعد المحاولة");
    }
    return { ok: true };
  },
});

/** Record a login attempt outcome. */
export const recordLoginAttempt = mutation({
  args: { email: v.string(), success: v.boolean() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    await ctx.db.insert("login_attempts", { email, at: Date.now(), success: args.success });
    // Opportunistic cleanup of this email's old rows (> 1 hour).
    const rows = await ctx.db
      .query("login_attempts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    for (const r of rows) {
      if (r.at < Date.now() - 3_600_000) await ctx.db.delete(r._id);
    }
    return { ok: true };
  },
});
