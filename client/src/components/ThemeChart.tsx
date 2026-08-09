import { useState } from "react";
import type { RankMode, Theme } from "../types";

interface Props {
  themes: Theme[];
  mode: RankMode;
  hasOrgs: boolean;
  onModeChange: (mode: RankMode) => void;
}

interface TipState {
  theme: Theme;
  x: number;
  y: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ThemeChart({ themes, mode, hasOrgs, onModeChange }: Props) {
  const [tip, setTip] = useState<TipState | null>(null);

  const valueOf = (t: Theme) => (mode === "orgs" ? (t.organisations ?? 0) : t.chunks);
  const max = Math.max(1, ...themes.map(valueOf));
  const unit = mode === "orgs" ? "organisation" : "mention";

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>
            {mode === "orgs"
              ? "Themes by organisations that raised them"
              : "Themes by mentions in the text"}
          </h2>
          <p className="note">
            {mode === "orgs"
              ? "One organisation's long submission counts once."
              : "Every chunk counts, so a single long submission can dominate."}
          </p>
        </div>

        {hasOrgs && (
          <div className="segmented" role="group" aria-label="Ranking method">
            <button aria-pressed={mode === "orgs"} onClick={() => onModeChange("orgs")}>
              Organisations
            </button>
            <button aria-pressed={mode === "chunks"} onClick={() => onModeChange("chunks")}>
              Mentions
            </button>
          </div>
        )}
      </div>

      <div className="bars">
        {themes.map((t) => {
          const v = valueOf(t);
          const secondary =
            mode === "orgs"
              ? plural(t.chunks, "mention")
              : t.organisations !== null
                ? plural(t.organisations, "organisation")
                : null;

          return (
            <div
              className="row"
              key={t.theme}
              // The tooltip is a convenience only: the same numbers are in this
              // row's aria-label and in the Themes view, so nothing is gated
              // behind hover.
              aria-label={`${t.theme}: ${plural(v, unit)}${secondary ? `, ${secondary}` : ""}`}
              onMouseMove={(e) => setTip({ theme: t, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTip(null)}
            >
              <div className="name">{t.theme}</div>
              <div className="track">
                <div className="bar" style={{ width: `${(v / max) * 100}%` }} />
              </div>
              <div className="tip">
                <span>{plural(v, unit)}</span>
                {secondary && <span className="weak">{secondary}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {tip && <ChartTooltip {...tip} />}
    </div>
  );
}

function ChartTooltip({ theme, x, y }: TipState) {
  // Flip left near the right edge so it never runs off an unfamiliar screen.
  const width = 280;
  const left = x + 14 + width > window.innerWidth ? x - width - 14 : x + 14;

  return (
    <div className="tooltip" style={{ left, top: Math.min(y + 14, window.innerHeight - 90) }} role="status">
      <div className="t-theme">{theme.theme}</div>
      <div>
        {plural(theme.chunks, "mention")}
        {theme.organisations !== null && ` · ${plural(theme.organisations, "organisation")}`}
      </div>
      {theme.orgNames.length > 0 && <div className="t-orgs">{theme.orgNames.join(", ")}</div>}
    </div>
  );
}
