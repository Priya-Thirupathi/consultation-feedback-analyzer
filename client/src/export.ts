// Source row export.
//
// The point is checkability, not convenience. An analyst who exports this can
// open it next to the file she uploaded and confirm, row id by row id, that the
// text we grouped is the text she sent — because the model never sees these
// strings. Gemini returns a theme label; `src/extract.ts` spreads a Verdict that
// has no text field, so the chunk text cannot be rewritten on the way through.

import type { AnalysisResult } from "./types";

/** RFC 4180: quote every field, double any inner quote. Cheaper than deciding. */
const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function evidenceToCsv(result: AnalysisResult): string {
  const header = ["rank", "theme", "row_id", "organisation", "text"].map(cell).join(",");

  const rows = result.themes.flatMap((t) =>
    t.evidence.map((e) => [cell(t.rank), cell(t.theme), cell(e.id), cell(e.org), cell(e.text)].join(","))
  );

  // Excel on Windows reads a bare UTF-8 CSV as Latin-1 and mangles anything
  // non-ASCII, which includes the curly quotes and dashes real submissions are
  // full of. The BOM is what makes it open correctly for the person who will
  // actually open it.
  return `﻿${[header, ...rows].join("\r\n")}\r\n`;
}

export function downloadCsv(result: AnalysisResult, fileName: string): void {
  const blob = new Blob([evidenceToCsv(result)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName.replace(/\.csv$/i, "")}-source-rows.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Revoking immediately can cancel the download in some browsers; a tick is
  // enough for the navigation to have started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
