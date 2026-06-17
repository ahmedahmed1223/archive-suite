import {
  CheckCircle2,
  FileVideo,
  FolderOpen,
  Upload,
  X
} from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import {
  createFileImportRows,
  createImportedVideoItem
} from "./fileImport.js";
import { formatFileSize, formatNumber } from "../../utils/formatting.js";
import { useAppStore } from "../../stores/index.js";

function getWizardButtonClass(tone = "neutral", disabled = false) {
  const toneClass = tone === "primary"
    ? "btn btn-primary"
    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";
  return `inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${disabled ? "cursor-not-allowed opacity-50" : ""} ${toneClass}`;
}

function WizardButton({ children, onClick, disabled = false, tone = "neutral", icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={getWizardButtonClass(tone, disabled)}
    >
      {icon}
      {children}
    </button>
  );
}

function FileChoiceLabel({ children, htmlFor, tone = "neutral", icon }) {
  return (
    <label htmlFor={htmlFor} className={getWizardButtonClass(tone)}>
      {icon}
      {children}
    </label>
  );
}

export function FileArchiveWizard({
  open,
  onOpenChange,
  contentTypes = [],
  videoItems = [],
  addVideoItem,
  showToast
}) {
  const fileInputId = React.useId();
  const folderInputId = React.useId();
  const firstType = contentTypes.find((type) => type.status !== "archived") || contentTypes[0] || null;
  const [rows, setRows] = React.useState([]);
  const [typeId, setTypeId] = React.useState(firstType?.id || "");
  const [subtypeId, setSubtypeId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setRows([]);
      setNotes("");
      setIsSaving(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!typeId && firstType?.id) setTypeId(firstType.id);
  }, [firstType?.id, typeId]);

  const selectedType = contentTypes.find((type) => type.id === typeId);
  const subtypes = selectedType?.subtypes || [];

  React.useEffect(() => {
    if (subtypeId && !subtypes.some((subtype) => subtype.id === subtypeId)) setSubtypeId("");
  }, [subtypeId, subtypes]);

  if (!open) return null;

  const readFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const nextRows = createFileImportRows(files, videoItems);
    setRows(nextRows);
    if (!nextRows.length) showToast?.("لم يتم العثور على ملفات فيديو قابلة للإضافة", "warning");
  };

  const handleFileInputChange = (event) => {
    readFiles(event.target.files);
    event.target.value = "";
  };

  const selectedRows = rows.filter((row) => row.selected);
  const duplicateCount = rows.filter((row) => row.duplicate).length;
  const totalSize = selectedRows.reduce((sum, row) => sum + (row.file?.size || 0), 0);

  const toggleRow = (rowId) => {
    setRows((current) => current.map((row) => row.id === rowId ? { ...row, selected: !row.selected } : row));
  };

  const createItems = async () => {
    if (!selectedRows.length) return;
    setIsSaving(true);
    const addedIds = [];
    try {
      for (const row of selectedRows) {
        const item = createImportedVideoItem(row, { typeId, subtypeId, notes });
        addedIds.push(item.id);
        const savedItem = await addVideoItem?.(item);
        useAppStore.getState().enqueueUploads?.([row.file], {
          source: "fileArchiveWizard",
          linkedItemId: (savedItem || item).id,
          fieldKey: "localFile"
        });
      }
      const { showNotification, bulkDeleteItems } = useAppStore.getState();
      showNotification?.(
        `تمت إضافة ${addedIds.length} ملف إلى الأرشيف`,
        {
          type: "success",
          action: { label: "تراجع", run: () => bulkDeleteItems?.(addedIds, { skipUndo: true }) },
        }
      );
      onOpenChange?.(false);
    } catch (error) {
      showToast?.(error?.message || "فشل استيراد الملفات", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-[9985] overflow-y-auto bg-black/65 p-4 text-right text-white backdrop-blur-sm" style={{ zIndex: 2147483000 }}>
      <section className="mx-auto my-6 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1626] shadow-2xl shadow-black/35">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl va-accent-bg-soft va-accent-text-on-soft">
                <Upload className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold">استيراد ملفات إلى الأرشيف</h2>
                <p className="mt-1 text-sm text-slate-400">يتم حفظ بيانات الملف ومساره فقط، ولا يتم تخزين محتوى الفيديو داخل التطبيق.</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => onOpenChange?.(false)} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-5 p-5 md:grid-cols-[1fr_320px]">
          <main className="space-y-4">
            <div
              className="rounded-3xl border border-dashed va-accent-border va-accent-bg-soft p-7 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                readFiles(event.dataTransfer?.files);
              }}
            >
              <FileVideo className="mx-auto h-12 w-12 va-accent-text-on-soft" />
              <h3 className="mt-4 text-lg font-bold">اختر ملفات فيديو أو اسحبها هنا</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-7 va-accent-text-on-soft">
                يمكنك اختيار ملفات منفردة أو مجلد كامل. تظهر معاينة ومكررّات محتملة قبل إنشاء العناصر.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <FileChoiceLabel htmlFor={fileInputId} icon={<Upload className="h-4 w-4" />} tone="primary">
                  اختيار ملفات
                </FileChoiceLabel>
                <FileChoiceLabel htmlFor={folderInputId} icon={<FolderOpen className="h-4 w-4" />}>
                  اختيار مجلد
                </FileChoiceLabel>
              </div>
              <input id={fileInputId} type="file" aria-label="اختيار ملفات فيديو للاستيراد" multiple accept="video/*,.mp4,.webm,.ogg,.mov,.m4v,.avi,.mkv,.wmv" onChange={handleFileInputChange} style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }} />
              <input id={folderInputId} type="file" aria-label="اختيار مجلد فيديو للاستيراد" multiple webkitdirectory="" directory="" onChange={handleFileInputChange} style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">الملفات المقروءة</p>
                <p className="mt-1 text-2xl font-bold">{formatNumber(rows.length)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">المحدد للإضافة</p>
                <p className="mt-1 text-2xl font-bold">{formatNumber(selectedRows.length)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">الحجم التقريبي</p>
                <p className="mt-1 text-2xl font-bold">{formatFileSize(totalSize)}</p>
              </div>
            </div>

            {duplicateCount > 0 && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-7 text-amber-100">
                تم تعليم {formatNumber(duplicateCount)} ملف كمكرر محتمل. يمكنك تحديده يدويًا إذا أردت إضافته.
              </div>
            )}

            <div className="max-h-[420px] overflow-auto rounded-2xl border border-white/10">
              {rows.length ? rows.map((row) => (
                <label key={row.id} className="grid cursor-pointer gap-3 border-b border-white/5 bg-white/[0.02] p-3 last:border-b-0 hover:bg-white/[0.05] sm:grid-cols-[auto_1fr_auto]">
                  <input type="checkbox" checked={row.selected} onChange={() => toggleRow(row.id)} className="mt-1 h-4 w-4 accent-emerald-500" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-100">{row.title}</span>
                    <span dir="ltr" className="mt-1 block truncate text-left text-xs text-slate-500">{row.path || row.file.name}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {row.duplicate && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-100">مكرر محتمل</span>}
                    <span>{formatFileSize(row.file.size || 0)}</span>
                  </span>
                </label>
              )) : (
                <div className="p-8 text-center text-sm text-slate-500">لم يتم اختيار ملفات بعد.</div>
              )}
            </div>
          </main>

          <aside className="h-fit space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4 lg:sticky lg:top-5">
            <h3 className="font-bold">إعدادات الإنشاء</h3>
            <label className="block text-sm text-slate-300">
              النوع
              <select value={typeId} onChange={(event) => setTypeId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-white outline-none focus:border-emerald-500/40">
                <option value="">بدون نوع</option>
                {contentTypes.filter((type) => type.status !== "archived").map((type) => (
                  <option key={type.id} value={type.id}>{type.name || type.id}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              الفرع
              <select value={subtypeId} onChange={(event) => setSubtypeId(event.target.value)} disabled={!subtypes.length} className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-white outline-none focus:border-emerald-500/40 disabled:opacity-50">
                <option value="">بدون فرع</option>
                {subtypes.map((subtype) => (
                  <option key={subtype.id} value={subtype.id}>{subtype.name || subtype.id}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              ملاحظة مشتركة
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-right text-white outline-none focus:border-emerald-500/40" placeholder="اختياري" />
            </label>
            <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-[#07111f]/70 p-3 text-xs leading-6 text-slate-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 va-accent-text" />
              <span>سيتم إنشاء عنصر أرشيف لكل ملف محدد مع حقل metadata باسم <span dir="ltr" className="font-mono text-slate-200">localFile</span>.</span>
            </div>
            <WizardButton
              tone="primary"
              disabled={!selectedRows.length || isSaving}
              onClick={createItems}
              icon={<Upload className={`h-4 w-4 ${isSaving ? "opacity-60" : ""}`} />}
            >
              {isSaving ? "جار الإضافة..." : `إضافة ${formatNumber(selectedRows.length)} ملف`}
            </WizardButton>
          </aside>
        </div>
      </section>
    </div>,
    document.body
  );
}

export default FileArchiveWizard;
