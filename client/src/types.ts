// The API contract lives in shared/api.ts and is imported by the server too, so
// a renamed field is a build error on both sides rather than "undefined" in the
// page. Only client-only state is defined here.

export type { Theme, EvidenceRow, AnalysisResult, ApiError } from "../../shared/api.ts";

import type { AnalysisResult } from "../../shared/api.ts";

export type RankMode = "orgs" | "chunks";

/** Which section the nav rail is showing. */
export type View = "upload" | "overview" | "themes" | "reports" | "about";

/**
 * A finished run, kept in the browser so a refresh does not throw away minutes
 * of paced Gemini quota. `fileName` is what the reader recognises it by.
 */
export interface SavedReport {
  id: string;
  fileName: string;
  /** Epoch millis, so the list can sort without parsing anything. */
  savedAt: number;
  seconds: number;
  result: AnalysisResult;
}

/** Themes render as a card grid or a full-quote list; the reader picks. */
export type ThemeLayout = "cards" | "list";

export type AnalysisState =
  | { status: "idle" }
  | { status: "running"; rows: number; startedAt: number }
  | { status: "done"; result: AnalysisResult; seconds: number }
  | { status: "error"; message: string };
