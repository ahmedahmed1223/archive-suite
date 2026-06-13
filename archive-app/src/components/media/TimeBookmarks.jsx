import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Bookmark, BookmarkPlus, Download, Trash2, X } from "lucide-react";
import { buildTimeBookmarkMarkers, secondsToClock } from "../../features/media/viewModel.js";
import { triggerDownload, safeFileName } from "../../features/projects/exportClient.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeId() {
  return `tbm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Sort bookmarks by time ascending. Returns a new array (immutable). */
function sortedByTime(bookmarks) {
  return [...(bookmarks || [])].sort((a, b) => a.time - b.time);
}

/** Export bookmarks as a Markdown string. */
function toMarkdown(bookmarks, itemTitle) {
  const header = `# علامات زمنية — ${itemTitle || "مادة"}\n\n`;
  const rows = sortedByTime(bookmarks)
    .map((bm) => {
      const base = `- **${secondsToClock(bm.time)}** — ${bm.title}`;
      return bm.note ? `${base}\n  > ${bm.note}` : base;
    })
    .join("\n");
  return header + rows;
}

/** Export bookmarks as a CSV string. */
function toCsv(bookmarks) {
  const header = "timecode,time_seconds,title,note,created_at\n";
  const rows = sortedByTime(bookmarks)
    .map((bm) => {
      const escape = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
      return [
        escape(secondsToClock(bm.time)),
        bm.time,
        escape(bm.title),
        escape(bm.note || ""),
        escape(bm.createdAt || "")
      ].join(",");
    })
    .join("\n");
  return header + rows;
}

function downloadText(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  triggerDownload(blob, filename);
}

// ─── TimeBookmarkButton ──────────────────────────────────────────────────────

/**
 * Button that captures the current playback position from `getTime()` and opens
 * a small inline form so the user can title (and optionally annotate) the
 * bookmark before saving.
 *
 * Props:
 *   getTime   () => number   — returns current playback position in seconds
 *   onSave    (bookmark) => void
 */
export function TimeBookmarkButton({ getTime, getSuggestion, onSave }) {
  const [open, setOpen] = React.useState(false);
  const [captured, setCaptured] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [note, setNote] = React.useState("");
  const titleRef = React.useRef(null);

  const openForm = () => {
    const t = typeof getTime === "function" ? (getTime() ?? 0) : 0;
    const nextTime = Math.max(0, Number(t) || 0);
    const suggestion = typeof getSuggestion === "function" ? getSuggestion(nextTime) : null;
    setCaptured(nextTime);
    setTitle(suggestion?.title || "");
    setNote(suggestion?.note || "");
    setOpen(true);
    // focus title on next paint
    window.requestAnimationFrame(() => titleRef.current?.focus());
  };

  const cancel = () => {
    setOpen(false);
    setTitle("");
    setNote("");
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      titleRef.current?.focus();
      return;
    }
    onSave?.({
      id: makeId(),
      time: captured,
      title: trimmed,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString()
    });
    setOpen(false);
    setTitle("");
    setNote("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
    if (event.key === "Escape") cancel();
  };

  return jsxs("div", {
    dir: "rtl",
    className: "space-y-2",
    children: [
      jsx("button", {
        type: "button",
        onClick: openForm,
        "aria-label": "إضافة علامة زمنية عند اللحظة الحالية",
        className:
          "inline-flex min-h-9 items-center gap-1.5 rounded-lg va-primary-button border border-transparent px-3 py-1.5 text-xs font-semibold text-white transition-colors",
        children: jsxs(React.Fragment, {
          children: [
            jsx(BookmarkPlus, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
            "إضافة علامة زمنية"
          ]
        })
      }),
      open &&
        jsxs("div", {
          role: "region",
          "aria-label": "نموذج إضافة علامة زمنية",
          className:
            "rounded-xl border va-accent-border va-accent-bg-soft p-3 space-y-2",
          children: [
            jsxs("div", {
              className: "flex items-center justify-between gap-2",
              children: [
                jsxs("span", {
                  dir: "ltr",
                  className: "rounded-md border va-accent-border px-2 py-0.5 font-mono text-xs va-accent-text-on-soft",
                  children: [secondsToClock(captured)]
                }),
                jsx("button", {
                  type: "button",
                  onClick: cancel,
                  "aria-label": "إلغاء إضافة العلامة الزمنية",
                  className:
                    "rounded-md p-1 text-gray-400 hover:text-white transition-colors",
                  children: jsx(X, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
                })
              ]
            }),
            jsxs("label", {
              className: "block space-y-1",
              children: [
                jsxs("span", {
                  className: "text-xs text-gray-300",
                  children: [
                    "العنوان ",
                    jsx("span", {
                      className: "text-red-400",
                      "aria-hidden": "true",
                      children: "*"
                    })
                  ]
                }),
                jsx("input", {
                  ref: titleRef,
                  type: "text",
                  value: title,
                  onChange: (e) => setTitle(e.target.value),
                  onKeyDown: handleKeyDown,
                  placeholder: "مثال: بداية المقابلة",
                  "aria-required": "true",
                  className:
                    "min-h-9 w-full va-surface-deep rounded-lg border px-3 text-sm text-white outline-none focus:border-emerald-500/40"
                })
              ]
            }),
            jsxs("label", {
              className: "block space-y-1",
              children: [
                jsx("span", {
                  className: "text-xs text-gray-300",
                  children: "ملاحظة (اختياري)"
                }),
                jsx("input", {
                  type: "text",
                  value: note,
                  onChange: (e) => setNote(e.target.value),
                  onKeyDown: handleKeyDown,
                  placeholder: "وصف مختصر...",
                  className:
                    "min-h-9 w-full va-surface-deep rounded-lg border px-3 text-sm text-white outline-none focus:border-emerald-500/40"
                })
              ]
            }),
            jsxs("div", {
              className: "flex justify-end gap-2",
              children: [
                jsx("button", {
                  type: "button",
                  onClick: cancel,
                  className:
                    "rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 transition-colors",
                  children: "إلغاء"
                }),
                jsx("button", {
                  type: "button",
                  onClick: submit,
                  disabled: !title.trim(),
                  "aria-label": "حفظ العلامة الزمنية",
                  className:
                    "inline-flex items-center gap-1.5 rounded-lg va-primary-button border border-transparent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors",
                  children: jsxs(React.Fragment, {
                    children: [
                      jsx(Bookmark, { className: "h-3.5 w-3.5", "aria-hidden": "true" }),
                      "حفظ"
                    ]
                  })
                })
              ]
            })
          ]
        })
    ]
  });
}

// ─── TimeBookmarkList ────────────────────────────────────────────────────────

/**
 * RTL list of time bookmarks stored on an item.
 *
 * Props:
 *   bookmarks   array of { id, time, title, note?, createdAt }
 *   onSeek      (seconds: number) => void
 *   onDelete    (id: string) => void
 *   itemTitle   string  — used in export filenames / headings
 */
export function TimeBookmarkList({ bookmarks = [], onSeek, onDelete, itemTitle = "" }) {
  const sorted = React.useMemo(() => sortedByTime(bookmarks), [bookmarks]);

  const exportMd = () => {
    const text = toMarkdown(sorted, itemTitle);
    downloadText(
      text,
      `${safeFileName(itemTitle || "bookmarks")}.time-bookmarks.md`,
      "text/markdown;charset=utf-8"
    );
  };

  const exportCsv = () => {
    const text = toCsv(sorted);
    downloadText(
      text,
      `${safeFileName(itemTitle || "bookmarks")}.time-bookmarks.csv`,
      "text/csv;charset=utf-8"
    );
  };

  if (!sorted.length) {
    return jsx("p", {
      className: "text-xs text-gray-500",
      dir: "rtl",
      children: "لا توجد علامات زمنية بعد. استخدم زر «إضافة علامة زمنية» أثناء التشغيل."
    });
  }

  return jsxs("div", {
    dir: "rtl",
    className: "space-y-3",
    children: [
      jsxs("div", {
        className: "flex flex-wrap items-center justify-between gap-2",
        children: [
          jsxs("span", {
            className: "flex items-center gap-1.5 text-xs font-semibold text-gray-300",
            children: [
              jsx(Bookmark, { className: "h-3.5 w-3.5 va-accent-text", "aria-hidden": "true" }),
              `${sorted.length} علامة زمنية`
            ]
          }),
          jsxs("div", {
            className: "flex gap-1.5",
            children: [
              jsx("button", {
                type: "button",
                onClick: exportMd,
                "aria-label": "تصدير العلامات الزمنية بصيغة Markdown",
                className:
                  "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1 text-[11px] text-gray-300 hover:bg-white/[0.06] hover:text-white transition-colors",
                children: jsxs(React.Fragment, {
                  children: [
                    jsx(Download, { className: "h-3 w-3", "aria-hidden": "true" }),
                    "MD"
                  ]
                })
              }),
              jsx("button", {
                type: "button",
                onClick: exportCsv,
                "aria-label": "تصدير العلامات الزمنية بصيغة CSV",
                className:
                  "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.035] px-2 py-1 text-[11px] text-gray-300 hover:bg-white/[0.06] hover:text-white transition-colors",
                children: jsxs(React.Fragment, {
                  children: [
                    jsx(Download, { className: "h-3 w-3", "aria-hidden": "true" }),
                    "CSV"
                  ]
                })
              })
            ]
          })
        ]
      }),
      jsx("ul", {
        className: "space-y-1.5",
        "aria-label": "قائمة العلامات الزمنية",
        children: sorted.map((bm) =>
          jsxs("li", {
            className:
              "flex items-start gap-2 rounded-xl border border-white/10 va-surface-subtle p-2.5",
            children: [
              jsx("button", {
                type: "button",
                onClick: () => onSeek?.(bm.time),
                dir: "ltr",
                "aria-label": `الانتقال إلى ${secondsToClock(bm.time)}`,
                className:
                  "shrink-0 rounded-md border va-accent-border va-accent-bg-soft px-2 py-1 font-mono text-xs va-accent-text-on-soft transition-colors hover:bg-emerald-500/20",
                children: secondsToClock(bm.time)
              }),
              jsxs("div", {
                className: "min-w-0 flex-1",
                children: [
                  jsx("button", {
                    type: "button",
                    onClick: () => onSeek?.(bm.time),
                    className:
                      "block w-full truncate text-right text-sm font-medium text-gray-200 transition-colors hover:text-white",
                    "aria-label": `الانتقال إلى علامة: ${bm.title}`,
                    children: bm.title
                  }),
                  bm.note &&
                    jsx("p", {
                      className: "mt-0.5 text-xs leading-5 text-gray-500",
                      dir: "auto",
                      children: bm.note
                    })
                ]
              }),
              jsx("button", {
                type: "button",
                onClick: () => onDelete?.(bm.id),
                "aria-label": `حذف العلامة الزمنية: ${bm.title}`,
                className:
                  "shrink-0 rounded-md p-1 text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-300",
                children: jsx(Trash2, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
              })
            ]
          }, bm.id)
        )
      })
    ]
  });
}

export function TimeBookmarkTimelineMarkers({ bookmarks = [], duration = 0, currentTime = 0, onSeek }) {
  const markers = React.useMemo(() => buildTimeBookmarkMarkers(bookmarks, duration), [bookmarks, duration]);
  const safeDuration = Number(duration);
  if (!markers.length || !Number.isFinite(safeDuration) || safeDuration <= 0) return null;

  const progress = Math.max(0, Math.min(100, (Number(currentTime) / safeDuration) * 100 || 0));

  return jsxs("div", {
    dir: "ltr",
    className: "space-y-1.5",
    children: [
      jsxs("div", {
        className: "relative h-3 rounded-full border border-white/10 bg-black/35",
        role: "group",
        "aria-label": "علامات زمنية على خط تشغيل المادة",
        children: [
          jsx("div", {
            className: "absolute inset-y-0 left-0 rounded-full va-accent-bg opacity-25",
            style: { width: `${progress}%` }
          }),
          markers.map((marker) => jsx("button", {
            type: "button",
            onClick: () => onSeek?.(marker.time),
            title: `${secondsToClock(marker.time)} - ${marker.label}`,
            "aria-label": `الانتقال إلى ${marker.label} عند ${secondsToClock(marker.time)}`,
            className: "absolute top-1/2 h-4 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 va-accent-bg shadow-sm shadow-black/40 transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-white/70",
            style: { left: `${marker.percent}%` }
          }, marker.id))
        ]
      }),
      jsxs("div", {
        className: "flex items-center justify-between font-mono text-[10px] text-gray-500",
        children: [
          jsx("span", { children: secondsToClock(currentTime) }),
          jsx("span", { children: secondsToClock(safeDuration) })
        ]
      })
    ]
  });
}
