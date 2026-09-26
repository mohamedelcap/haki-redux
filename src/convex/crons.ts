import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Background scheduler for book imports.
 * The sweep enqueues due scheduled imports and processes pending items in
 * small rate-limited batches — never blocking the dashboard, never exceeding
 * the source's rate limits.
 */
const crons = cronJobs();

crons.interval(
  "book-import-sweep",
  { hours: 6 },
  internal.bookImporter.runDueSweepInternal,
  {},
);

export default crons;
