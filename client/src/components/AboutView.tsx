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
  "Does not detect form-letter campaigns: identical text from many senders counts as many.",
];

/**
 * Measured numbers, shown to the analyst rather than kept in a benchmark log.
 *
 * An analyst deciding whether to put a ranking in front of a committee needs to
 * know how often it is wrong and in which direction, not just that it "can be
 * wrong". Every figure here comes from scripts/benchmark.ts on
 * data/trai_sample_labeled.csv and must be updated together with it.
 */
const ACCURACY = [
  {
    label: "Boilerplate set aside correctly",
    value: "11 of 11",
    note: "None wrongly kept, so nothing that was page furniture became a theme.",
  },
  {
    label: "Real arguments given the right theme",
    value: "22 of 29",
    note: "76% end to end. Of the 24 rows it chose to keep, 22 were right — 92%.",
  },
  {
    label: "Real arguments wrongly set aside",
    value: "5 of 29",
    note: "The costly error. Four of the five opened with a footnote, heading or bare list.",
  },
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

        <div className="card about-card accuracy-card">
          <div className="card-head">
            <h2>How often it is right</h2>
          </div>
          <p className="about-lede">
            Measured on 40 responses from a real TRAI consultation, each one read and
            labelled by hand.
          </p>

          <dl className="accuracy">
            {ACCURACY.map((a) => (
              <div key={a.label}>
                <dt>{a.value}</dt>
                <dd>
                  <b>{a.label}</b>
                  <span>{a.note}</span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="about-foot">
            <b>Read this as a shortlist to verify, not a finding to cite.</b> Open a theme's
            source rows before you quote it. The wording of a theme also shifts between runs,
            so refer to the counts and the rows, never to a remembered label.
          </p>
          <p className="about-foot muted">
            Caveats worth knowing: one consultation, in English, and 40 rows is a small sample,
            so treat the percentages as indicative rather than precise. The checker that scores
            these matches is from the same model family as the extractor, which makes it a
            sanity check rather than an independent benchmark.
          </p>
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
