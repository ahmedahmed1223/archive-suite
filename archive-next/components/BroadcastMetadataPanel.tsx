"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type BroadcastMetadata } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface BroadcastMetadataPanelProps {
  recordId: string;
}

/**
 * MOS/MXF broadcast metadata surface. Shows an explicit "configuration
 * required" state when no MOS/MXF integration is configured server-side,
 * rather than a broken or empty form.
 */
export default function BroadcastMetadataPanel({ recordId }: BroadcastMetadataPanelProps) {
  const { t, locale } = useLocale();
  const copy = t.pages.archiveDetail.broadcastMetadata;
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
    <article className="panel broadcast-metadata-panel" aria-label={copy.ariaLabel}>
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge">{configured ? copy.configured : copy.requiresSetup}</span>
      </div>

      {loading ? (
        <p className="helper-text">{copy.loading}</p>
      ) : !configured ? (
        <div className="state-banner" role="status">
          <strong>{copy.noIntegrationTitle}</strong>
          <span className="helper-text">
            {copy.noIntegrationDescription}
          </span>
        </div>
      ) : (
        <>
          {error ? <p className="form-status status-error" role="alert">{error}</p> : null}
          <div className="button-row">
            <label className="helper-text">
              {copy.mosObjectId}
              <input value={mosObjectId} onChange={(event) => setMosObjectId(event.target.value)} aria-label={copy.mosObjectId} />
            </label>
            <label className="helper-text">
              {copy.mosProgramId}
              <input value={mosProgramId} onChange={(event) => setMosProgramId(event.target.value)} aria-label={copy.mosProgramId} />
            </label>
          </div>
          <div className="button-row">
            <label className="helper-text">
              {copy.mxfUmid}
              <input value={mxfUmid} onChange={(event) => setMxfUmid(event.target.value)} aria-label={copy.mxfUmid} />
            </label>
            <label className="helper-text">
              {copy.mxfFormat}
              <input value={mxfFormat} onChange={(event) => setMxfFormat(event.target.value)} aria-label={copy.mxfFormat} />
            </label>
          </div>
          <div className="button-row">
            <button type="button" className="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? copy.saving : copy.save}
            </button>
            {metadata?.updatedAt ? <span className="helper-text">{copy.lastUpdated.replace("{date}", new Date(metadata.updatedAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA"))}</span> : null}
          </div>
        </>
      )}
    </article>
  );
}
