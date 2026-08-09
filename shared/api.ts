// The wire contract for POST /api/analyze, imported by both the server that
// produces it and the client that reads it. Keeping one definition is the point
// of putting the server in TypeScript: renaming a field now breaks the build
// instead of rendering "undefined" in the page, which is how `voices` got
// through last time.

/**
 * One source row behind a theme, so the ranking can be checked rather than
 * trusted. `id` is the uploaded file's own id column when it has one, and the
 * row number otherwise, so an analyst can find the row in her own spreadsheet.
 */
export interface EvidenceRow {
  id: string;
  org: string | null;
  /** The chunk as uploaded, untrimmed. The sample quote is shortened; this is not. */
  text: string;
}

export interface Theme {
  rank: number;
  theme: string;
  /** Chunks of text mentioning this theme. One submission produces many. */
  chunks: number;
  /** Distinct organisations, or null when the upload had no org column. */
  organisations: number | null;
  orgNames: string[];
  sample: string;
  /** Every row grouped under this theme. Length always equals `chunks`. */
  evidence: EvidenceRow[];
}

export interface AnalysisResult {
  total: number;
  analyzed: number;
  /** Chunks the extractor judged to state no position at all. */
  skipped: number;
  organisations: number | null;
  /** True when the upload exceeded the row cap and only a prefix was read. */
  capped: boolean;
  /** Rows in the uploaded file, higher than `total` when capped. */
  uploadedRows: number;
  themeCount: number;
  themes: Theme[];
}

export interface ApiError {
  error: string;
}
