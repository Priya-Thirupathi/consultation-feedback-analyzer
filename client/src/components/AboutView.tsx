/**
 * The README's honesty about limits is a strength, not a disclaimer to bury —
 * a tool that tells you where it stops is the one a policy team can defend in
 * a hearing. It gets its own section rather than a footnote.
 */

const DOES = [
  "Reads a CSV of written consultation responses, one row per response.",
  "Asks Gemini whether each chunk states a position at all, then extracts the theme and key point.",
  "Merges labels that are different words for the same argument.",
  "Ranks themes by how many distinct organisations raised each, with the quote that best represents it.",
];

const DOES_NOT = [
  "English only. No Tamil or Tanglish yet.",
  "Does not say whether a response supports or opposes — only what it is about.",
  "Scanned PDFs with no text layer are skipped, not OCRed.",
  "Accuracy is measured on a small hand-labelled set, so treat it as indicative.",
];

export function AboutView() {
  return (
    <div className="view">
      <div className="view-head">
        <h1>About this tool</h1>
        <p>
          Built for a policy analyst reading public objections to a draft plan. Coimbatore's
          Master Plan 2041 drew over 3,000 objections on a 600-page document, and the Local
          Planning Authority went through them by hand over roughly two months.
        </p>
      </div>

      <div className="about-grid">
        <div className="card about-card">
          <div className="card-head">
            <h2>What it does</h2>
          </div>
          <ul>
            {DOES.map((t) => (
              <li key={t}>
                <span className="dot" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card about-card warn">
          <div className="card-head">
            <h2>What it does not do</h2>
          </div>
          <ul>
            {DOES_NOT.map((t) => (
              <li key={t}>
                <span className="dot" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card card-tonal about-card">
          <div className="card-head">
            <h2>When it is not sure</h2>
          </div>
          <ul>
            <li>
              <span className="dot" />
              <span>
                Real submissions are full of text that is not an opinion: respondents quoting
                the consultation's own questions, footnotes, member rosters, "we appreciate the
                opportunity to comment".
              </span>
            </li>
            <li>
              <span className="dot" />
              <span>
                Rather than inventing a theme for those, the tool sets them aside and reports
                how many. On a 40-chunk sample it filtered 16 and removed four junk themes that
                would otherwise have ranked.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
