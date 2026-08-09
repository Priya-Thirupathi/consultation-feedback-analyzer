import type { AnalysisResult, EvidenceRow, Theme } from "./types";

/**
 * Evidence is what the analyst cross-checks against her own file, so a row with
 * no usable id or text is dropped rather than rendered as a blank line she
 * cannot look up.
 */
function parseEvidence(raw: unknown): EvidenceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const e = item as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id : typeof e.id === "number" ? String(e.id) : "";
    const text = typeof e.text === "string" ? e.text : "";
    if (!id || !text) return [];
    return [{ id, org: typeof e.org === "string" ? e.org : null, text }];
  });
}

/**
 * Narrow here rather than casting, so this is the only place dealing with an
 * unchecked shape. The API renaming `voices` to `chunks` once put "undefined"
 * in every row of the old page with nothing to catch it.
 */
function parseTheme(raw: unknown, index: number): Theme {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`Theme ${index} was not an object`);
  }
  const t = raw as Record<string, unknown>;

  const need = (key: string): number => {
    const v = t[key];
    if (typeof v !== "number") throw new Error(`Theme ${index} is missing "${key}"`);
    return v;
  };

  return {
    rank: need("rank"),
    theme: typeof t.theme === "string" ? t.theme : "Untitled theme",
    chunks: need("chunks"),
    organisations: typeof t.organisations === "number" ? t.organisations : null,
    orgNames: Array.isArray(t.orgNames) ? t.orgNames.filter((o): o is string => typeof o === "string") : [],
    sample: typeof t.sample === "string" ? t.sample : "",
    evidence: parseEvidence(t.evidence),
  };
}

function parseAnalysis(raw: unknown): AnalysisResult {
  if (typeof raw !== "object" || raw === null) throw new Error("Response was not an object");
  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r.themes)) throw new Error("Response had no themes array");

  const num = (key: string): number => (typeof r[key] === "number" ? (r[key] as number) : 0);

  return {
    total: num("total"),
    analyzed: num("analyzed"),
    skipped: num("skipped"),
    organisations: typeof r.organisations === "number" ? r.organisations : null,
    capped: r.capped === true,
    uploadedRows: num("uploadedRows"),
    themeCount: num("themeCount"),
    themes: r.themes.map(parseTheme),
  };
}

export async function analyze(file: File): Promise<AnalysisResult> {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch("/api/analyze", { method: "POST", body });
  const payload: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof payload === "object" && payload !== null && typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Server error ${res.status}`;
    throw new Error(message);
  }
  return parseAnalysis(payload);
}

/** Row count for the progress estimate only, so a failure must not block the upload. */
export async function countRows(file: File): Promise<number> {
  try {
    const text = await file.text();
    return Math.max(1, text.trim().split("\n").length - 1);
  } catch {
    return 0;
  }
}
