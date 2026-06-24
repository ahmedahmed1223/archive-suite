import { useState } from "react";
import { Download, ChevronDown, FileText, Loader2, Table, Archive, FileSpreadsheet } from "lucide-react";
import { useAppStore } from "../../stores/index.js";
import { useLoading } from "../../hooks/useLoading.js";
import { getCloudToken } from "../../bootstrap/cloudSession.js";
import { startOperation } from "../../features/notifications/operationProgress.js";

const FORMAT_LABELS = { csv: "CSV", xlsx: "Excel", "xlsx-template": "قالب Excel", pdf: "PDF", bibtex: "BibTeX", ris: "RIS", zip: "JSON" };

/**
 * Read a fetch Response body to a Blob while reporting download progress.
 * Falls back to res.blob() when streaming or Content-Length is unavailable.
 */
async function readBlobWithProgress(res, onProgress) {
  const total = Number(res.headers.get("Content-Length")) || 0;
  const reader = res.body?.getReader?.();
  if (!reader || total <= 0) {
    return res.blob();
  }
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(Math.round((received / total) * 100));
  }
  return new Blob(chunks, { type: res.headers.get("Content-Type") || "application/octet-stream" });
}

const FORMATS = [
  { id: "csv", label: "CSV", icon: FileText, desc: "مناسب للجداول" },
  { id: "xlsx", label: "Excel", icon: Table, desc: "مناسب لـ Microsoft Excel" },
  { id: "xlsx-template", label: "قالب Excel", icon: FileSpreadsheet, desc: "تعليمات + إعدادات" },
  { id: "pdf", label: "PDF", icon: FileText, desc: "تقرير منسّق" },
  { id: "bibtex", label: "BibTeX", icon: FileText, desc: "استشهادات أكاديمية" },
  { id: "ris", label: "RIS", icon: FileText, desc: "Zotero / EndNote" },
  { id: "zip", label: "JSON", icon: Archive, desc: "بيانات كاملة" },
];

export function ExportButton({ selectedIds = [] }) {
  const [open, setOpen] = useState(false);
  const { anyLoading, isLoading, withLoading } = useLoading();
  const showNotification = useAppStore((s) => s.showNotification);
  const updateNotificationProgress = useAppStore((s) => s.updateNotificationProgress);
  const finalizeNotification = useAppStore((s) => s.finalizeNotification);

  async function handleExport(format) {
    setOpen(false);
    const store = { showNotification, updateNotificationProgress, finalizeNotification };
    const count = selectedIds.length > 0 ? `${selectedIds.length} سجلاً` : "كل السجلات";
    const operation = startOperation(store, {
      title: "تصدير السجلات",
      message: `جارٍ تصدير ${count} بصيغة ${FORMAT_LABELS[format] || format}…`,
      category: "export",
    });
    await withLoading("export", async () => {
      const body = { format, store: "videoItems" };
      if (selectedIds.length > 0) body.ids = selectedIds;

      const token = getCloudToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      let res;
      try {
        res = await fetch("/api/export", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      } catch (error) {
        operation.fail({ message: "تعذّر الاتصال بالخادم أثناء التصدير." });
        throw error;
      }

      if (!res.ok) {
        operation.fail({ message: "فشل التصدير على الخادم." });
        throw new Error("فشل التصدير");
      }

      const blob = await readBlobWithProgress(res, (percent) => operation.setProgress(percent));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match?.[1] ?? `archive-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      operation.succeed({ message: `تم تصدير ${count} بصيغة ${FORMAT_LABELS[format] || format} بنجاح.` });
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={anyLoading}
        aria-label="تصدير السجلات"
        aria-expanded={open}
        className="btn btn-ghost btn-sm gap-1.5"
      >
        {isLoading("export")
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Download className="h-4 w-4" />}
        <span>
          {isLoading("export")
            ? "جاري التصدير..."
            : selectedIds.length > 0 ? `تصدير (${selectedIds.length})` : "تصدير"}
        </span>
        {!isLoading("export") && <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <>
          {/* backdrop */}
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="إغلاق قائمة التصدير"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            dir="rtl"
            className="absolute end-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 va-surface-muted shadow-lg"
          >
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="menuitem"
                onClick={() => handleExport(f.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm hover:bg-white/5"
              >
                <f.icon className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="font-semibold text-gray-200">{f.label}</span>
                <span className="me-auto text-xs text-gray-500">{f.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
