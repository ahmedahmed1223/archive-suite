import { jsx, jsxs } from "react/jsx-runtime";

import { useAppStore } from "../../stores/appStore.js";
import { selectUploadProgress } from "../../stores/slices/uploadSlice.js";
import { formatNumber } from "../../utils/formatting.js";

const STATUS_LABEL = {
  queued: "في الطابور",
  hashing: "حساب البصمة…",
  uploading: "جارٍ الرفع…",
  done: "اكتمل",
  duplicate: "مكرر (موجود)",
  paused: "متوقف",
  error: "فشل"
};

const STATUS_TONE = {
  done: "text-emerald-500",
  duplicate: "text-amber-500",
  error: "text-rose-500",
  paused: "text-amber-500"
};

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${formatNumber(Number((bytes / 1024 ** i).toFixed(1)))} ${units[i]}`;
}

function UploadRow({ item, onRemove, onRetry }) {
  const tone = STATUS_TONE[item.status] || "text-[var(--va-text-2)]";
  const canRetry = item.status === "error" || item.status === "paused";
  return jsxs("li", {
    className: "rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3",
    children: [
      jsxs("div", {
        className: "flex items-center justify-between gap-3",
        children: [
          jsxs("div", {
            className: "min-w-0",
            children: [
              jsx("p", { className: "truncate text-sm text-[var(--va-text)]", children: item.name }),
              jsxs("p", {
                className: `text-xs ${tone}`,
                children: [STATUS_LABEL[item.status] || item.status, " · ", formatBytes(item.size)]
              })
            ]
          }),
          jsxs("div", {
            className: "flex shrink-0 items-center gap-2",
            children: [
              canRetry &&
                jsx("button", {
                  type: "button",
                  onClick: () => onRetry(item.id),
                  className: "rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] px-2 py-1 text-xs text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-elevated)]",
                  children: "إعادة"
                }),
              jsx("button", {
                type: "button",
                onClick: () => onRemove(item.id),
                "aria-label": "إزالة",
                className: "rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] px-2 py-1 text-xs text-[var(--va-text-muted)] transition-colors hover:bg-[var(--va-elevated)]",
                children: "✕"
              })
            ]
          })
        ]
      }),
      jsx("div", {
        className: "mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10",
        children: jsx("div", {
          className: `h-full rounded-full transition-[width] ${item.status === "error" ? "bg-rose-500" : "bg-emerald-500"}`,
          style: { width: `${item.progress || 0}%` }
        })
      }),
      item.error &&
        jsx("p", { className: "mt-1 text-xs text-rose-400", children: item.error })
    ]
  });
}

/**
 * Background upload queue panel. Renders live overall + per-file progress and
 * lets the user retry/remove entries while uploads continue (§753).
 * Reads queue state from the app store; transfers are driven by useChunkedUpload.
 */
export function UploadQueue() {
  const uploads = useAppStore((state) => state.uploads);
  const removeUpload = useAppStore((state) => state.removeUpload);
  const retryUpload = useAppStore((state) => state.retryUpload);
  const clearFinishedUploads = useAppStore((state) => state.clearFinishedUploads);

  if (!uploads || uploads.length === 0) return null;

  const overall = selectUploadProgress(uploads);
  const active = uploads.filter((u) => u.status !== "done" && u.status !== "duplicate").length;

  return jsxs("section", {
    className: "va-filter-surface rounded-2xl va-surface-muted border p-4",
    dir: "rtl",
    "aria-label": "طابور الرفع",
    children: [
      jsxs("div", {
        className: "mb-3 flex items-center justify-between gap-3",
        children: [
          jsxs("h3", {
            className: "text-sm font-semibold text-white",
            children: ["الرفع", active > 0 ? jsxs("span", { className: "text-gray-400", children: [" · ", active, " نشط"] }) : null]
          }),
          jsx("button", {
            type: "button",
            onClick: clearFinishedUploads,
            className: "rounded-lg border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/10",
            children: "مسح المكتمل"
          })
        ]
      }),
      jsx("div", {
        className: "mb-3 h-2 w-full overflow-hidden rounded-full bg-white/10",
        children: jsx("div", {
          className: "h-full rounded-full bg-emerald-500 transition-[width]",
          style: { width: `${overall}%` }
        })
      }),
      jsx("ul", {
        className: "flex flex-col gap-2",
        children: uploads.map((item) =>
          jsx(UploadRow, { item, onRemove: removeUpload, onRetry: retryUpload }, item.id)
        )
      })
    ]
  });
}
