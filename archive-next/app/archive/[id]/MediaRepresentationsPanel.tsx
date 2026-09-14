"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, CopyCheck, Loader2, RefreshCw } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { createArchiveApiClient, type ArchiveRecord, type MediaRepresentation, type MediaRepresentationType } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type State = { status: "loading" } | { status: "ready"; representations: MediaRepresentation[] } | { status: "error"; message: string };

function labelFor(type: MediaRepresentationType, labels: Record<MediaRepresentationType, string>): string {
  return labels[type];
}

export default function MediaRepresentationsPanel({ record }: Readonly<{ record: ArchiveRecord }>) {
  const { t } = useLocale();
  const copy = t.pages.mediaRepresentations;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const response = await api.mediaRepresentations(record.id, { store: record.store });
    if (!response.ok) return setState({ status: "error", message: response.error });
    setState({ status: "ready", representations: response.representations });
  }, [api, record.id, record.store]);

  useEffect(() => { void load(); }, [load]);

  return (
    <article className="panel media-representations" aria-labelledby="media-representations-title">
      <div className="panel-section-header panel-title-row">
        <div><h2 id="media-representations-title">{copy.title}</h2><p className="helper-text">{copy.description}</p></div>
        {state.status === "ready" ? <span className="badge">{copy.count.replace("{count}", String(state.representations.length))}</span> : null}
      </div>
      {state.status === "loading" ? <p className="form-status" role="status" aria-live="polite" aria-busy="true"><Loader2 className="status-refresh-icon is-spinning" size={16} aria-hidden="true" />{copy.loading}</p> : null}
      {state.status === "error" ? <div className="form-status status-error" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{copy.error.replace("{message}", state.message)}</span><button type="button" className="button button-secondary button-sm" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" />{copy.retry}</button></div> : null}
      {state.status === "ready" && state.representations.length === 0 ? <EmptyState icon={<CopyCheck size={22} />} title={copy.emptyTitle} description={copy.emptyDescription} /> : null}
      {state.status === "ready" && state.representations.length > 0 ? <ul className="media-inspections__findings" aria-label={copy.listAriaLabel}>{state.representations.map((representation) => <li key={representation.id}><strong>{labelFor(representation.type, copy.types)}</strong><span className={`badge ${representation.status === "ready" ? "badge-success" : representation.status === "failed" ? "badge-error" : "badge-warning"}`}>{copy.status[representation.status]}</span><code dir="ltr">{representation.versionToken}</code></li>)}</ul> : null}
    </article>
  );
}
