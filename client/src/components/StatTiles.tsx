import type { JSX } from "react";
import type { AnalysisResult } from "../types";
import { IconBuilding, IconCheck, IconFile, IconTag } from "./Icons";

interface Tile {
  label: string;
  value: string | number;
  sub: string;
  icon: JSX.Element;
}

export function StatTiles({ result }: { result: AnalysisResult }) {
  const tiles: Tile[] = [
    { label: "Responses read", value: result.total, sub: "chunks of text", icon: <IconFile /> },
    {
      label: "Carried a position",
      value: result.analyzed,
      sub: `${result.skipped} set aside as boilerplate`,
      icon: <IconCheck />,
    },
    {
      label: "Organisations",
      value: result.organisations ?? "—",
      sub: result.organisations ? "distinct stakeholders" : "no org column in this file",
      icon: <IconBuilding />,
    },
    {
      label: "Themes found",
      value: result.themeCount,
      sub: "after merging synonyms",
      icon: <IconTag />,
    },
  ];

  return (
    <div className="kpis">
      {tiles.map((t) => (
        <div className="kpi" key={t.label}>
          <span className="kpi-icon">{t.icon}</span>
          <div className="value">{t.value}</div>
          <div className="label">{t.label}</div>
          <div className="sub">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
