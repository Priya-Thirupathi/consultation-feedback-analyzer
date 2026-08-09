import { useEffect, useState } from "react";
import { IconLogo, IconMoon, IconSun } from "./Icons";

type Mode = "light" | "dark";

const KEY = "cfa-theme";

/**
 * Light is the default for everyone, including people whose OS is set to dark.
 * The page is designed light-first, and `prefers-color-scheme` used to repaint
 * the whole product into a theme the reader never chose — which is exactly how
 * a demo ends up dark on a judge's laptop.
 */
function readStored(): Mode {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function AppBar() {
  const [mode, setMode] = useState<Mode>(readStored);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // Private browsing blocks writes; the toggle still works for this session.
    }
  }, [mode]);

  return (
    <header className="appbar">
      <div className="appbar-brand">
        <span className="appbar-mark">
          <IconLogo />
        </span>
        <span className="appbar-title">
          <b>Heard</b>
        </span>
      </div>

      <div className="appbar-spacer" />

      <span className="appbar-tag">Byte Squad · Team 331</span>
      <button
        className="icon-btn"
        onClick={() => setMode(mode === "dark" ? "light" : "dark")}
        aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} theme`}
        title={`Switch to ${mode === "dark" ? "light" : "dark"} theme`}
      >
        {mode === "dark" ? <IconSun /> : <IconMoon />}
      </button>
    </header>
  );
}
