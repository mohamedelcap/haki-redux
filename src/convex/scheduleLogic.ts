/**
 * Pure content-scheduling logic — no Convex context, no I/O.
 * Shared by src/convex/scheduler.ts (runtime) and tests/pure-logic.test.ts.
 *
 * Time is stored as UTC epoch ms. Wall-clock values (what the admin picks)
 * are interpreted/produced through an IANA timezone via Intl.DateTimeFormat,
 * which handles DST correctly with a two-pass offset resolution.
 */

export const DEFAULT_TIMEZONE = "Africa/Cairo";

// ---------------- Timezone helpers ----------------

/** Zoned (wall-clock) parts of a UTC instant in the given timezone. */
export function utcToZonedParts(
  utcMs: number,
  timezone: string,
): { y: number; m: number; d: number; hh: number; mm: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const y = Number(map.year);
  const m = Number(map.month);
  const d = Number(map.day);
  const hh = Number(map.hour) % 24; // Intl may emit "24" at midnight
  const mm = Number(map.minute);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekday = weekdays.indexOf(map.weekday ?? "Sun");
  return { y, m, d, hh, mm, weekday };
}

/** Offset (ms) that must be SUBTRACTED from a UTC guess to get the zoned wall clock. */
function tzOffsetMs(utcMs: number, timezone: string): number {
  const p = utcToZonedParts(utcMs, timezone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, 0);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** True when Intl recognizes the timezone (guards against typos in input). */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert a wall-clock date+time in `timezone` to UTC epoch ms.
 * Two-pass so DST boundaries resolve consistently.
 */
export function zonedToUtc(
  dateStr: string, // "YYYY-MM-DD"
  timeStr: string, // "HH:mm"
  timezone: string,
): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error("صيغة التاريخ/الوقت غير صالحة");
  }
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const utc1 = guess - tzOffsetMs(guess, timezone);
  const utc2 = guess - tzOffsetMs(utc1, timezone);
  return utc2;
}

/** "YYYY-MM-DD" of a UTC instant in the given timezone. */
export function zonedDateStr(utcMs: number, timezone: string): string {
  const p = utcToZonedParts(utcMs, timezone);
  return `${String(p.y).padStart(4, "0")}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** "HH:mm" of a UTC instant in the given timezone. */
export function zonedTimeStr(utcMs: number, timezone: string): string {
  const p = utcToZonedParts(utcMs, timezone);
  return `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
}

// ---------------- Date math (calendar-day based) ----------------

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addDaysToParts(
  y: number,
  m: number,
  d: number,
  n: number,
): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function weekdayOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function daysBetween(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
): number {
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000,
  );
}

// ---------------- Recurrence ----------------

export type RecurrenceLike = {
  freq: "none" | "daily" | "weekly" | "monthly" | "interval_days";
  weekdays?: number[];
  intervalDays?: number;
  monthDay?: number;
  timeOfDay: string;
  endsAt?: number;
};

/**
 * Next occurrence (UTC ms) strictly after `fromUtcMs`, following the rule's
 * wall-clock time in `timezone`. Returns null for one-off rules or when the
 * series end (endsAt) has passed.
 */
export function nextOccurrenceUtc(
  fromUtcMs: number,
  rule: RecurrenceLike,
  timezone: string,
): number | null {
  if (rule.freq === "none") return null;
  if (!rule.timeOfDay) return null;

  const anchor = utcToZonedParts(fromUtcMs, timezone);
  // Scan forward day by day (bounded to ~400 days) for the first matching date.
  for (let i = 1; i <= 400; i++) {
    const cand = addDaysToParts(anchor.y, anchor.m, anchor.d, i);
    const matches = (() => {
      switch (rule.freq) {
        case "daily":
          return true;
        case "interval_days": {
          const n = Math.max(1, Math.round(rule.intervalDays ?? 1));
          return daysBetween(anchor, cand) % n === 0;
        }
        case "weekly": {
          const days = rule.weekdays ?? [];
          if (days.length === 0) return false;
          return days.includes(weekdayOf(cand.y, cand.m, cand.d));
        }
        case "monthly": {
          const target = Math.min(Math.max(1, Math.round(rule.monthDay ?? 1)), daysInMonth(cand.y, cand.m));
          return cand.d === target;
        }
        default:
          return false;
      }
    })();
    if (!matches) continue;
    const dateStr = `${String(cand.y).padStart(4, "0")}-${String(cand.m).padStart(2, "0")}-${String(cand.d).padStart(2, "0")}`;
    const next = zonedToUtc(dateStr, rule.timeOfDay, timezone);
    if (next <= fromUtcMs) continue;
    if (rule.endsAt !== undefined && next > rule.endsAt) return null;
    return next;
  }
  return null;
}

// ---------------- Publish validation ----------------

export type ContentLike = {
  title: string;
  description: string;
  status?: string;
  audioUrl?: string;
  fileUrl?: string;
  importFiles?: { url: string; availability?: string }[];
};

/**
 * Validates a content row is complete enough to go live.
 * Returns an Arabic error message when not publishable.
 */
export function validateContentForPublish(
  content: ContentLike,
  counts: { chapters: number; episodes: number },
): { ok: boolean; error?: string; info?: string } {
  if (!content.title || !content.title.trim()) {
    return { ok: false, error: "المحتوى بلا عنوان — أكمل البيانات قبل النشر" };
  }
  if (!content.description || !content.description.trim()) {
    return { ok: false, error: "المحتوى بلا وصف — أكمل البيانات قبل النشر" };
  }
  const importFilesOk = (content.importFiles ?? []).some(
    (f) => !!f.url && f.availability !== "unavailable",
  );
  const hasDelivery =
    !!content.audioUrl ||
    !!content.fileUrl ||
    importFilesOk ||
    counts.chapters > 0 ||
    counts.episodes > 0;
  if (!hasDelivery) {
    return {
      ok: false,
      error:
        "المحتوى لا يحتوي على ملف صوتي أو كتاب إلكتروني أو فصول/حلقات — لا يمكن نشره",
    };
  }
  const parts: string[] = [];
  if (content.audioUrl) parts.push("ملف صوتي");
  if (content.fileUrl) parts.push("كتاب إلكتروني");
  if (importFilesOk) parts.push(`ملفات مستوردة (${(content.importFiles ?? []).length})`);
  if (counts.chapters > 0) parts.push(`${counts.chapters} فصل`);
  if (counts.episodes > 0) parts.push(`${counts.episodes} حلقة`);
  return { ok: true, info: parts.join(" · ") };
}

// ---------------- Retry policy ----------------

export const MAX_PUBLISH_ATTEMPTS = 3;

/** Progressive retry backoff: 1 min, 5 min, 15 min (requirement 21). */
export function retryDelayMs(attempt: number): number {
  if (attempt <= 1) return 60_000;
  if (attempt === 2) return 5 * 60_000;
  return 15 * 60_000;
}

// ---------------- Conflict rules ----------------

/** Statuses that block creating another schedule for the same content. */
export function isBlockingScheduleStatus(status: string): boolean {
  return status === "scheduled" || status === "publishing";
}

/** Human label for the schedule status (shared UI + logic). */
export function scheduleStatusAr(status: string): string {
  switch (status) {
    case "draft":
      return "مسودة";
    case "scheduled":
      return "مجدول";
    case "publishing":
      return "قيد النشر";
    case "published":
      return "منشور";
    case "failed":
      return "فشل النشر";
    case "cancelled":
      return "ملغي";
    default:
      return status;
  }
}

/** Parse "YYYY-MM-DD" + "HH:mm" inputs coming from the admin form. */
export function parseFormDateTime(
  date: string,
  time: string,
): { date: string; time: string } | { error: string } {
  const d = date.trim();
  const t = time.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "اختر تاريخ النشر" };
  if (!/^\d{2}:\d{2}$/.test(t)) return { error: "اختر وقت النشر" };
  return { date: d, time: t };
}
