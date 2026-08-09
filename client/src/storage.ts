// Saved reports, kept in localStorage.
//
// Why not a database: the analysis is stateless and the server holds nothing,
// which is the reason there is no MongoDB in the architecture. Persisting in
// the browser keeps that true — no connection string, no migration, nothing new
// to deploy — while fixing the thing that actually hurt: a run costs minutes of
// paced Gemini quota and a refresh threw it away.
//
// The tradeoff, stated plainly because it matters to an analyst: reports live in
// one browser on one machine. They are not shared with a colleague and they do
// not survive clearing site data. For anything that has to leave the building,
// use the report export instead.

import type { SavedReport } from "./types";

const KEY = "heard.reports.v1";

/**
 * Evidence carries the full text of every chunk, so one 223-row report can run
 * to a megabyte and localStorage gives us about five. Keep a working set rather
 * than an archive, and drop the oldest when the quota says so.
 */
const MAX_REPORTS = 8;

function read(): SavedReport[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Narrow on the way out: a half-written or older-shaped record should drop
    // out of the list rather than crash the page on load.
    return parsed.filter(
      (r): r is SavedReport =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as SavedReport).id === "string" &&
        typeof (r as SavedReport).savedAt === "number" &&
        typeof (r as SavedReport).result === "object" &&
        Array.isArray((r as SavedReport).result?.themes)
    );
  } catch {
    // Corrupt JSON, or a browser with storage disabled entirely.
    return [];
  }
}

/** Newest first. */
export function loadReports(): SavedReport[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Returns the list actually stored, which may be shorter than requested when
 * the quota forced older reports out. The caller renders that, so what is on
 * screen is always what survived.
 */
export function saveReport(report: SavedReport): SavedReport[] {
  let list = [report, ...read().filter((r) => r.id !== report.id)]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, MAX_REPORTS);

  // Drop the oldest until it fits. A quota error on the first try is normal
  // with a large report and a full store, not an error worth surfacing.
  while (list.length > 0) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return list;
    } catch {
      list = list.slice(0, -1);
    }
  }

  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage is unavailable. The run still shows on screen; it just will not
    // survive a refresh, which is the behaviour we had before any of this.
  }
  return [];
}

export function deleteReport(id: string): SavedReport[] {
  const list = read().filter((r) => r.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* leaving the old value in place is better than losing the rest */
  }
  return list.sort((a, b) => b.savedAt - a.savedAt);
}

/** Ids are only ever compared to each other, so time plus a counter is enough. */
export function newReportId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
