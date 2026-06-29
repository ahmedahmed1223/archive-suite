import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Link2, Loader2, X } from "lucide-react";
import { getSessionProvider } from "@archive/core";

import { getBackendUrl } from "../../bootstrap/backendChoice.js";
import { createVideoItemValue } from "../videos/viewModel.js";
import { previewImportSources } from "./importPreviewClient.js";
import {
  IMPORT_KINDS,
  buildImportDraft,
  parseImportLines,
  parseLocalFolderManifest
} from "./importSources.js";

// Visual treatment per source kind: an Arabic label plus a DaisyUI badge color.
// Deferred (NOT in this slice): Drive OAuth for private files, actual media
// download, and local-folder batch import.
const KIND_BADGE = {
  [IMPORT_KINDS.YOUTUBE]: { label: "يوتيوب", className: "badge-error" },
  [IMPORT_KINDS.GOOGLE_DRIVE]: { label: "Google Drive", className: "badge-info" },
  [IMPORT_KINDS.LOCAL_FOLDER]: { label: "Manifest محلي", className: "badge-success" },
  [IMPORT_KINDS.WEB]: { label: "رابط ويب", className: "badge-neutral" }
};

function KindBadge({ kind }: any) {
  const meta = (KIND_BADGE as any)[kind] || KIND_BADGE[IMPORT_KINDS.WEB];
  return jsx("span", { className: `badge ${meta.className} badge-sm`, children: meta.label });
}

function SourcePreviewRow({ source, preview }: any) {
  const draft = buildImportDraft(source);
  const title = preview?.ok && preview.title ? preview.title : draft?.title;
  return jsxs("div", {
    className: "flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2",
    children: [
      jsxs("div", { className: "min-w-0", children: [
        jsx("p", { className: "truncate text-sm font-semibold", title, children: title || "—" }, "title"),
        preview?.ok && preview.description
          ? jsx("p", { className: "truncate text-xs opacity-70", title: preview.description, children: preview.description }, "description")
          : null,
        jsx("p", { dir: "ltr", className: "truncate text-left text-xs opacity-60", title: source.normalizedUrl, children: source.normalizedUrl }, "url")
      ] }),
      jsx(KindBadge, { kind: source.kind })
    ]
  });
}

function ManifestPreviewRow({ draft }: any) {
  return jsxs("div", {
    className: "flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2",
    children: [
      jsxs("div", { className: "min-w-0", children: [
        jsx("p", { className: "truncate text-sm font-semibold", title: draft.title, children: draft.title || "—" }, "title"),
        jsx("p", { dir: "ltr", className: "truncate text-left text-xs opacity-60", title: draft.path, children: draft.path }, "path")
      ] }),
      jsx(KindBadge, { kind: IMPORT_KINDS.LOCAL_FOLDER })
    ]
  });
}

function mergePreviewIntoDraft(draft: any, preview: any) {
  if (!preview?.ok) return draft;
  return {
    ...draft,
    title: preview.title || draft.title,
    thumbnail: preview.thumbnailUrl || draft.thumbnail || "",
    notes: preview.description || draft.notes || "",
    metadata: {
      ...draft.metadata,
      ...(preview.description ? { sourceDescription: preview.description } : {}),
      ...(preview.thumbnailUrl ? { sourceThumbnailUrl: preview.thumbnailUrl } : {})
    }
  };
}

async function runImport(sources: any, previews: any, localDrafts: any, addVideoItem: any) {
  let imported = 0;
  let failed = 0;
  for (const source of sources) {
    const draft = mergePreviewIntoDraft(buildImportDraft(source), previews[source.normalizedUrl]);
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
  for (const draft of localDrafts) {
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
export function ImportFromUrlDialog({ open, onOpenChange, addVideoItem, showToast }: any) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [previewBusy, setPreviewBusy] = React.useState(false);
  const [previews, setPreviews] = React.useState({});
  const [localDrafts, setLocalDrafts] = React.useState<any[]>([]);
  const [manifestError, setManifestError] = React.useState("");
  const inputId = React.useId();
  const manifestInputId = React.useId();

  const sources = React.useMemo(() => parseImportLines(text), [text]);
  const totalReady = sources.length + localDrafts.length;

  React.useEffect(() => {
    if (!open || sources.length === 0) {
      setPreviews({});
      setPreviewBusy(false);
      return undefined;
    }
    let cancelled = false;
    setPreviewBusy(true);
    const token = String(getSessionProvider()?.getToken?.() || "");
    previewImportSources({
      baseUrl: getBackendUrl(),
      token,
      urls: sources.map((source: any) => source.normalizedUrl)
    }).then((items: any) => {
      if (cancelled) return;
      const next = {};
      for (const item of items) (next as any)[item.url] = item;
      setPreviews(next);
    }).catch(() => {
      if (!cancelled) setPreviews({});
    }).finally(() => {
      if (!cancelled) setPreviewBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, sources]);

  const close = () => {
    if (busy) return;
    setText("");
    setLocalDrafts([]);
    setManifestError("");
    onOpenChange?.(false);
  };

  const loadManifestFile = async (file: any) => {
    setManifestError("");
    if (!file) return;
    try {
      const drafts = parseLocalFolderManifest(await file.text());
      if (!drafts.length) {
        setManifestError("لم يحتوي ملف manifest على مسارات صالحة.");
        setLocalDrafts([]);
        return;
      }
      setLocalDrafts(drafts);
      showToast?.(`تم تجهيز ${drafts.length} عنصر من manifest المجلد المحلي.`, "success");
    } catch {
      setManifestError("تعذر قراءة ملف manifest.");
      setLocalDrafts([]);
    }
  };

  const confirmImport = async () => {
    if (!totalReady || busy) return;
    setBusy(true);
    try {
      const { imported, failed } = await runImport(sources, previews, localDrafts, addVideoItem);
      if (imported) showToast?.(`تم استيراد ${imported} عنصر${failed ? ` (تعذّر ${failed})` : ""}`, failed ? "warning" : "success");
      else showToast?.("تعذّر استيراد المصادر", "error");
      if (imported) {
        setText("");
        setLocalDrafts([]);
        setManifestError("");
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
      onClick: (event: any) => event.stopPropagation(),
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
            "ألصق رابطًا واحدًا أو أكثر (يوتيوب، Google Drive، أو روابط ويب)، أو أضف manifest لمجلد محلي بصيغة JSON."
          ] }, "label"),
          jsx("textarea", {
            id: inputId,
            value: text,
            onChange: (event: any) => setText(event.target.value),
            dir: "ltr",
            rows: 5,
            className: "textarea textarea-bordered w-full text-left",
            placeholder: "https://youtu.be/...\nhttps://drive.google.com/file/d/...\nhttps://example.com/article"
          }, "textarea"),
          sources.length
            ? jsxs("div", { className: "space-y-2", children: [
                jsx("p", { className: "text-xs opacity-70", children: previewBusy ? "يجري جلب بيانات المصادر…" : `${sources.length} مصدر جاهز للاستيراد` }, "count"),
                jsx("div", { className: "max-h-56 space-y-2 overflow-y-auto", children: sources.map((source: any) => jsx(SourcePreviewRow, { source, preview: (previews as any)[source.normalizedUrl] }, source.normalizedUrl)) }, "list")
              ] }, "preview")
            : text.trim()
              ? jsx("div", { role: "alert", className: "alert alert-warning py-2 text-sm", children: "لم يتم التعرّف على روابط صالحة بعد." }, "empty")
              : null,
          jsxs("div", { className: "rounded-lg border border-dashed border-base-300 bg-base-200/30 p-3", children: [
            jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
              jsxs("div", { className: "min-w-0", children: [
                jsx("p", { className: "text-sm font-semibold", children: "Manifest مجلد محلي" }),
                jsx("p", { className: "mt-1 text-xs opacity-70", children: "ملف JSON يحتوي files[] مع relativePath/path/title/tags. يحفظ مراجع فقط ولا يقرأ الملفات مباشرة." })
              ] }),
              jsx("input", {
                id: manifestInputId,
                type: "file",
                accept: "application/json,.json",
                className: "file-input file-input-bordered file-input-sm max-w-full",
                onChange: (event: any) => loadManifestFile(event.target.files?.[0])
              })
            ] }),
            manifestError ? jsx("div", { role: "alert", className: "alert alert-warning mt-3 py-2 text-sm", children: manifestError }) : null,
            localDrafts.length ? jsxs("div", { className: "mt-3 space-y-2", children: [
              jsx("p", { className: "text-xs opacity-70", children: `${localDrafts.length} عنصر من manifest جاهز للاستيراد` }),
              jsx("div", { className: "max-h-40 space-y-2 overflow-y-auto", children: localDrafts.map((draft: any) => jsx(ManifestPreviewRow, { draft }, draft.path)) })
            ] }) : null
          ] }, "manifest")
        ] }),
        jsxs("div", { className: "flex items-center justify-end gap-2 border-t border-base-300 p-4", children: [
          jsx("button", { type: "button", onClick: close, disabled: busy, className: "btn btn-ghost", children: "إلغاء" }, "cancel"),
          jsxs("button", {
            type: "button",
            onClick: confirmImport,
            disabled: !totalReady || busy,
            className: "btn btn-primary gap-2",
            children: [
              busy ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }, "spin") : null,
              busy ? "يستورد…" : `استيراد ${totalReady || ""}`.trim()
            ]
          }, "confirm")
        ] })
      ]
    })
  });
}

export default ImportFromUrlDialog;
