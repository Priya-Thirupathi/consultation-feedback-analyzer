import { useRef, useState, type DragEvent } from "react";
import { IconClose, IconFile, IconUpload } from "./Icons";

interface Props {
  file: File | null;
  /** Rows counted client side, null until the count comes back. */
  rows: number | null;
  running: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
  onAnalyze: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The upload is the product's front door, so it gets a real target rather than
 * a bare `<input type="file">`: that control renders differently in every
 * browser, offers no drop affordance, and says nothing about what was picked.
 * The native input is still here, visually hidden, so keyboard and screen
 * reader users get the platform file picker unchanged.
 */
export function FileDrop({ file, rows, running, onSelect, onClear, onAnalyze }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onSelect(dropped);
  }

  return (
    <div
      className={`drop${over ? " is-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="drop-inner">
        <span className="drop-icon">
          <IconUpload />
        </span>

        <h2 className="drop-title">Drop a CSV of consultation responses</h2>
        <p className="drop-hint">
          One row per response. A <code>comment</code> or <code>text</code> column is read,
          and an <code>organisation</code> column is used when it is present.
        </p>

        {file && (
          <div className="file-chip">
            <IconFile />
            <span className="name">{file.name}</span>
            <span className="spacer" />
            <span className="meta">
              {rows !== null && `${rows.toLocaleString()} rows · `}
              {formatSize(file.size)}
            </span>
            <button
              className="icon-btn"
              style={{ width: 32, height: 32 }}
              onClick={onClear}
              disabled={running}
              aria-label="Remove file"
            >
              <IconClose />
            </button>
          </div>
        )}

        <div className="drop-actions">
          <button className="btn btn-outlined" onClick={() => inputRef.current?.click()} disabled={running}>
            {file ? "Choose another file" : "Browse files"}
          </button>
          <button className="btn" onClick={onAnalyze} disabled={running || !file}>
            {running ? "Analysing…" : "Analyse"}
          </button>
        </div>

        <input
          className="sr-only"
          type="file"
          accept=".csv,text/csv"
          ref={inputRef}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) onSelect(picked);
            // Reset so re-picking the same file after a clear still fires.
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
