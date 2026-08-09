import type { EvidenceRow, RankMode, Theme } from "../types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The rows a theme was built from. A count on its own asks to be trusted; this
 * is how the analyst checks it against the file she uploaded, which is the
 * whole answer to "how do we know the model got it right".
 *
 * A native <details> rather than our own toggle: collapsed by default so it
 * never competes with the ranking, and keyboard and screen reader behaviour
 * comes for free.
 */
function Evidence({ rows }: { rows: EvidenceRow[] }) {
  if (rows.length === 0) return null;

  return (
    <details className="evidence">
      <summary>Show {plural(rows.length, "source row")}</summary>
      <ol className="evidence-rows">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="evidence-meta">
              {/* The uploaded file's own id when it had one, the row number
                  otherwise, so it can be looked up either way. */}
              <span className="evidence-id">#{r.id}</span>
              {r.org && <span className="evidence-org">{r.org}</span>}
            </div>
            <p>{r.text}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function counts(t: Theme): string {
  return t.organisations !== null
    ? `${plural(t.organisations, "organisation")} · ${plural(t.chunks, "mention")}`
    : plural(t.chunks, "mention");
}

interface Props {
  themes: Theme[];
  mode: RankMode;
}

/**
 * Layout A — a responsive card grid. Good for taking in the whole debate at a
 * glance. Each card carries its own share-of-max meter, because a grid has no
 * shared axis the way the bar chart does, and without one the cards would only
 * be an ordered list wearing a chart's clothes.
 */
export function ThemeCards({ themes, mode }: Props) {
  const valueOf = (t: Theme) => (mode === "orgs" ? (t.organisations ?? 0) : t.chunks);
  const max = Math.max(1, ...themes.map(valueOf));

  return (
    <div className="theme-cards">
      {themes.map((t, i) => (
        <article className="theme-card" key={t.theme}>
          <div className="theme-card-top">
            <span className="rank">{i + 1}</span>
            <div>
              <h3>{t.theme}</h3>
              <div className="counts">{counts(t)}</div>
            </div>
          </div>

          <div
            className="meter"
            role="img"
            aria-label={`${Math.round((valueOf(t) / max) * 100)}% of the most-raised theme`}
          >
            <span style={{ width: `${(valueOf(t) / max) * 100}%` }} />
          </div>

          {t.orgNames.length > 0 && (
            <div className="chips">
              {t.orgNames.map((o) => (
                <span className="chip" key={o}>
                  {o}
                </span>
              ))}
            </div>
          )}

          {t.sample && <blockquote>“{t.sample}”</blockquote>}

          <Evidence rows={t.evidence} />
        </article>
      ))}
    </div>
  );
}

/**
 * Layout B — the reading list. Full-width quotes in reading order, nothing cut
 * short by a column. This doubles as the table view for the chart, so no number
 * anywhere in the app is gated behind hover or colour.
 */
export function ThemeList({ themes }: Props) {
  return (
    <div className="theme-list">
      {themes.map((t, i) => (
        <section className="theme" key={t.theme}>
          <div className="theme-head">
            <span className="rank">{i + 1}</span>
            <div>
              <h3>{t.theme}</h3>
              <div className="counts">{counts(t)}</div>
            </div>
          </div>

          <div className="theme-body">
            {t.orgNames.length > 0 && (
              <div className="chips">
                {t.orgNames.map((o) => (
                  <span className="chip" key={o}>
                    {o}
                  </span>
                ))}
              </div>
            )}
            {t.sample && <blockquote>“{t.sample}”</blockquote>}

            <Evidence rows={t.evidence} />
          </div>
        </section>
      ))}
    </div>
  );
}
