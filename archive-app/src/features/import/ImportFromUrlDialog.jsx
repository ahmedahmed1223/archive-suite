import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Link2, Loader2, X } from "lucide-react";

import { createVideoItemValue } from "../videos/viewModel.js";
import {
  IMPORT_KINDS,
  buildImportDraft,
  parseImportLines
} from "./importSources.js";

// Visual treatment per source kind: an Arabic label plus a DaisyUI badge color.
// Deferred (NOT in this slice): server-side metadata fetch, Drive OAuth for
// private files, actual media download, and local-folder batch import.
const KIND_BADGE = {
  [IMPORT_KINDS.YOUTUBE]: { label: "يوتيوب", className: "badge-error" },
  [IMPORT_KINDS.GOOGLE_DRIVE]: { label: "Google Drive", className: "badge-info" },
  [IMPORT_KINDS.WEB]: { label: "رابط ويب", className: "badge-neutral" }
};

function KindBadge({ kind }) {
  const meta = KIND_BADGE[kind] || KIND_BADGE[IMPORT_KINDS.WEB];
  return jsx("span", { className: `badge ${meta.className} badge-sm`, children: meta.label });
}

function SourcePreviewRow({ source }) {
  const draft = buildImportDraft(source);
  return jsxs("div", {
    className: "flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2",
    children: [
      jsxs("div", { className: "min-w-0", children: [
        jsx("p", { className: "truncate text-sm font-semibold", title: draft?.title, children: draft?.title || "—" }, "title"),
        jsx("p", { dir: "ltr", className: "truncate text-left text-xs opacity-60", title: source.normalizedUrl, children: source.normalizedUrl }, "url")
      ] }),
      jsx(KindBadge, { kind: source.kind })
    ]
  });
}

async function runImport(sources, addVideoItem) {
  let imported = 0;
  let failed = 0;
  for (const source of sources) {
    const draft = buildImportDraft(source);
    if (!draft) {
      failed += 1;
      continue;
    }
    try {
      await addVideoItem?.(createVideoItemValue(draft));
      imported += 1;
    } catch {
      failed += 1;
    }
  }
  return { imported, failed };
}

/**
 * Dialog that lets a user paste one or many links, previews the detected
 * sources, and on confirm creates an archive item referencing each URL.
 */
export function ImportFromUrlDialog({ open, onOpenChange, addVideoItem, showToast }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputId = React.useId();

  const sources = React.useMemo(() => parseImportLines(text), [text]);

  const close = () => {
    if (busy) return;
    setText("");
    onOpenChange?.(false);
  };

  const confirmImport = async () => {
    if (!sources.length || busy) return;
    setBusy(true);
    try {
      const { imported, failed } = await runImport(sources, addVideoItem);
      if (imported) showToast?.(`تم استيراد ${imported} عنصر${failed ? ` (تعذّر ${failed})` : ""}`, failed ? "warning" : "success");
      else showToast?.("تعذّر استيراد الروابط", "error");
      if (imported) {
        setText("");
        onOpenChange?.(false);
      }
    } catch {
      showToast?.("حدث خطأ أثناء الاستيراد", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return jsx("div", {
    className: "fixed inset-0 z-[9990] flex items-center justify-center bg-black/60 p-4",
    onClick: close,
    children: jsxs("div", {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "استيراد من روابط",
      dir: "rtl",
      onClick: (event) => event.stopPropagation(),
      className: "card w-full max-w-xl bg-base-100 shadow-2xl",
      children: [
        jsxs("div", { className: "flex items-center justify-between gap-3 border-b border-base-300 p-4", children: [
          jsxs("h2", { className: "flex items-center gap-2 text-lg font-bold", children: [
            jsx(Link2, { className: "h-5 w-5 text-primary" }, "icon"),
            "استيراد من روابط"
          ] }, "heading"),
          jsx("button", { type: "button", onClick: close, "aria-label": "إغلاق", className: "btn btn-ghost btn-sm btn-circle", children: jsx(X, { className: "h-4 w-4" }) }, "close")
        ] }),
        jsxs("div", { className: "space-y-3 p-4", children: [
          jsxs("label", { htmlFor: inputId, className: "block text-sm opacity-80", children: [
            "ألصق رابطًا واحدًا أو أكثر (يوتيوب، Google Drive، أو روابط ويب). كل سطر أو رابط مفصول بفاصلة يُضاف كعنصر."
          ] }, "label"),
          jsx("textarea", {
            id: inputId,
            value: text,
            onChange: (event) => setText(event.target.value),
            dir: "ltr",
            rows: 5,
            className: "textarea textarea-bordered w-full text-left",
            placeholder: "https://youtu.be/...\nhttps://drive.google.com/file/d/...\nhttps://example.com/article"
          }, "textarea"),
          sources.length
            ? jsxs("div", { className: "space-y-2", children: [
                jsx("p", { className: "text-xs opacity-70", children: `${sources.length} مصدر جاهز للاستيراد` }, "count"),
                jsx("div", { className: "max-h-56 space-y-2 overflow-y-auto", children: sources.map((source) => jsx(SourcePreviewRow, { source }, source.normalizedUrl)) }, "list")
              ] }, "preview")
            : text.trim()
              ? jsx("div", { role: "alert", className: "alert alert-warning py-2 text-sm", children: "لم يتم التعرّف على روابط صالحة بعد." }, "empty")
              : null
        ] }),
        jsxs("div", { className: "flex items-center justify-end gap-2 border-t border-base-300 p-4", children: [
          jsx("button", { type: "button", onClick: close, disabled: busy, className: "btn btn-ghost", children: "إلغاء" }, "cancel"),
          jsxs("button", {
            type: "button",
            onClick: confirmImport,
            disabled: !sources.length || busy,
            className: "btn btn-primary gap-2",
            children: [
              busy ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }, "spin") : null,
              busy ? "يستورد…" : `استيراد ${sources.length || ""}`.trim()
            ]
          }, "confirm")
        ] })
      ]
    })
  });
}

export default ImportFromUrlDialog;
