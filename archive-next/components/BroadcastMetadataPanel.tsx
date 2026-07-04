"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type BroadcastMetadata } from "@/lib/archive-api";

interface BroadcastMetadataPanelProps {
  recordId: string;
}

/**
 * MOS/MXF broadcast metadata surface. Shows an explicit "configuration
 * required" state when no MOS/MXF integration is configured server-side,
 * rather than a broken or empty form.
 */
export default function BroadcastMetadataPanel({ recordId }: BroadcastMetadataPanelProps) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [metadata, setMetadata] = useState<BroadcastMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mosObjectId, setMosObjectId] = useState("");
  const [mosProgramId, setMosProgramId] = useState("");
  const [mxfUmid, setMxfUmid] = useState("");
  const [mxfFormat, setMxfFormat] = useState("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      const response = await api.broadcastMetadata(recordId);
      if (cancelled) return;

      if (response.ok) {
        setConfigured(response.configured);
        setMetadata(response.metadata);
        setMosObjectId(response.metadata?.mosObjectId ?? "");
        setMosProgramId(response.metadata?.mosProgramId ?? "");
        setMxfUmid(response.metadata?.mxfUmid ?? "");
        setMxfFormat(response.metadata?.mxfFormat ?? "");
      } else {
        setError(response.error);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [api, recordId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const response = await api.updateBroadcastMetadata(recordId, {
      mosObjectId: mosObjectId.trim() || null,
      mosProgramId: mosProgramId.trim() || null,
      mxfUmid: mxfUmid.trim() || null,
      mxfFormat: mxfFormat.trim() || null,
    });

    if (response.ok) {
      setMetadata(response.metadata);
    } else {
      setError(response.error);
    }
    setSaving(false);
  }

  return (
    <article className="panel broadcast-metadata-panel" aria-label="بيانات البث MOS/MXF">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>بيانات البث (MOS/MXF)</h2>
          <p className="helper-text">معرّفات MOS ومعلومات حزمة MXF المرتبطة بهذه المادة.</p>
        </div>
        <span className="badge">{configured ? "مهيّأ" : "يتطلب إعداد"}</span>
      </div>

      {loading ? (
        <p className="helper-text">جارٍ التحميل...</p>
      ) : !configured ? (
        <div className="state-banner" role="status">
          <strong>لا يوجد تكامل بث مُهيّأ</strong>
          <span className="helper-text">
            حدد MOS_ENDPOINT أو MXF_ENDPOINT في إعدادات الخادم لتفعيل بيانات البث لهذا السجل.
          </span>
        </div>
      ) : (
        <>
          {error ? <p className="form-status status-error" role="alert">{error}</p> : null}
          <div className="button-row">
            <label className="helper-text">
              MOS Object ID
              <input value={mosObjectId} onChange={(event) => setMosObjectId(event.target.value)} aria-label="MOS Object ID" />
            </label>
            <label className="helper-text">
              MOS Program ID
              <input value={mosProgramId} onChange={(event) => setMosProgramId(event.target.value)} aria-label="MOS Program ID" />
            </label>
          </div>
          <div className="button-row">
            <label className="helper-text">
              MXF UMID
              <input value={mxfUmid} onChange={(event) => setMxfUmid(event.target.value)} aria-label="MXF UMID" />
            </label>
            <label className="helper-text">
              MXF Format
              <input value={mxfFormat} onChange={(event) => setMxfFormat(event.target.value)} aria-label="MXF Format" />
            </label>
          </div>
          <div className="button-row">
            <button type="button" className="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ بيانات البث"}
            </button>
            {metadata?.updatedAt ? <span className="helper-text">آخر تحديث: {new Date(metadata.updatedAt).toLocaleString("ar")}</span> : null}
          </div>
        </>
      )}
    </article>
  );
}
