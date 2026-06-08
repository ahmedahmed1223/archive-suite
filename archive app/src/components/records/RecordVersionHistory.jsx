import { useState, useEffect } from "react";
import { History, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { useAppStore } from "../../stores/index.js";

function formatDate(iso) {
  return new Date(iso).toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Renders the server-side version history for a record.
 * Fetches from GET /api/records/:recordId/versions?store=<store> and lets
 * authorised users restore any previous version via POST
 * /api/records/:recordId/restore/:version?store=<store>.
 *
 * @param {{ recordId: string, store?: string, onRestored?: () => void }} props
 */
export function RecordVersionHistory({ recordId, store = "videoItems", onRestored }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [confirmVersion, setConfirmVersion] = useState(null);
  const showToast = useAppStore((s) => s.showToast);

  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/records/${encodeURIComponent(recordId)}/versions?store=${encodeURIComponent(store)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setVersions(d.versions ?? []); })
      .catch(() => { if (!cancelled) setVersions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [recordId, store]);

  async function handleRestore(version) {
    if (confirmVersion !== version) {
      setConfirmVersion(version);
      return;
    }
    setConfirmVersion(null);
    setRestoring(version);
    try {
      const res = await fetch(
        `/api/records/${encodeURIComponent(recordId)}/restore/${version}?store=${encodeURIComponent(store)}`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "فشل الاستعادة");
      }
      showToast?.(`تمت استعادة النسخة ${version}`, "success");
      onRestored?.();
    } catch (err) {
      showToast?.(err.message || "فشل الاستعادة", "error");
    } finally {
      setRestoring(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--va-text-muted,#6b7280)]">
        <Loader2 className="w-5 h-5 animate-spin ml-2 shrink-0" />
        <span>جاري تحميل السجل التاريخي...</span>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--va-text-muted,#6b7280)]">
        <History className="w-10 h-10 mb-3 opacity-30" />
        <p>لا توجد إصدارات سابقة</p>
        <p className="text-xs mt-1">ستظهر هنا عند كل تعديل على السجل</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <p className="text-sm text-[var(--va-text-muted,#6b7280)] mb-4">{versions.length} إصدار محفوظ</p>
      <ol className="space-y-2" aria-label="قائمة إصدارات السجل">
        {versions.map((v) => (
          <li
            key={String(v.id)}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/10 bg-gray-950/25 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">النسخة {v.version}</p>
                <p className="text-xs text-gray-500">{formatDate(v.createdAt)}</p>
                {v.userId && (
                  <p className="text-xs text-gray-600 truncate max-w-[12rem]">{v.userId}</p>
                )}
              </div>
            </div>
            {confirmVersion === v.version ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  متأكد؟
                </span>
                <button
                  type="button"
                  onClick={() => handleRestore(v.version)}
                  className="px-2 py-1 rounded text-xs bg-amber-600 hover:bg-amber-500 text-white"
                >
                  نعم
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmVersion(null)}
                  className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  لا
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleRestore(v.version)}
                disabled={restoring === v.version}
                aria-label={`استعادة النسخة ${v.version}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-xs text-gray-300 transition-colors disabled:opacity-50 shrink-0"
              >
                {restoring === v.version ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                استعادة
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default RecordVersionHistory;
