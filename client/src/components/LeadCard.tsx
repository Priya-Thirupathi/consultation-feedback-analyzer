import type { AnalysisResult, RankMode, Theme } from "../types";

interface Props {
  top: Theme | undefined;
  result: AnalysisResult;
  mode: RankMode;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The narrow column of the Overview split. A chart shows the ranking but never
 * states the finding; this says in words what the top of the ranking is, which
 * is the sentence a policy analyst actually has to write down.
 */
export function LeadCard({ top, result, mode }: Props) {
  if (!top) return null;

  const share =
    result.analyzed > 0 ? Math.round((top.chunks / result.analyzed) * 100) : 0;

  return (
    <aside className="lead">
      <div className="eyebrow">Most raised{mode === "orgs" ? " by organisations" : " by mentions"}</div>
      <h3>{top.theme}</h3>
      <p className="lead-counts">
        {top.organisations !== null
          ? `${plural(top.organisations, "organisation")} · ${plural(top.chunks, "mention")}`
          : plural(top.chunks, "mention")}
      </p>

      {top.sample && <blockquote>“{top.sample}”</blockquote>}

      <div className="lead-split">
        <div>
          <span>Share of positions taken</span>
          <b>{share}%</b>
        </div>
        <div>
          <span>Set aside as boilerplate</span>
          <b>
            {result.skipped} of {result.total}
          </b>
        </div>
        <div>
          <span>Distinct themes after merging</span>
          <b>{result.themeCount}</b>
        </div>
      </div>
    </aside>
  );
}
