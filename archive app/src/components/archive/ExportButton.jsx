import { useState } from "react";
import { Download, ChevronDown, FileText, Table, Archive } from "lucide-react";
import { useAppStore } from "../../stores/index.js";
import { useLoading } from "../../hooks/useLoading.js";

const FORMATS = [
  { id: "csv", label: "CSV", icon: FileText, desc: "مناسب للجداول" },
  { id: "xlsx", label: "Excel", icon: Table, desc: "مناسب لـ Microsoft Excel" },
  { id: "zip", label: "JSON", icon: Archive, desc: "بيانات كاملة" },
];

export function ExportButton({ selectedIds = [] }) {
  const [open, setOpen] = useState(false);
  const { anyLoading, withLoading } = useLoading();
  const showToast = useAppStore((s) => s.showToast);

  async function handleExport(format) {
    setOpen(false);
    await withLoading("export", async () => {
      const body = { format, store: "videoItems" };
      if (selectedIds.length > 0) body.ids = selectedIds;

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        showToast?.("فشل التصدير", "error");
        throw new Error("فشل التصدير");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match?.[1] ?? `archive-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast?.("تم التصدير بنجاح", "success");
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
        className="va-tool-button inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-gray-950/35 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/5 hover:text-white disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        <span>{selectedIds.length > 0 ? `تصدير (${selectedIds.length})` : "تصدير"}</span>
        <ChevronDown className="h-3 w-3" />
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
            className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 va-surface-muted shadow-lg"
          >
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="menuitem"
                onClick={() => handleExport(f.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-sm hover:bg-white/5"
              >
                <f.icon className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="font-semibold text-gray-200">{f.label}</span>
                <span className="mr-auto text-xs text-gray-500">{f.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
