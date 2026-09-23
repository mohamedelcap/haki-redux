import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireSuperAdmin, getCurrentUser, isStaff, isAdminRole } from "./lib";
import { roleValidator, STAFF_ROLES } from "./schema";

/** List users for the admin panel (admin-level only). */
export const listUsers = query({
  args: {
    q: v.optional(v.string()),
    page: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const users = await ctx.db.query("users").collect();

    const q = args.q?.trim().toLowerCase();
    const filtered = q
      ? users.filter(
          (u) =>
            (u.name ?? "").toLowerCase().includes(q) ||
            (u.email ?? "").toLowerCase().includes(q),
        )
      : users;

    filtered.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
    return filtered.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      isAnonymous: u.isAnonymous,
    }));
  },
});

/**
 * Change a user's role.
 * - Only admin/super_admin may call this.
 * - Only super_admin can grant or remove the super_admin role.
 * - You cannot change your own role.
 */
export const setUserRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    const caller = await requireSuperAdmin(ctx);

    if (args.userId === caller._id) {
      throw new Error("لا يمكنك تغيير دورك الخاص");
    }

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("المستخدم غير موجود");

    // Only super_admin can grant/revoke super_admin (in either direction).
    if (
      (args.role === "super_admin" || target.role === "super_admin") &&
      caller.role !== "super_admin"
    ) {
      throw new Error("تعديل أدوار مديري النظام يتطلب صلاحية Super Admin");
    }

    await ctx.db.patch(args.userId, { role: args.role });
  },
});

/** Current user's staff summary used by the admin UI to decide what to show. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isStaff: isStaff(user.role),
      isAdmin: isAdminRole(user.role),
    };
  },
});

/** Available assignable roles depending on caller level. */
export const assignableRoles = query({
  args: {},
  handler: async (ctx) => {
    const caller = await requireSuperAdmin(ctx);
    if (caller.role === "super_admin") return STAFF_ROLES;
    return ["publisher", "author", "user"] as const;
  },
});
