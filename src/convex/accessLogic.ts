/**
 * Pure access rules for consuming media (audio / e-book files) on HAKI.
 *
 * These mirror the public "rights" filter in content.browse:
 *  - "public_domain"  → free for everyone
 *  - "copyrighted"    → free to consume on HAKI (platform policy, see browse)
 *  - undefined        → legacy rows without rights info → free (never
 *                       accidentally lock existing content)
 *  - "unknown" / "requires_review" → premium: requires an active subscription
 *
 * Staff roles (super_admin / admin / publisher / author) always have access —
 * callers check that separately via `isStaff(role)` before consulting these.
 */

export type RightsStatus =
  | "public_domain"
  | "copyrighted"
  | "unknown"
  | "requires_review"
  | null
  | undefined;

export type AccessFlags = {
  isStaff: boolean;
  hasActiveSubscription: boolean;
};

/** True when this rights status is free for everyone. */
export function isFreeRights(rightsStatus: RightsStatus): boolean {
  return (
    rightsStatus === undefined ||
    rightsStatus === null ||
    rightsStatus === "public_domain" ||
    rightsStatus === "copyrighted"
  );
}

/** Whether the media of a work is LOCKED for a viewer with these flags. */
export function isLockedFor(
  rightsStatus: RightsStatus,
  access: AccessFlags,
): boolean {
  if (access.isStaff) return false;
  if (isFreeRights(rightsStatus)) return false;
  return !access.hasActiveSubscription;
}

/**
 * Removes the consumable media fields from a content row (and marks it),
 * so locked work never ships its audio/file URLs to the client.
 */
export function stripMedia<T>(row: T): T {
  const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  delete copy.audioUrl;
  delete copy.fileUrl;
  delete copy.importFiles;
  return copy as T;
}
