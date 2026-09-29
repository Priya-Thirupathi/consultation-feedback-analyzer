import { useEffect, useMemo, useState } from "react";
import { analyze, analyzeSample, countRows } from "./api";
import { deleteReport, loadReports, newReportId, saveReport } from "./storage";
import { downloadCsv } from "./export";
import type { AnalysisState, RankMode, SavedReport, Theme, ThemeLayout, View } from "./types";
import { AppBar } from "./components/AppBar";
import { NavRail } from "./components/NavRail";
import { FileDrop } from "./components/FileDrop";
import { ResultsSkeleton } from "./components/ResultsSkeleton";
import { StatTiles } from "./components/StatTiles";
import { Finding } from "./components/Finding";
import { LeadCard } from "./components/LeadCard";
import { ThemeChart } from "./components/ThemeChart";
import { ThemeCards, ThemeList } from "./components/ThemeViews";
import { AboutView } from "./components/AboutView";
import { ReportsView } from "./components/ReportsView";
import { IconGrid, IconList } from "./components/Icons";

const STEPS = [
  {
    title: "Upload the responses",
    body: "A CSV export from the consultation portal, one row per written response.",
  },
  {
    title: "Gemini reads every one",
    body: "It decides whether a chunk states a position at all, then extracts the theme and key point.",
  },
  {
    title: "Themes are merged and ranked",
    body: "Synonym labels collapse together, and each theme keeps the quote that best represents it.",
  },
];

export default function App() {
  const [state, setState] = useState<AnalysisState>({ status: "idle" });
  const [view, setView] = useState<View>("upload");
  const [mode, setMode] = useState<RankMode>("orgs");
  const [layout, setLayout] = useState<ThemeLayout>("cards");
  const [elapsed, setElapsed] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<number | null>(null);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  // The name shown above the findings. Separate from `file`, because a restored
  // report has a name but no File object behind it.
  const [reportName, setReportName] = useState<string | null>(null);

  // Reopen the most recent run on load. A run costs minutes of paced quota, so
  // a refresh landing back on an empty upload screen threw away something
  // expensive — that is the whole reason this exists.
  useEffect(() => {
    const saved = loadReports();
    setReports(saved);
    const latest = saved[0];
    if (!latest) return;
    setState({ status: "done", result: latest.result, seconds: latest.seconds });
    setMode(latest.result.organisations !== null ? "orgs" : "chunks");
    setReportName(latest.fileName);
    setOpenId(latest.id);
    setView("overview");
  }, []);

  // Counted as soon as a file is picked rather than at submit, so the row count
  // and the time estimate are both on screen before anyone commits to a run.
  useEffect(() => {
    if (!file) {
      setRows(null);
      return;
    }
    let cancelled = false;
    countRows(file).then((n) => {
      if (!cancelled) setRows(n);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Requests are paced under the free tier limit, so a run takes 20s to
  // minutes. A button that goes quiet that long reads as a crash.
  useEffect(() => {
    if (state.status !== "running") return;
    const started = state.startedAt;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [state]);

  function onSelect(picked: File) {
    if (!picked.name.toLowerCase().endsWith(".csv")) {
      setState({
        status: "error",
        message: `${picked.name} is not a CSV. Export the responses as CSV and try again.`,
      });
      return;
    }
    setFile(picked);
    setState({ status: "idle" });
  }

  async function onAnalyze() {
    if (!file) {
      setState({ status: "error", message: "Pick a CSV first." });
      return;
    }

    const count = rows ?? (await countRows(file));
    const startedAt = Date.now();
    setElapsed(0);
    setState({ status: "running", rows: count, startedAt });

    try {
      const result = await analyze(file);
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      setMode(result.organisations !== null ? "orgs" : "chunks");
      setState({ status: "done", result, seconds });

      // Save before anything else can go wrong with the render. saveReport
      // returns what actually fit in the quota, so the list on screen is never
      // more optimistic than the store.
      const saved: SavedReport = {
        id: newReportId(),
        fileName: file.name,
        savedAt: Date.now(),
        seconds,
        result,
      };
      setReports(saveReport(saved));
      setOpenId(saved.id);
      setReportName(saved.fileName);
      // Land on the findings rather than leaving the reader on the upload
      // screen wondering whether anything happened.
      setView("overview");
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  }

  // Runs the bundled TRAI sample instead of an uploaded file, for a visitor
  // who wants to see a real report before trusting the tool with their own CSV.
  async function onUseSample() {
    const SAMPLE_NAME = "trai_sample.csv";
    const startedAt = Date.now();
    setElapsed(0);
    setFile(null);
    setRows(null);
    setState({ status: "running", rows: 40, startedAt });

    try {
      const result = await analyzeSample();
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      setMode(result.organisations !== null ? "orgs" : "chunks");
      setState({ status: "done", result, seconds });

      const saved: SavedReport = {
        id: newReportId(),
        fileName: SAMPLE_NAME,
        savedAt: Date.now(),
        seconds,
        result,
      };
      setReports(saveReport(saved));
      setOpenId(saved.id);
      setReportName(saved.fileName);
      setView("overview");
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  }

  function onOpenReport(report: SavedReport) {
    setState({ status: "done", result: report.result, seconds: report.seconds });
    setMode(report.result.organisations !== null ? "orgs" : "chunks");
    setReportName(report.fileName);
    setOpenId(report.id);
    setView("overview");
  }

  function onDeleteReport(id: string) {
    setReports(deleteReport(id));
    // Deleting the report you are looking at should clear the screen too,
    // rather than leave findings on display that no longer exist anywhere.
    if (id === openId) {
      setState({ status: "idle" });
      setReportName(null);
      setOpenId(null);
    }
  }

  const result = state.status === "done" ? state.result : null;
  const hasOrgs = result?.organisations != null;
  const running = state.status === "running";

  // Sorted client side so the toggle is instant: both numbers are already in
  // the response, so flipping the ranking needs no second Gemini run.
  const ranked: Theme[] = useMemo(() => {
    if (!result) return [];
    const value = (t: Theme) => (mode === "orgs" ? (t.organisations ?? 0) : t.chunks);
    return [...result.themes].sort((a, b) => value(b) - value(a) || b.chunks - a.chunks);
  }, [result, mode]);

  return (
    <div className="shell">
      <AppBar />
      <NavRail view={view} hasResult={result !== null} onChange={setView} />

      <main className="main">
        {view === "upload" && (
          <div className="view">
            <div className="view-head">
              <h1>Read a whole consultation in the time it takes to read one reply</h1>
              <p>
                See what was actually argued and how many organisations argued it, with the
                quote behind every theme.
              </p>
            </div>

            <div className="upload-grid">
              <div>
                <FileDrop
                  file={file}
                  rows={rows}
                  running={running}
                  onSelect={onSelect}
                  onClear={() => {
                    setFile(null);
                    setState({ status: "idle" });
                  }}
                  onAnalyze={onAnalyze}
                  onUseSample={onUseSample}
                />
                <Status state={state} elapsed={elapsed} />
              </div>

              <div className="howto">
                {STEPS.map((s, i) => (
                  <div className="howto-item" key={s.title}>
                    <span className="howto-num">{i + 1}</span>
                    <div>
                      <h3>{s.title}</h3>
                      <p>{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {running && <ResultsSkeleton />}
          </div>
        )}

        {view === "overview" && result && (
          <div className="view">
            <div className="view-head">
              <h1>Overview</h1>
              <p>
                {reportName ?? file?.name} · {result.total} responses read in{" "}
                {state.status === "done" ? state.seconds : 0}s.
              </p>
            </div>

            {result.capped && (
              <p className="notice">
                That file had {result.uploadedRows.toLocaleString()} rows. This demo reads the
                first {result.total.toLocaleString()} to stay inside the free tier quota, so
                every count here covers that first {result.total.toLocaleString()} only.
              </p>
            )}

            <Finding result={result} />

            <AiNote />

            <StatTiles result={result} />

            <div className="overview-grid">
              <ThemeChart
                themes={ranked}
                mode={mode}
                hasOrgs={hasOrgs}
                onModeChange={setMode}
              />
              <LeadCard top={ranked[0]} result={result} mode={mode} />
            </div>
          </div>
        )}

        {view === "themes" && result && (
          <div className="view">
            <div className="view-head">
              <h1>Themes</h1>
              <p>
                Ranked the same way as the chart. Every quote is a real response, not a
                summary.
              </p>
            </div>

            <AiNote />

            {/* Print only. On screen the file name and counts are already in the
                Overview; on paper the page has to say what it is a report of. */}
            <div className="print-head">
              <strong>{reportName ?? file?.name}</strong>
              <span>
                {result.total.toLocaleString()} responses · {result.analyzed} carried a
                position · {result.skipped} set aside
                {result.organisations !== null && <> · {result.organisations} organisations</>}
              </span>
            </div>

            <div className="themes-toolbar">
              <span className="counts">
                {ranked.length} themes from {result.analyzed} responses that carried a position
              </span>

              <div className="toolbar-actions">
                <div className="segmented" role="group" aria-label="Layout">
                  <button aria-pressed={layout === "cards"} onClick={() => setLayout("cards")}>
                    <IconGrid size={16} />
                    Cards
                  </button>
                  <button aria-pressed={layout === "list"} onClick={() => setLayout("list")}>
                    <IconList size={16} />
                    List
                  </button>
                </div>

                {/* The browser's own print dialog, which every platform offers a
                    "Save as PDF" target for. No PDF library to ship, and the
                    print stylesheet decides what the page looks like on paper. */}
                <button className="btn-outlined" onClick={() => window.print()}>
                  Save as PDF
                </button>
                <button
                  className="btn-outlined"
                  onClick={() => downloadCsv(result, reportName ?? file?.name ?? "report")}
                >
                  Download source rows
                </button>
              </div>
            </div>

            {layout === "cards" ? (
              <ThemeCards themes={ranked} mode={mode} />
            ) : (
              <ThemeList themes={ranked} mode={mode} />
            )}
          </div>
        )}

        {view === "reports" && (
          <ReportsView
            reports={reports}
            openId={openId}
            onOpen={onOpenReport}
            onDelete={onDeleteReport}
          />
        )}

        {view === "about" && <AboutView />}
      </main>
    </div>
  );
}

/**
 * AI disclosure, and the line that answers "how do we know any of this is real".
 * The two halves matter equally: the labels are model output and can be wrong,
 * but the quoted text is not model output at all. `extractOne` in
 * src/extract.ts spreads a Verdict carrying only substantive/theme/key_point
 * over the uploaded row, so the chunk text is structurally unable to be
 * rewritten by Gemini.
 */
function AiNote() {
  return (
    <p className="ai-note">
      <b>Themes are generated by Google Gemini</b> and can be wrong. The quotes and
      source rows are your uploaded text, carried through unedited — the model
      labels each response, it never rewrites one. Check any theme against its
      source rows. <b>About</b> carries how often it is right, measured on 40
      hand-labelled responses.
    </p>
  );
}

function Status({ state, elapsed }: { state: AnalysisState; elapsed: number }) {
  switch (state.status) {
    case "idle":
      return null;

    case "running": {
      const estimate = Math.max(10, Math.round(state.rows * 0.55));
      // Eases toward 95% and holds. Showing 100% before the response is back
      // would be a lie, and the estimate is only ever an estimate.
      const pct = Math.min(95, Math.round((elapsed / estimate) * 95));
      return (
        <div>
          {/* One text node, not several: `.status` is a flex row with a gap, and
              bare text between elements becomes its own flex item, which put a
              stray 12px either side of every number. */}
          <p className="status" role="status">
            <span className="spinner" />
            <span>
              Reading {state.rows} responses with Gemini… <span className="num">{elapsed}s</span>{" "}
              elapsed, usually about <span className="num">{estimate}s</span>.
            </span>
          </p>
          <div className="progress">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    }

    case "done":
      return (
        <p className="status done" role="status">
          Done — {state.result.themeCount} themes across {state.result.total} responses.
        </p>
      );

    case "error":
      return (
        <p className="status error" role="alert">
          {state.message}
        </p>
      );
  }
}
