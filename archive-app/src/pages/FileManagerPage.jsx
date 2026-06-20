import * as React from "react";
import {
  Archive, CheckSquare, Copy, Download, File, Folder, FolderPlus, Grid3X3,
  List, Loader2, MoreVertical, Move, RefreshCw, Search, Trash2, Upload, X
} from "lucide-react";
import { getStorageProvider } from "@archive/core";

import { useAppStore } from "../stores/index.js";
import { getBackendUrl } from "../bootstrap/backendChoice.js";
import { getCloudToken } from "../bootstrap/cloudSession.js";
import * as defaultApi from "../features/file-manager/fileManagerClient.js";
import { queueUploadedFile } from "../features/file-manager/ingestQueue.js";
import {
  buildBreadcrumbs, joinFileManagerPath, mergeBrowserEntries, readViewMode,
  saveViewMode, toggleSelection
} from "../features/file-manager/viewModel.js";

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function fileName(key = "") {
  return key.slice(key.lastIndexOf("/") + 1);
}

export function FileManagerPage({ api = defaultApi, queueUpload = queueUploadedFile, storageProvider, onArchive }) {
  const { settings, updateSettings, showToast, setCurrentPage } = useAppStore();
  const deps = React.useMemo(() => ({ baseUrl: getBackendUrl(), getToken: getCloudToken }), []);
  const [path, setPath] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [entries, setEntries] = React.useState([]);
  const [nextCursor, setNextCursor] = React.useState(null);
  const [view, setView] = React.useState(() => readViewMode());
  const [selection, setSelection] = React.useState(new Set());
  const [activeKey, setActiveKey] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [folderDialog, setFolderDialog] = React.useState(false);
  const [folderName, setFolderName] = React.useState("");
  const [destinationDialog, setDestinationDialog] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const uploadInput = React.useRef(null);
  const autoQueue = settings?.fileManager?.autoQueueUploads !== false;

  const load = React.useCallback(async ({ append = false, cursor = "" } = {}) => {
    setLoading(true);
    setError("");
    try {
      const result = await api.browseFiles({ path, query, cursor, ...deps });
      setEntries((current) => append ? mergeBrowserEntries(current, result.entries) : result.entries || []);
      setNextCursor(result.nextCursor || null);
    } catch (loadError) {
      setError(loadError?.message || "تعذّر تحميل الملفات.");
    } finally {
      setLoading(false);
    }
  }, [api, deps, path, query]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => load(), query ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  React.useEffect(() => {
    const openUpload = () => uploadInput.current?.click();
    window.addEventListener("videoarchive:file-manager-upload", openUpload);
    return () => window.removeEventListener("videoarchive:file-manager-upload", openUpload);
  }, []);

  const navigate = (nextPath) => {
    setPath(nextPath);
    setSelection(new Set());
    setActiveKey("");
  };

  const changeView = (mode) => setView(saveViewMode(mode));
  const activeEntry = entries.find((entry) => entry.key === activeKey) || null;
  const selectedKeys = [...selection];

  const runAction = async (action, extra = {}) => {
    if (!selectedKeys.length && action !== "rename") return;
    setBusy(true);
    try {
      const result = await api.runFileAction({ action, keys: selectedKeys, ...extra, ...deps });
      const failed = result?.results?.filter((item) => !item.ok) || [];
      showToast?.(failed.length ? `اكتملت العملية مع ${failed.length} أخطاء.` : "اكتملت عملية الملفات.", failed.length ? "warning" : "success");
      setSelection(new Set());
      setDestinationDialog("");
      await load();
    } catch (actionError) {
      showToast?.(actionError?.message || "فشلت عملية الملفات.", "error");
    } finally {
      setBusy(false);
    }
  };

  const createFolder = async () => {
    const clean = folderName.trim();
    if (!clean) return;
    setBusy(true);
    try {
      await api.createFileFolder({ path: joinFileManagerPath(path, clean), ...deps });
      setFolderDialog(false);
      setFolderName("");
      await load();
    } catch (folderError) {
      showToast?.(folderError?.message || "فشل إنشاء المجلد.", "error");
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (event) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    setBusy(true);
    try {
      const storage = storageProvider || (() => { try { return getStorageProvider(); } catch { return null; } })();
      for (const upload of files) {
        const key = joinFileManagerPath(path, upload.name);
        const result = await api.uploadManagedFile({ key, file: upload, ...deps });
        await queueUpload({ key: result?.key || key, name: upload.name, size: upload.size, mimeType: upload.type }, { globalDefault: autoQueue, storage }).catch(() => null);
      }
      showToast?.(`تم رفع ${files.length} ملف.`, "success");
      await load();
    } catch (uploadError) {
      showToast?.(uploadError?.message || "فشل رفع الملفات.", "error");
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  };

  const downloadSelected = async () => {
    for (const key of selectedKeys) {
      const blob = await api.downloadManagedFile({ key, ...deps });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = fileName(key);
      anchor.click();
      URL.revokeObjectURL(href);
    }
  };

  const archiveSelected = () => {
    if (selectedKeys.length !== 1) return;
    const payload = { fileKey: selectedKeys[0], source: "file-manager" };
    if (onArchive) onArchive(payload);
    else {
      sessionStorage.setItem("archive.pendingFile", JSON.stringify(payload));
      setCurrentPage?.("add");
    }
  };

  const entryButton = (entry) => {
    const selected = selection.has(entry.key);
    return (
      <button
        type="button"
        className={`group flex min-w-0 items-center gap-3 text-right ${view === "grid" ? "h-36 flex-col justify-center border p-3" : "w-full"} ${selected ? "border-primary bg-primary/10" : "border-base-300 bg-base-100"}`}
        onDoubleClick={() => entry.kind === "folder" && navigate(entry.key)}
        onClick={() => { setActiveKey(entry.key); setSelection((current) => toggleSelection(current, entry.key)); }}
        aria-pressed={selected}
      >
        {entry.kind === "folder" ? <Folder className="h-7 w-7 shrink-0 text-warning" /> : <File className="h-7 w-7 shrink-0 text-info" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{entry.name}</span>
          <span className="mt-1 block text-xs text-base-content/55">{entry.kind === "folder" ? "مجلد" : formatBytes(entry.size)}</span>
        </span>
        {selected && <CheckSquare className="h-4 w-4 shrink-0 text-primary" />}
      </button>
    );
  };

  return (
    <main className="min-h-full bg-base-200/40" dir="rtl">
      <div className="mx-auto max-w-[1600px] space-y-3 p-3 sm:p-5">
        <section className="flex flex-wrap items-center gap-2 border-b border-base-300 pb-3">
          <button type="button" className="btn btn-primary btn-sm gap-2" onClick={() => uploadInput.current?.click()} disabled={busy}><Upload className="h-4 w-4" />رفع ملفات</button>
          <input ref={uploadInput} className="hidden" type="file" multiple onChange={uploadFiles} aria-label="اختيار ملفات للرفع" />
          <button type="button" className="btn btn-ghost btn-sm gap-2" onClick={() => setFolderDialog(true)}><FolderPlus className="h-4 w-4" />مجلد جديد</button>
          <label className="input input-bordered input-sm flex min-w-[220px] flex-1 items-center gap-2 sm:max-w-md">
            <Search className="h-4 w-4 opacity-60" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="grow" placeholder="ابحث داخل هذا المجلد" aria-label="البحث في الملفات" />
          </label>
          <div className="join" aria-label="طريقة العرض">
            <button type="button" className={`btn btn-sm join-item ${view === "list" ? "btn-active" : ""}`} onClick={() => changeView("list")} title="قائمة" aria-label="عرض قائمة"><List className="h-4 w-4" /></button>
            <button type="button" className={`btn btn-sm join-item ${view === "grid" ? "btn-active" : ""}`} onClick={() => changeView("grid")} title="شبكة" aria-label="عرض شبكة"><Grid3X3 className="h-4 w-4" /></button>
          </div>
          <button type="button" className="btn btn-square btn-ghost btn-sm" onClick={() => load()} title="تحديث" aria-label="تحديث الملفات"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </section>

        <nav className="breadcrumbs overflow-x-auto text-sm" aria-label="مسار الملفات">
          <ul>{buildBreadcrumbs(path).map((crumb) => <li key={crumb.path || "root"}><button type="button" onClick={() => navigate(crumb.path)}>{crumb.label}</button></li>)}</ul>
        </nav>

        <section className="grid min-h-[520px] gap-3 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
          <aside className="hidden border-l border-base-300 pl-3 lg:block">
            <h2 className="mb-2 text-xs font-bold uppercase text-base-content/55">المجلدات</h2>
            <button type="button" className="btn btn-ghost btn-sm w-full justify-start gap-2" onClick={() => navigate("")}><Folder className="h-4 w-4" />جذر الملفات</button>
            {entries.filter((entry) => entry.kind === "folder").map((entry) => <button type="button" key={entry.key} className="btn btn-ghost btn-sm mt-1 w-full justify-start gap-2" onClick={() => navigate(entry.key)}><Folder className="h-4 w-4" /><span className="truncate">{entry.name}</span></button>)}
          </aside>

          <div className="min-w-0">
            {selection.size > 0 && (
              <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2 border border-primary/25 bg-primary/10 p-2">
                <span className="px-2 text-sm font-semibold">{selection.size} محدد</span>
                <button type="button" className="btn btn-ghost btn-xs gap-1" onClick={downloadSelected}><Download className="h-3.5 w-3.5" />تنزيل</button>
                <button type="button" className="btn btn-ghost btn-xs gap-1" onClick={() => setDestinationDialog("copy")}><Copy className="h-3.5 w-3.5" />نسخ</button>
                <button type="button" className="btn btn-ghost btn-xs gap-1" onClick={() => setDestinationDialog("move")}><Move className="h-3.5 w-3.5" />نقل</button>
                <button type="button" className="btn btn-ghost btn-xs gap-1 text-error" onClick={() => runAction("delete")}><Trash2 className="h-3.5 w-3.5" />حذف</button>
                <button type="button" className="btn btn-ghost btn-xs gap-1" disabled={selection.size !== 1} onClick={archiveSelected}><Archive className="h-3.5 w-3.5" />بدء الأرشفة</button>
                <button type="button" className="btn btn-square btn-ghost btn-xs mr-auto" onClick={() => setSelection(new Set())} title="إلغاء التحديد" aria-label="إلغاء التحديد"><X className="h-4 w-4" /></button>
              </div>
            )}

            {error && <div className="alert alert-error mb-3"><span>{error}</span><button type="button" className="btn btn-sm" onClick={() => load()}>إعادة المحاولة</button></div>}
            {loading && !entries.length ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="mr-2">جاري تحميل الملفات</span></div>
              : !entries.length ? <div className="flex h-64 flex-col items-center justify-center border border-dashed border-base-300 text-center"><Folder className="mb-3 h-10 w-10 text-base-content/35" /><p className="font-semibold">هذا المجلد فارغ</p><p className="mt-1 text-sm text-base-content/55">ارفع ملفات أو أنشئ مجلدًا للبدء.</p></div>
                : view === "grid" ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">{entries.map((entry) => <div key={entry.key}>{entryButton(entry)}</div>)}</div>
                  : <div className="overflow-x-auto"><table className="table table-sm"><thead><tr><th className="w-10"></th><th>الاسم</th><th>النوع</th><th>الحجم</th><th className="w-10"></th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.key} className={selection.has(entry.key) ? "bg-primary/10" : "hover"}><td><input type="checkbox" className="checkbox checkbox-sm" checked={selection.has(entry.key)} onChange={() => { setActiveKey(entry.key); setSelection((current) => toggleSelection(current, entry.key)); }} aria-label={`تحديد ${entry.name}`} /></td><td><button type="button" className="flex min-w-[220px] items-center gap-2 text-right" onClick={() => entry.kind === "folder" ? navigate(entry.key) : setActiveKey(entry.key)}>{entry.kind === "folder" ? <Folder className="h-5 w-5 text-warning" /> : <File className="h-5 w-5 text-info" />}<span className="truncate">{entry.name}</span></button></td><td>{entry.kind === "folder" ? "مجلد" : "ملف"}</td><td dir="ltr">{entry.kind === "folder" ? "—" : formatBytes(entry.size)}</td><td><button type="button" className="btn btn-square btn-ghost btn-xs" onClick={() => setActiveKey(entry.key)} aria-label={`تفاصيل ${entry.name}`} title="التفاصيل"><MoreVertical className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>}
            {nextCursor && <div className="mt-4 text-center"><button type="button" className="btn btn-ghost btn-sm" onClick={() => load({ append: true, cursor: nextCursor })}>تحميل المزيد</button></div>}
          </div>

          <aside className="border-r border-base-300 pr-3">
            <h2 className="mb-3 text-xs font-bold uppercase text-base-content/55">المعاينة</h2>
            {activeEntry ? <div className="space-y-4"><div className="flex aspect-video items-center justify-center bg-base-300/50">{activeEntry.kind === "folder" ? <Folder className="h-14 w-14 text-warning" /> : <File className="h-14 w-14 text-info" />}</div><div><p className="break-all font-semibold">{activeEntry.name}</p><p className="mt-1 break-all text-xs text-base-content/55" dir="ltr">{activeEntry.key}</p></div><dl className="grid grid-cols-2 gap-2 text-sm"><dt className="text-base-content/55">النوع</dt><dd>{activeEntry.kind === "folder" ? "مجلد" : "ملف"}</dd><dt className="text-base-content/55">الحجم</dt><dd dir="ltr">{formatBytes(activeEntry.size)}</dd></dl></div> : <p className="text-sm leading-7 text-base-content/55">حدد ملفًا لعرض معلوماته. لا تُنشأ مادة في الأرشيف إلا عند اختيار «بدء الأرشفة».</p>}
            <label className="mt-6 flex items-start gap-3 border-t border-base-300 pt-4 text-sm"><input type="checkbox" className="toggle toggle-primary toggle-sm mt-0.5" checked={autoQueue} onChange={(event) => updateSettings?.({ fileManager: { ...(settings?.fileManager || {}), autoQueueUploads: event.target.checked } })} /><span><b className="block">إضافة الرفع لصندوق التجهيز</b><span className="text-xs text-base-content/55">افتراضيًا نعم، ويمكن تغييرها قبل كل رفع.</span></span></label>
          </aside>
        </section>
      </div>

      {folderDialog && <div className="modal modal-open" role="dialog" aria-modal="true" aria-label="إنشاء مجلد"><div className="modal-box max-w-md"><h3 className="text-lg font-bold">مجلد جديد</h3><label className="form-control mt-4"><span className="label-text mb-1">اسم المجلد</span><input autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} className="input input-bordered" /></label><div className="modal-action"><button type="button" className="btn btn-ghost" onClick={() => setFolderDialog(false)}>إلغاء</button><button type="button" className="btn btn-primary" disabled={!folderName.trim() || busy} onClick={createFolder}>إنشاء</button></div></div></div>}
      {destinationDialog && <div className="modal modal-open" role="dialog" aria-modal="true" aria-label="اختيار وجهة"><div className="modal-box max-w-md"><h3 className="text-lg font-bold">{destinationDialog === "copy" ? "نسخ إلى" : "نقل إلى"}</h3><label className="form-control mt-4"><span className="label-text mb-1">مسار المجلد الوجهة</span><input autoFocus value={destination} onChange={(event) => setDestination(event.target.value)} className="input input-bordered" dir="ltr" placeholder="ready/2026" /></label><div className="modal-action"><button type="button" className="btn btn-ghost" onClick={() => setDestinationDialog("")}>إلغاء</button><button type="button" className="btn btn-primary" disabled={busy} onClick={() => runAction(destinationDialog, { destination })}>تنفيذ</button></div></div></div>}
    </main>
  );
}

export default FileManagerPage;
