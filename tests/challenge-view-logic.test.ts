import { describe, expect, it } from "vitest";

// Inline mirrors of the challenge-page date/goal derivations
// (src/pages/Challenges.tsx + ChallengeDetails.tsx keep them local so this
// test pins the arithmetic they must preserve).

function daysUntil(dateStr: string, from: number = Date.now()): number {
  const end = new Date(`${dateStr}T23:59:59`).getTime();
  return Math.max(0, Math.ceil((end - from) / 86_400_000));
}

function daysUntilStart(dateStr: string, from: number = Date.now()): number {
  const start = new Date(`${dateStr}T00:00:00`).getTime();
  return Math.max(0, Math.ceil((start - from) / 86_400_000));
}

function daysBetween(a: string, b: string): number {
  const start = new Date(`${a}T00:00:00`).getTime();
  const end = new Date(`${b}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function pctOf(progress: number, target: number): number {
  return target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
}

describe("challenges: date derivations", () => {
  it("daysUntil counts the ending day as remaining and clamps at 0", () => {
    const now = new Date("2026-10-10T12:00:00").getTime();
    expect(daysUntil("2026-10-10", now)).toBe(1); // ends 23:59:59 today
    expect(daysUntil("2026-10-15", now)).toBe(6);
    expect(daysUntil("2026-10-01", now)).toBe(0); // already ended
  });

  it("daysUntilStart clamps past and same-day starts to 0", () => {
    const now = new Date("2026-10-10T12:00:00").getTime();
    expect(daysUntilStart("2026-10-12", now)).toBe(2);
    expect(daysUntilStart("2026-10-10", now)).toBe(0);
    expect(daysUntilStart("2026-09-01", now)).toBe(0);
  });

  it("daysBetween counts an inclusive span (challenge period length)", () => {
    expect(daysBetween("2026-09-25", "2026-10-30")).toBe(36);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(1);
  });

  it("progress percentage clamps to 0..100 and guards zero target", () => {
    expect(pctOf(0, 600)).toBe(0);
    expect(pctOf(150, 600)).toBe(25);
    expect(pctOf(600, 600)).toBe(100);
    expect(pctOf(700, 600)).toBe(100);
    expect(pctOf(10, 0)).toBe(0);
  });
});
