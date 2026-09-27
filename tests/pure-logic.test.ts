import { describe, expect, it } from "vitest";
import { classifyRights, maskProfanity, sanitizeText } from "../src/convex/importSources";
import { computePoolShares } from "../src/convex/royalties";
import { computeChallengeProgress, statusFor } from "../src/convex/engagement";

// ---------------- importSources.classifyRights ----------------

describe("classifyRights", () => {
  it("detects public domain from CC0/publicdomain license URLs", () => {
    expect(classifyRights({ licenseurl: "https://creativecommons.org/publicdomain/zero/1.0/" }).status).toBe("public_domain");
    expect(classifyRights({ licenseurl: "http://creativecommons.org/publicdomain/mark/1.0/" }).status).toBe("public_domain");
  });

  it("treats open CC-BY licenses as public_domain (redistributable)", () => {
    expect(classifyRights({ licenseurl: "https://creativecommons.org/licenses/by/4.0/" }).status).toBe("public_domain");
  });

  it("marks explicit 'public domain' rights text", () => {
    expect(classifyRights({ rights: "This work is in the public domain" }).status).toBe("public_domain");
  });

  it("never assumes public domain without evidence → requires_review", () => {
    expect(classifyRights({}).status).toBe("requires_review");
    expect(classifyRights({ title: "Some book" }).status).toBe("requires_review");
  });

  it("detects copyright statements", () => {
    expect(classifyRights({ rights: "Copyright reserved by the author" }).status).toBe("copyrighted");
  });

  it("passes through info string", () => {
    const r = classifyRights({ rights: "Public Domain", licenseurl: "https://x" });
    expect(r.info).toContain("Public Domain");
  });
});

// ---------------- importSources.sanitizeText ----------------

describe("sanitizeText", () => {
  it("strips script/style/iframe and all tags", () => {
    expect(sanitizeText("<script>alert(1)</script>hello")).toBe("hello");
    expect(sanitizeText("<style>.x{}</style>hi")).toBe("hi");
    expect(sanitizeText("<iframe src='//evil'></iframe>ok")).toBe("ok");
    expect(sanitizeText("<b>bold</b> text")).toBe("bold text");
  });

  it("decodes entities exactly once (&amp;lt; → &lt; not <)", () => {
    expect(sanitizeText("&lt;p&gt;")).toBe("<p>");
    expect(sanitizeText("&amp;")).toBe("&");
    expect(sanitizeText("&quot;q&quot;&#39;a&#39;&nbsp;b")).toBe('"q"\'a\' b');
  });

  it("removes control characters and collapses whitespace", () => {
    expect(sanitizeText("a\u0000b\u0007c")).toBe("abc");
    expect(sanitizeText("a \t b\n\n c")).toBe("a b c");
  });

  it("truncates to maxLen", () => {
    expect(sanitizeText("abcdef", 3)).toBe("abc");
  });

  it("handles null/undefined/arrays", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
    expect(sanitizeText(["a", "b"])).toBe("a b");
  });
});

// ---------------- importSources.maskProfanity ----------------

describe("maskProfanity", () => {
  it("masks bad words preserving length, case-insensitively", () => {
    const out = maskProfanity("this is shit");
    expect(out).toBe("this is ****");
    expect(maskProfanity("FuCk off")).toBe("**** off");
  });

  it("masks Arabic profanity", () => {
    const out = maskProfanity("يا كلب");
    expect(out).not.toContain("كلب");
    expect(out).toContain("*");
  });

  it("leaves clean text untouched", () => {
    expect(maskProfanity("مراجعة جميلة جدًا، شكرًا!")).toBe("مراجعة جميلة جدًا، شكرًا!");
    expect(maskProfanity("great audiobook")).toBe("great audiobook");
  });
});

// ---------------- royalties.computePoolShares ----------------

describe("computePoolShares", () => {
  const contracts = {
    pub1: { publisherPercentage: 70, hakiPercentage: 30 },
    pub2: { publisherPercentage: 50, hakiPercentage: 50 },
  };

  it("splits proportionally by usage seconds", () => {
    const rows = computePoolShares(
      1000,
      [
        { publisherId: "pub1", seconds: 300 },
        { publisherId: "pub2", seconds: 100 },
      ],
      contracts,
    );
    // pub1 has 75% of usage → 750 gross → 70% = 525
    // pub2 has 25% of usage → 250 gross → 50% = 125
    const p1 = rows.find((r) => r.publisherId === "pub1")!;
    const p2 = rows.find((r) => r.publisherId === "pub2")!;
    expect(p1.grossAmount).toBeCloseTo(750, 0);
    expect(p1.publisherAmount).toBeCloseTo(525, 0);
    expect(p2.publisherAmount).toBeCloseTo(125, 0);
    expect(rows[0].publisherId).toBe("pub1"); // sorted by gross desc
  });

  it("without a contract, the whole gross is held by HAKI", () => {
    const rows = computePoolShares(1000, [{ publisherId: "pubX", seconds: 10 }], {});
    expect(rows[0].hasContract).toBe(false);
    expect(rows[0].publisherAmount).toBe(0);
    expect(rows[0].hakiAmount).toBeCloseTo(1000, 0);
  });

  it("returns empty for zero usage and ignores negative seconds", () => {
    expect(computePoolShares(1000, [], {})).toEqual([]);
    expect(computePoolShares(1000, [{ publisherId: "a", seconds: 0 }], {})).toEqual([]);
    const rows = computePoolShares(
      100,
      [
        { publisherId: "a", seconds: -5 },
        { publisherId: "b", seconds: 10 },
      ],
      {},
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].publisherId).toBe("b");
  });

  it("shares sum to ~100%", () => {
    const rows = computePoolShares(
      999,
      [
        { publisherId: "pub1", seconds: 7 },
        { publisherId: "pub2", seconds: 3 },
      ],
      contracts,
    );
    const totalShare = rows.reduce((a, r) => a + r.usageShare, 0);
    expect(totalShare).toBeCloseTo(100, 0);
  });
});

// ---------------- engagement: statusFor + computeChallengeProgress ----------------

describe("statusFor", () => {
  const now = new Date("2026-09-27T12:00:00");

  it("classifies upcoming/active/ended", () => {
    expect(statusFor("2026-10-01", "2026-10-15", now)).toBe("upcoming");
    expect(statusFor("2026-09-01", "2026-09-30", now)).toBe("active");
    expect(statusFor("2026-08-01", "2026-08-31", now)).toBe("ended");
  });

  it("start day counts as active (00:00 boundary)", () => {
    expect(statusFor("2026-09-27", "2026-09-28", now)).toBe("active");
  });

  it("end day counts as active (23:59 boundary)", () => {
    expect(statusFor("2026-09-20", "2026-09-27", now)).toBe("active");
  });
});

describe("computeChallengeProgress", () => {
  it("completes when progress reaches the target", () => {
    expect(computeChallengeProgress(300, 300).completed).toBe(true);
    expect(computeChallengeProgress(301, 300).completed).toBe(true);
    expect(computeChallengeProgress(299, 300).completed).toBe(false);
  });

  it("clamps target to >= 1 and non-negative progress", () => {
    expect(computeChallengeProgress(0, 0).target).toBe(1);
    expect(computeChallengeProgress(0, -10).target).toBe(1);
    expect(computeChallengeProgress(-5, 10).progress).toBe(0);
    expect(computeChallengeProgress(2.6, 10).progress).toBe(3);
  });

  it("defaults target to 1 when missing", () => {
    const r = computeChallengeProgress(1, null);
    expect(r.target).toBe(1);
    expect(r.completed).toBe(true);
  });
});
