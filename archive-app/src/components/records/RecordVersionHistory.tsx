import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAppStore } from "../../stores/index.js";
import { VersionTimeline } from "../versions/VersionTimeline.jsx";
import { RestoreVersionDialog } from "../versions/RestoreVersionDialog.jsx";

/**
 * Renders the server-side version history for a record.
 * Fetches from GET /api/records/:recordId/versions?store=<store> and lets
 * authorised users restore any previous version via POST
 * /api/records/:recordId/restore/:version?store=<store>.
 *
 * @param {{
 *   recordId: string,
 *   store?: string,
 *   currentSnapshot?: object,
 *   currentVersion?: number,
 *   onRestored?: () => void,
 * }} props
 */
export function RecordVersionHistory({
  recordId,
  store = "videoItems",
  currentSnapshot,
  currentVersion,
  onRestored,
}: any) {
  const [versions, setVersions]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedVersion, setSelected]    = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring]         = useState(false);
  const showToast = useAppStore((s: any) => s.showToast);

  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/records/${encodeURIComponent(recordId)}/versions?store=${encodeURIComponent(store)}`,
      { credentials: "include" }
    )
      .then((r: any) => r.json())
      .then((d: any) => { if (!cancelled) setVersions(d.versions ?? []); })
      .catch(() => { if (!cancelled) setVersions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [recordId, store]);

  async function confirmRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/records/${encodeURIComponent(recordId)}/restore/${(restoreTarget as any).version}?store=${encodeURIComponent(store)}`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "فشل الاستعادة");
      }
      showToast?.(`تمت استعادة النسخة ${(restoreTarget as any).version}`, "success");
      setRestoreTarget(null);
      onRestored?.();
    } catch (err: any) {
      showToast?.(err.message || "فشل الاستعادة", "error");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">جاري تحميل السجل التاريخي...</span>
      </div>
    );
  }

  return (
    <>
      <VersionTimeline
        versions={versions}
        selectedVersion={selectedVersion}
        currentVersion={currentVersion}
        onSelect={(v: any) => setSelected(v.version === selectedVersion ? null : v.version)}
        onRestore={(v: any) => setRestoreTarget(v)}
      />

      {restoreTarget && (
        <RestoreVersionDialog
          version={restoreTarget}
          currentSnapshot={currentSnapshot ?? null}
          onConfirm={confirmRestore}
          onClose={() => { if (!restoring) setRestoreTarget(null); }}
        />
      )}
    </>
  );
}

export default RecordVersionHistory;
