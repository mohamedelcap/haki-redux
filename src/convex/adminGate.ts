import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireStaff, isAdminRole } from "./lib";

const KEY_PASSWORD = "admin_gate_password";
const KEY_ATTEMPTS = "admin_gate_attempts";
const KEY_LAST_FAIL = "admin_gate_lastfail";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

async function getSetting(ctx: any, key: string): Promise<string | null> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  return row?.value ?? null;
}

async function setSetting(ctx: any, key: string, value: string) {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  if (row) await ctx.db.patch(row._id, { value });
  else await ctx.db.insert("settings", { key, value });
}

/** Deterministic token derived from the password — dies when the password changes. */
async function hash(s: string): Promise<string> {
  try {
    const data = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode("haki-gate:" + s),
    );
    return Array.from(new Uint8Array(data))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return "f" + (h >>> 0).toString(16);
  }
}

/** Gate status for the current staff member. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const configured = (await getSetting(ctx, KEY_PASSWORD)) !== null;

    const lastFail = Number((await getSetting(ctx, KEY_LAST_FAIL)) ?? 0);
    const attempts = Number((await getSetting(ctx, KEY_ATTEMPTS)) ?? 0);
    const lockedUntil =
      attempts >= MAX_ATTEMPTS && Date.now() - lastFail < LOCKOUT_MS
        ? lastFail + LOCKOUT_MS
        : 0;

    return { configured, lockedUntil };
  },
});

/** Validate a previously issued gate token (used to restore state after reload). */
export const verifyToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const stored = await getSetting(ctx, KEY_PASSWORD);
    if (!stored) return true; // gate not configured → open
    return args.token === stored;
  },
});

/** Verify the gate password. Rate-limited: MAX_ATTEMPTS then LOCKOUT_MS. */
export const verify = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const lastFail = Number((await getSetting(ctx, KEY_LAST_FAIL)) ?? 0);
    let attempts = Number((await getSetting(ctx, KEY_ATTEMPTS)) ?? 0);
    if (attempts >= MAX_ATTEMPTS && Date.now() - lastFail < LOCKOUT_MS) {
      const mins = Math.ceil((lastFail + LOCKOUT_MS - Date.now()) / 60000);
      throw new Error(`محاولات كثيرة خاطئة — حاول بعد ${mins} دقيقة`);
    }
    if (attempts >= MAX_ATTEMPTS) attempts = 0; // lockout window passed

    const stored = await getSetting(ctx, KEY_PASSWORD);
    if (!stored) throw new Error("لم يتم ضبط كلمة مرور اللوحة بعد");

    if ((await hash(args.password)) !== stored) {
      attempts += 1;
      await setSetting(ctx, KEY_ATTEMPTS, String(attempts));
      await setSetting(ctx, KEY_LAST_FAIL, String(Date.now()));
      const left = Math.max(0, MAX_ATTEMPTS - attempts);
      throw new Error(
        left > 0
          ? `كلمة المرور غير صحيحة — بقيت ${left} محاولات`
          : "تم إيقاف المحاولات مؤقتًا لمدة 10 دقائق",
      );
    }

    await setSetting(ctx, KEY_ATTEMPTS, "0");
    await setSetting(ctx, KEY_LAST_FAIL, "0");
    return { ok: true, token: await hash(args.password) };
  },
});

/** Set or change the gate password (admin-level only). */
export const setPassword = mutation({
  args: { currentPassword: v.optional(v.string()), newPassword: v.string() },
  handler: async (ctx, args) => {
    const user = await requireStaff(ctx);
    if (!isAdminRole(user.role)) {
      throw new Error("ضبط كلمة مرور اللوحة يتطلب صلاحية مدير");
    }
    if (args.newPassword.length < 8) {
      throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    }

    const stored = await getSetting(ctx, KEY_PASSWORD);
    if (stored) {
      const currentOk =
        args.currentPassword != null &&
        (await hash(args.currentPassword)) === stored;
      if (!currentOk) throw new Error("كلمة المرور الحالية غير صحيحة");
    }

    await setSetting(ctx, KEY_PASSWORD, await hash(args.newPassword));
    await setSetting(ctx, KEY_ATTEMPTS, "0");
    await setSetting(ctx, KEY_LAST_FAIL, "0");
    return { ok: true, token: await hash(args.newPassword) };
  },
});
