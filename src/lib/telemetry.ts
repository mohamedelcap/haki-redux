import { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * In-platform error reporting (no third-party key needed).
 * Errors land in the `client_errors` Convex table and are reviewed from the
 * admin dashboard (Overview → "Client errors in the last 24h").
 */

let client: ConvexReactClient | null = null;
let lastSentAt = 0;
let sentThisSession = 0;

const MIN_INTERVAL_MS = 5_000; // at most one report every 5s
const MAX_PER_SESSION = 20; // hard cap per page session

function getClient(): ConvexReactClient | null {
  try {
    if (!client) {
      const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
      if (!url) return null;
      client = new ConvexReactClient(url);
    }
    return client;
  } catch {
    return null;
  }
}

export function reportClientError(
  error: unknown,
  source: string,
  componentStack?: string,
): void {
  try {
    const now = Date.now();
    if (now - lastSentAt < MIN_INTERVAL_MS) return;
    if (sentThisSession >= MAX_PER_SESSION) return;
    lastSentAt = now;
    sentThisSession += 1;

    const err = error instanceof Error ? error : new Error(String(error));
    const c = getClient();
    if (!c) return;
    void c
      .mutation(api.telemetry.recordClientError, {
        message: (err.message || String(error)).slice(0, 500),
        stack: err.stack?.slice(0, 4000),
        source: source.slice(0, 40),
        url: typeof window !== "undefined" ? window.location.href.slice(0, 300) : undefined,
        componentStack: componentStack?.slice(0, 4000),
      })
      .catch(() => {
        /* telemetry must never break the app */
      });
  } catch {
    /* telemetry must never throw */
  }
}

/** Wire global handlers once at startup (called from main.tsx). */
export function initErrorTelemetry(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    reportClientError(e.error ?? e.message, "window.error");
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportClientError(e.reason, "unhandledrejection");
  });
}
