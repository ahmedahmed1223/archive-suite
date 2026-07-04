"use client";

import { useState } from "react";
import { createArchiveApiClient, type FileBrowserEntry } from "@/lib/archive-api";

interface MediaSourcePickerProps {
  label: string;
  onSelect: (path: string) => void;
}

/** Lets the user browse stored media via the Laravel files browser instead of
 * typing a raw path, so play/compare pick a real, existing source. */
export default function MediaSourcePicker({ label, onSelect }: MediaSourcePickerProps) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<FileBrowserEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function browse(nextPath: string) {
    setLoading(true);
    setError("");
    const api = createArchiveApiClient();
    const response = await api.browseFiles({ path: nextPath });
    if (response.ok) {
      setPath(response.path);
      setEntries(response.entries);
    } else {
      setError(response.error);
    }
    setLoading(false);
  }

  function handleOpen() {
    setOpen(true);
    void browse("");
  }

  return (
    <div className="media-source-picker">
      <button type="button" className="button button-secondary button-sm" onClick={handleOpen}>
        {label}
      </button>

      {open ? (
        <div className="panel panel-compact media-source-picker__browser" role="dialog" aria-label="اختيار مصدر المادة">
          <div className="panel-title-row">
            <h3>تصفح ملفات الأرشيف — {path || "/"}</h3>
            <button type="button" className="button button-secondary button-sm" onClick={() => setOpen(false)}>
              إغلاق
            </button>
          </div>
          {loading ? <p className="helper-text">جارٍ التحميل...</p> : null}
          {error ? <p className="form-status status-error" role="alert">{error}</p> : null}
          <ul className="media-source-picker__list">
            {entries.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  className="button button-secondary button-sm"
                  onClick={() => {
                    if (entry.kind === "folder") {
                      void browse(entry.path || entry.key);
                    } else {
                      onSelect(entry.path || entry.key);
                      setOpen(false);
                    }
                  }}
                >
                  {entry.kind === "folder" ? "📁" : "🎞"} {entry.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
