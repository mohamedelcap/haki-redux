"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";

// ---------------- Admin identity ----------------
// Official admin credentials (single owner account). The username maps to a
// unique account id "<username>@haki.admin" in the authAccounts table via the
// password provider (secret stored hashed). Settings rows remember the chosen
// username so the client can check whether the admin account exists.

const KEY_USER = "admin_username";
const KEY_ACCOUNT_ID = "admin_account_id";

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// Settings access from actions uses string references to the internal
// query/mutation helpers in adminAuthStore.ts (Node files hold actions only).
async function getSetting(ctx: any, key: string): Promise<string | null> {
  const row: any = await ctx.runQuery("adminAuthStore:getSettingInternal" as any, { key });
  return row?.value ?? null;
}

async function setSetting(ctx: any, key: string, value: string) {
  await ctx.runMutation("adminAuthStore:setSettingInternal" as any, { key, value });
}

// adminStatus moved to adminAuthStore.ts (public query — Node files are
// actions-only).

async function doCreateSuperAdmin(ctx: any, args: { username: string; password: string; name?: string }) {
  if (args.password.length < 8) {
    throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
  }
  const username = normalize(args.username);
  if (username.length < 3) throw new Error("اسم المستخدم قصير جدًا");
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new Error("اسم المستخدم: أحرف لاتينية وأرقام و . _ - فقط");
  }

  // Unique per-provider account id (email-like so the password provider
  // accepts it at sign-in time without exposing a real mailbox).
  const accountId = `${username}@haki.admin`;

  // Creates the authUsers/authAccounts rows with hashed credentials.
  await createAccount(ctx, {
    provider: "password",
    account: { id: accountId, secret: args.password },
    profile: {
      name: args.name ?? "مدير حكي",
      email: accountId,
      role: "super_admin",
      emailVerificationTime: Date.now(),
    } as any,
  });

  await setSetting(ctx, KEY_USER, username);
  await setSetting(ctx, KEY_ACCOUNT_ID, accountId);
  return { ok: true as const, username, accountId };
}

/**
 * One-time creation of the official admin account, gated by the deploy key
 * (ADMIN_SETUP_KEY) so only the platform owner can mint credentials.
 */
export const createSuperAdmin = action({
  args: {
    username: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    setupKey: v.string(),
  },
  handler: async (ctx, args) => {
    const key = process.env.ADMIN_SETUP_KEY ?? "";
    if (!key || args.setupKey !== key) {
      throw new Error("مفتاح الإعداد غير صحيح");
    }
    return await doCreateSuperAdmin(ctx, args);
  },
});

/**
 * Validate admin credentials and return the sign-in identity to use with the
 * password provider. Uniform error messages: no hint about which field failed.
 */
export const validateAdminCredentials = action({
  args: { username: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const storedUser = await getSetting(ctx, KEY_USER);
    const accountId = await getSetting(ctx, KEY_ACCOUNT_ID);

    if (!storedUser || !accountId) {
      throw new Error("حساب الإدارة غير مُعدّ بعد");
    }

    if (normalize(args.username) !== storedUser) {
      throw new Error("بيانات الدخول غير صحيحة");
    }

    // Verifies the hashed secret; throws on mismatch.
    await retrieveAccount(ctx, {
      provider: "password",
      account: { id: accountId, secret: args.password },
    });

    // Ensure the account really belongs to a staff member.
    const who: any = await ctx.runQuery(
      "adminAuthStore:accountUserInternal" as any,
      { accountId },
    );
    if (!who?.userId || !["super_admin", "admin", "publisher", "author"].includes(who.role)) {
      throw new Error("هذا الحساب لا يملك صلاحيات الإدارة");
    }

    return { ok: true as const, email: accountId, role: who.role, name: who.name };
  },
});

/**
 * Reset admin credentials using the deploy-time setup key (lost password flow).
 */
export const resetAdminCredentials = action({
  args: {
    setupKey: v.string(),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const key = process.env.ADMIN_SETUP_KEY ?? "";
    if (!key || args.setupKey !== key) {
      throw new Error("مفتاح الإعداد غير صحيح");
    }
    return await doCreateSuperAdmin(ctx, args);
  },
});
