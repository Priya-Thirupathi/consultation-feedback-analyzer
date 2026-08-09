import type { JSX } from "react";
import type { View } from "../types";
import { IconHistory, IconInfo, IconInsights, IconList, IconUpload } from "./Icons";

interface Props {
  view: View;
  hasResult: boolean;
  onChange: (view: View) => void;
}

interface Item {
  id: View;
  label: string;
  icon: JSX.Element;
  /** Overview and Themes have nothing to show until a run has finished. */
  needsResult: boolean;
}

const ITEMS: Item[] = [
  { id: "upload", label: "Upload", icon: <IconUpload size={22} />, needsResult: false },
  { id: "overview", label: "Overview", icon: <IconInsights />, needsResult: true },
  { id: "themes", label: "Themes", icon: <IconList />, needsResult: true },
  // Not gated on a result: the point of the list is to reach a run from an
  // earlier session, when the current one is still empty.
  { id: "reports", label: "Reports", icon: <IconHistory />, needsResult: false },
  { id: "about", label: "About", icon: <IconInfo />, needsResult: false },
];

/**
 * Material 3 navigation rail: a column of icon + label items where the active
 * one wears a 56x32 pill. Collapses to a bottom navigation bar under 700px,
 * which is the Material pattern for that width.
 */
export function NavRail({ view, hasResult, onChange }: Props) {
  return (
    <nav className="rail" aria-label="Sections">
      {ITEMS.map((item) => {
        const locked = item.needsResult && !hasResult;
        return (
          <button
            key={item.id}
            className="rail-item"
            aria-current={view === item.id ? "page" : undefined}
            disabled={locked}
            title={locked ? "Analyse a file first" : undefined}
            onClick={() => onChange(item.id)}
          >
            <span className="rail-icon">{item.icon}</span>
            <span className="rail-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
