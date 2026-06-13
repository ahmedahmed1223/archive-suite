import { useAppStore } from "../stores/index.js";
import { getFileStore } from "@archive/core";
import {
  CloudUpload,
  ExternalLink,
  FileText,
  FileUp,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Search,
  Trash2
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { PageHero, UXStateBlock } from "../components/ui/V1Primitives.jsx";
import { appConfirm } from "../components/common/ConfirmDialog.js";
import { reportError } from "../utils/errorReporting.js";
import { formatNumber } from "../utils/formatting.js";
import { getCloudToken } from "../bootstrap/cloudSession.js";
import { resolveBackendChoice } from "../bootstrap/backendChoice.js";
import { createMediaClient } from "../features/media/mediaClient.js";
import { buildFileBrowserRows, canUseServerMediaTools, filterFileBrowserRows, isAudioVideo, sanitizeUploadKey } from "../features/media/viewModel.js";

const TYPE_META = {
  image: { label: "صورة", icon: ImageIcon, tone: "text-cyan-200 border-cyan-500/20 bg-cyan-500/10" },
  video: { label: "فيديو", icon: Film, tone: "text-violet-200 border-violet-500/20 bg-violet-500/10" },
  audio: { label: "صوت", icon: Music, tone: "text-amber-200 border-amber-500/20 bg-amber-500/10" },
  document: { label: "مستند", icon: FileText, tone: "va-accent-text-on-soft va-accent-border va-accent-bg-soft" },
  file: { label: "ملف", icon: FileText, tone: "text-gray-300 border-white/10 bg-white/5" }
};

function FileThumb({ row, fileStore }) {
  const [url, setUrl] = React.useState("");
  React.useEffect(() => {
    if (row.type !== "image" || !fileStore?.getUrl) {
      setUrl("");
      return undefined;
    }
    let alive = true;
    fileStore.getUrl(row.key)
      .then((next) => { if (alive) setUrl(next || ""); })
      .catch(() => { if (alive) setUrl(""); });
    return () => { alive = false; };
  }, [fileStore, row.key, row.type]);

  const meta = TYPE_META[row.type] || TYPE_META.file;
  const Icon = meta.icon;
  return jsx("div", {
    className: "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gray-950/40",
    children: url
      ? jsx("img", { src: url, alt: "", loading: "lazy", className: "h-full w-full object-cover" })
      : jsx(Icon, { className: "h-7 w-7 text-gray-500" })
  });
}

export function UploaderPage() {
  const { showToast, showNotification, currentUser } = useAppStore();
  const fileStore = React.useMemo(() => { try { return getFileStore(); } catch { return null; } }, []);
  const backendChoice = resolveBackendChoice();
  const mediaToolsEnabled = canUseServerMediaTools({ backend: backendChoice.backend, token: getCloudToken(), role: currentUser?.role });

  const [folder, setFolder] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [keys, setKeys] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const inputId = React.useId();
  const folderId = React.useId();
  const searchId = React.useId();

  const autoProcessMedia = async (key, file) => {
    if (!mediaToolsEnabled || !isAudioVideo(file)) return;
    const client = createMediaClient({ baseUrl: backendChoice.url, getToken: getCloudToken });
    try {
      await client.probe(key);
      if (String(file?.type || "").startsWith("video/") || /\.(mp4|webm|mov|mkv|m4v)$/i.test(file?.name || "")) {
        await client.thumbnail(key, { width: 640 });
      }
      showNotification?.("تم تجهيز بيانات الوسائط بعد الرفع.", {
        type: "success",
        category: "export",
        title: "ffmpeg",
        targetLabel: key
      });
    } catch (error) {
      reportError(showNotification, error, { context: `تجهيز ${key} بعد الرفع` });
    }
  };

  const refresh = React.useCallback(async () => {
    if (!fileStore) return;
    setLoading(true);
    try {
      const list = await fileStore.list(folder || "");
      setKeys(Array.isArray(list) ? list : []);
    } catch (error) {
      reportError(showNotification, error, { context: "قراءة قائمة الملفات" });
    } finally {
      setLoading(false);
    }
  }, [fileStore, folder, showNotification]);

  React.useEffect(() => { refresh(); }, [refresh]);

  const upload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || !fileStore) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const file of files) {
        const key = sanitizeUploadKey(file.name, { folder });
        try {
          await fileStore.putBlob(key, file, { contentType: file.type });
          await autoProcessMedia(key, file);
          ok += 1;
        } catch (error) {
          reportError(showNotification, error, { context: `رفع ${file.name}` });
        }
      }
      if (ok) showToast?.(`تم رفع ${formatNumber(ok)} ملف`, "success");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (key) => {
    const confirmed = await appConfirm(`حذف الملف "${key}"؟`, { title: "حذف ملف", kind: "danger", confirmLabel: "حذف" });
    if (!confirmed || !fileStore) return;
    try {
      await fileStore.remove(key);
      showToast?.("تم حذف الملف", "info");
      await refresh();
    } catch (error) {
      reportError(showNotification, error, { context: "حذف الملف" });
    }
  };

  const open = async (key) => {
    try {
      const url = await fileStore?.getUrl?.(key);
      if (url && typeof window !== "undefined") window.open(url, "_blank", "noopener");
      else showToast?.("لا يمكن فتح هذا الملف.", "warning");
    } catch (error) {
      reportError(showNotification, error, { context: "فتح الملف" });
    }
  };

  const rows = React.useMemo(() => buildFileBrowserRows(keys), [keys]);
  const visibleRows = React.useMemo(() => filterFileBrowserRows(rows, query), [rows, query]);

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6", dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(CloudUpload, { className: "h-6 w-6 va-accent-text" }),
        title: "رفع الملفات",
        description: "ارفع الوسائط والمرفقات إلى مخزن الملفات (محلي أو سحابي: disk/Dropbox/S3) وأدِرها."
      }),

      jsxs("section", { className: "va-control-surface space-y-3 rounded-2xl va-surface-muted border p-4", children: [
        jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [
          jsxs("label", { htmlFor: folderId, className: "block space-y-1 text-sm text-gray-300", children: [
            jsx("span", { children: "مجلّد الرفع والاستعراض" }),
            jsx("input", { id: folderId, value: folder, onChange: (e) => setFolder(e.target.value), placeholder: "مثال: thumbnails", dir: "ltr", className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-left text-sm text-white outline-none focus:border-emerald-500/40" })
          ] }),
          jsxs("label", { htmlFor: searchId, className: "block space-y-1 text-sm text-gray-300", children: [
            jsx("span", { children: "بحث في النتائج" }),
            jsxs("div", { className: "relative", children: [
              jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
              jsx("input", { id: searchId, value: query, onChange: (e) => setQuery(e.target.value), placeholder: "filename, folder, type", dir: "ltr", className: "min-h-11 w-full va-surface-deep rounded-xl border py-2 pe-3 ps-9 text-left text-sm text-white outline-none focus:border-emerald-500/40" })
            ] })
          ] })
        ] }),
        jsxs("label", { htmlFor: inputId, className: "block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-gray-950/30 p-6 text-center hover:border-emerald-500/30", children: [
          busy ? jsx(Loader2, { className: "mx-auto h-10 w-10 animate-spin va-accent-text" }) : jsx(FileUp, { className: "mx-auto h-10 w-10 text-gray-500" }),
          jsx("p", { className: "mt-2 text-sm font-semibold text-white", children: busy ? "جارٍ الرفع…" : "اختر ملفات للرفع" }),
          jsx("p", { className: "mt-1 text-xs text-gray-500", children: "يمكن اختيار عدة ملفات" }),
          jsx("input", { id: inputId, type: "file", "aria-label": "اختيار ملفات للرفع", multiple: true, className: "hidden", disabled: busy, onChange: (e) => upload(e.target.files) })
        ] })
      ] }),

      jsxs("section", { className: "space-y-3 rounded-2xl va-surface-muted border p-4", children: [
        jsxs("div", { className: "flex items-center justify-between gap-3", children: [
          jsxs("h2", { className: "flex items-center gap-2 text-base font-bold text-white", children: [jsx(FolderOpen, { className: "h-4 w-4 va-accent-text" }), `الملفات (${formatNumber(visibleRows.length)} / ${formatNumber(rows.length)})`] }),
          jsxs("button", { type: "button", onClick: refresh, disabled: loading, className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/5 disabled:opacity-40", children: [loading ? jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" }) : jsx(RefreshCw, { className: "h-3.5 w-3.5" }), "تحديث"] })
        ] }),
        !fileStore ? jsx(UXStateBlock, {
          state: "error",
          title: "مخزن الملفات غير جاهز",
          description: "افتح إعدادات التخزين وتأكد من تهيئة FileStore قبل الرفع أو الاستعراض."
        }) : loading && !rows.length ? jsx(UXStateBlock, { state: "loading" }) : visibleRows.length ? jsx("div", { className: "grid gap-2 lg:grid-cols-2", children: visibleRows.map((row) => {
          const meta = TYPE_META[row.type] || TYPE_META.file;
          return jsxs("article", { className: "flex min-w-0 items-center gap-3 rounded-xl va-surface-subtle border p-3", children: [
            jsx(FileThumb, { row, fileStore }),
            jsxs("div", { className: "min-w-0 flex-1", children: [
              jsx("button", { type: "button", onClick: () => open(row.key), dir: "ltr", className: "block max-w-full truncate text-left text-sm font-semibold va-accent-text-on-soft hover:underline", title: row.key, children: row.name }),
              row.folder && jsx("p", { dir: "ltr", className: "mt-0.5 truncate text-xs text-gray-500", title: row.folder, children: row.folder }),
              jsx("span", { className: `mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${meta.tone}`, children: meta.label })
            ] }),
            jsxs("div", { className: "flex shrink-0 items-center gap-1", children: [
              jsx("button", { type: "button", onClick: () => open(row.key), "aria-label": `فتح ${row.key}`, className: "rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-emerald-200", children: jsx(ExternalLink, { className: "h-4 w-4" }) }),
              jsx("button", { type: "button", onClick: () => remove(row.key), "aria-label": `حذف ${row.key}`, className: "rounded-lg p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-300", children: jsx(Trash2, { className: "h-4 w-4" }) })
            ] })
          ] }, row.key);
        }) }) : jsx(UXStateBlock, {
          icon: jsx(CloudUpload, { className: "h-14 w-14" }),
          title: rows.length ? "لا توجد نتائج مطابقة" : "لا توجد ملفات بعد",
          description: rows.length ? "غيّر البحث أو المجلد الحالي." : "ارفع ملفًا من الأعلى لتظهر هنا.",
          actionLabel: rows.length ? "مسح البحث" : undefined,
          onAction: rows.length ? () => setQuery("") : undefined
        })
      ] })
    ]
  });
}

UploaderPage.pageId = "uploader";
UploaderPage.migrationStatus = "native";

export default UploaderPage;
