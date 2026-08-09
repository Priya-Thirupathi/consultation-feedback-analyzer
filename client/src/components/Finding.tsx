import type { AnalysisResult, Theme } from "../types";

interface Props {
  result: AnalysisResult;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The written finding, at the top of the Overview.
 *
 * Every other element on this page is a metric about the run: rows read, rows
 * set aside, themes found. Those say whether the tool worked. None of them say
 * what the consultation argued, which is the only thing the analyst came for,
 * and a chart never states a finding in words.
 *
 * Nothing here is model output. The themes are Gemini's, but the comparison is
 * arithmetic over counts the server already returned: rank by distinct
 * organisations, rank by mentions, and report where the two disagree. That
 * disagreement is the whole argument for the tool, so it should be on screen
 * before anyone touches the toggle rather than only in the presenter's mouth.
 */
export function Finding({ result }: Props) {
  const themes = result.themes;
  if (!themes.length) return null;

  const byMentions = [...themes].sort((a, b) => b.chunks - a.chunks)[0]!;

  // No org column in the upload means there is no second ranking to compare
  // against, so say the one true thing and stop.
  if (result.organisations === null) {
    return (
      <p className="finding">
        <b>{plural(themes.length, "argument")}</b> across{" "}
        {result.analyzed.toLocaleString()} responses that took a position. The most
        repeated is <b>“{byMentions.theme}”</b>, with{" "}
        {plural(byMentions.chunks, "mention")}. Add an <code>org</code> column to
        rank by how many organisations raised each argument rather than how often
        it was repeated.
      </p>
    );
  }

  const orgCount = (t: Theme) => t.organisations ?? 0;
  const byOrgs = [...themes].sort(
    (a, b) => orgCount(b) - orgCount(a) || b.chunks - a.chunks
  )[0]!;

  const diverges = byOrgs.theme !== byMentions.theme;

  return (
    <p className="finding">
      <b>{plural(themes.length, "argument")}</b> from{" "}
      {plural(result.organisations, "organisation")}, across{" "}
      {result.analyzed.toLocaleString()} responses that took a position.
      {" "}
      Most widely held: <b>“{byOrgs.theme}”</b>, raised by {orgCount(byOrgs)} of{" "}
      {result.organisations}.
      {diverges ? (
        <>
          {" "}
          Ranking by mentions instead would put <b>“{byMentions.theme}”</b> first —
          that is {plural(orgCount(byMentions), "organisation")} saying it{" "}
          {plural(byMentions.chunks, "time")}.
        </>
      ) : (
        <>
          {" "}
          It is also the most repeated, at {plural(byMentions.chunks, "mention")}, so
          on this file the two rankings agree.
        </>
      )}
    </p>
  );
}
