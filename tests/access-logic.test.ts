import { describe, expect, it } from "vitest";
import {
  isFreeRights,
  isLockedFor,
  stripMedia,
  type RightsStatus,
} from "@/convex/accessLogic";

const FREE: RightsStatus[] = [
  undefined,
  null,
  "public_domain",
  "copyrighted",
];
const PREMIUM: RightsStatus[] = ["unknown", "requires_review"];

describe("isFreeRights", () => {
  it("keeps legacy rows (no rights info) free — never lock existing content", () => {
    expect(isFreeRights(undefined)).toBe(true);
    expect(isFreeRights(null)).toBe(true);
  });
  it("treats public-domain and copyrighted works as free on HAKI", () => {
    expect(isFreeRights("public_domain")).toBe(true);
    expect(isFreeRights("copyrighted")).toBe(true);
  });
  it("treats unknown / requires_review as premium", () => {
    expect(isFreeRights("unknown")).toBe(false);
    expect(isFreeRights("requires_review")).toBe(false);
  });
});

describe("isLockedFor", () => {
  it("never locks staff (super_admin / admin / publisher / author)", () => {
    for (const rights of PREMIUM) {
      expect(
        isLockedFor(rights, { isStaff: true, hasActiveSubscription: false }),
      ).toBe(false);
    }
  });
  it("never locks free works, regardless of subscription", () => {
    for (const rights of FREE) {
      expect(
        isLockedFor(rights, { isStaff: false, hasActiveSubscription: false }),
      ).toBe(false);
      expect(
        isLockedFor(rights, { isStaff: false, hasActiveSubscription: true }),
      ).toBe(false);
    }
  });
  it("locks premium works for guests and free users", () => {
    for (const rights of PREMIUM) {
      expect(
        isLockedFor(rights, { isStaff: false, hasActiveSubscription: false }),
      ).toBe(true);
    }
  });
  it("unlocks premium works for active subscribers", () => {
    for (const rights of PREMIUM) {
      expect(
        isLockedFor(rights, { isStaff: false, hasActiveSubscription: true }),
      ).toBe(false);
    }
  });
});

describe("stripMedia", () => {
  it("removes every consumable media field", () => {
    const stripped = stripMedia({
      title: "عمل",
      audioUrl: "https://cdn/x.mp3",
      fileUrl: "https://cdn/x.epub",
      importFiles: [{ url: "https://cdn/y.pdf" }],
      coverImage: "https://cdn/cover.jpg",
      duration: 120,
    });
    expect(stripped).toEqual({
      title: "عمل",
      coverImage: "https://cdn/cover.jpg",
      duration: 120,
    });
  });

  it("does not mutate the original row", () => {
    const row = { title: "x", audioUrl: "https://a" };
    const stripped = stripMedia(row);
    expect(row.audioUrl).toBe("https://a");
    expect("audioUrl" in stripped).toBe(false);
  });
});
