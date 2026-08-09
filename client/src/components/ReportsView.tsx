import type { SavedReport } from "../types";

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

interface Props {
  reports: SavedReport[];
  openId: string | null;
  onOpen: (report: SavedReport) => void;
  onDelete: (id: string) => void;
}

/**
 * Past runs. A run costs minutes of paced Gemini quota, so losing one to a
 * refresh is expensive in a way a normal page reload is not — this is the list
 * that makes a finished consultation something you can come back to.
 */
export function ReportsView({ reports, openId, onOpen, onDelete }: Props) {
  return (
    <div className="view">
      <div className="view-head">
        <h1>Reports</h1>
        <p>
          Finished runs, kept in this browser. They survive a refresh but do not
          follow you to another machine — use Save as PDF for anything that has to
          leave.
        </p>
      </div>

      {reports.length === 0 ? (
        <p className="notice">
          No saved reports yet. Analyse a file and it will be kept here.
        </p>
      ) : (
        <ul className="reports">
          {reports.map((r) => (
            <li className="report" key={r.id} aria-current={r.id === openId ? "true" : undefined}>
              <div className="report-main">
                <h3>{r.fileName}</h3>
                <div className="counts">
                  {when(r.savedAt)} · {r.result.themeCount} themes ·{" "}
                  {r.result.total.toLocaleString()} responses
                  {r.result.organisations !== null && <> · {r.result.organisations} organisations</>}
                </div>
              </div>

              <div className="report-actions">
                <button className="btn-outlined" onClick={() => onOpen(r)}>
                  {r.id === openId ? "Showing" : "Open"}
                </button>
                <button
                  className="btn-text"
                  onClick={() => onDelete(r.id)}
                  aria-label={`Delete the report for ${r.fileName}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
