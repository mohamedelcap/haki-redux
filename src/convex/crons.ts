import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Background scheduler for book imports.
 * The sweep enqueues due scheduled imports and processes pending items in
 * small rate-limited batches — never blocking the dashboard, never exceeding
 * the source's rate limits.
 */
const crons = cronJobs();

/**
 * Scheduled imports sweep: enqueues due scheduled jobs (Gutenberg daily/weekly
 * pulls, IA collections) every 6 hours.
 */
crons.interval(
  "book-import-sweep",
  { hours: 6 },
  internal.bookImporter.runDueSweepInternal,
  {},
);

/**
 * Auto-discovery: resolves pending jobs (total === 0) into concrete book ids
 * via the official Gutendex / IA APIs (max 3 jobs per tick).
 */
crons.interval(
  "book-import-auto-discover",
  { minutes: 30 },
  internal.bookImporter.autoDiscoverPendingInternal,
  { maxJobs: 3 },
);

/**
 * Background batch processor: fetches pending items (metadata + cover +
 * rights) through the shared internal core, max 5 per tick — rate-limit
 * friendly. publishMode "auto" publishes verified public-domain Gutenberg
 * books directly.
 */
crons.interval(
  "book-import-process-batch",
  { minutes: 5 },
  internal.bookImporter.cronProcessBatchInternal,
  { maxItems: 5 },
);

/**
 * Content publishing scheduler: every minute, flips due scheduled rows to
 * "publishing" (atomic, duplicate-safe) and runs their publish, reclaims
 * stuck rows, and sends upcoming-publish reminders. Runs server-side —
 * independent of any open dashboard/browser.
 */
crons.interval(
  "content-publish-scheduler",
  { minutes: 5 },
  internal.scheduler.dueSweep,
  {},
);

export default crons;
