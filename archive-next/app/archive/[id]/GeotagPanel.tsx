"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, ExternalLink, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import {
  buildOsmLinks,
  formatCoordinates,
  formatDistanceKm,
  getRecordLocation,
  nearbyRecords,
  parseCoordinate,
  type NearbyRecordResult
} from "@/lib/geotag";

type NearbyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; items: NearbyRecordResult[] }
  | { status: "error"; message: string };

export default function GeotagPanel({
  record,
  onRecordUpdate
}: Readonly<{
  record: ArchiveRecord;
  onRecordUpdate: (record: ArchiveRecord) => void;
}>) {
  const { t, locale } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const location = getRecordLocation(record);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [place, setPlace] = useState("");
  const [coords, setCoords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nearbyState, setNearbyState] = useState<NearbyState>({ status: "idle" });

  useEffect(() => {
    if (!location) {
      setNearbyState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setNearbyState({ status: "loading" });

    void (async () => {
      const response = await api.records({ store: record.store || "archive-items", limit: 200 });
      if (cancelled) return;
      if (!response.ok) {
        setNearbyState({ status: "error", message: response.error });
        return;
      }
      const items = nearbyRecords(response.records, location, Number.POSITIVE_INFINITY, 5, record.id);
      setNearbyState({ status: "ready", items });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- location is derived from record; lat/lng cover it
  }, [api, record.id, record.store, location?.lat, location?.lng]);

  function startEdit() {
    setPlace(location?.place ?? "");
    setCoords(location ? `${location.lat}, ${location.lng}` : "");
    setError("");
    setMode("edit");
  }

  async function persist(updated: ArchiveRecord) {
    const store = record.store || "archive-items";
    const response = await api.bulkRecords({ store, records: [updated] });
    if (!response.ok) throw new Error(response.error || t.pages.geotagPanel.saveLocationError);
    onRecordUpdate(updated);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const parsed = parseCoordinate(coords);
    if (!parsed) {
      setError(t.pages.geotagPanel.invalidCoordinates);
      return;
    }

    setBusy(true);
    setError("");
    try {
      await persist({
        ...record,
        metadata: {
          ...(record.metadata ?? {}),
          location: { lat: parsed.lat, lng: parsed.lng, ...(place.trim() ? { place: place.trim() } : {}) }
        },
        updatedAt: new Date().toISOString()
      });
      setMode("view");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.pages.geotagPanel.saveLocationError);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const metadata = Object.fromEntries(Object.entries(record.metadata ?? {}).filter(([key]) => key !== "location"));
      await persist({ ...record, metadata, updatedAt: new Date().toISOString() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.pages.geotagPanel.removeLocationError);
    } finally {
      setBusy(false);
    }
  }

  const osmLinks = location ? buildOsmLinks(location) : null;

  return (
    <article className="panel geotag-panel" aria-labelledby="geotag-title">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2 id="geotag-title">{t.pages.geotagPanel.title}</h2>
          <p className="helper-text">{t.pages.geotagPanel.description}</p>
        </div>
        {location ? <span className="badge">{t.pages.geotagPanel.registeredBadge}</span> : null}
      </div>

      {mode === "edit" ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            {t.pages.geotagPanel.placeLabel}
            <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder={t.pages.geotagPanel.placePlaceholder} />
          </label>
          <label>
            {t.pages.geotagPanel.coordinatesLabel}
            <input value={coords} onChange={(event) => setCoords(event.target.value)} dir="ltr" placeholder="31.9539, 35.9106" />
          </label>
          <div className="button-row">
            <button type="submit" className="button button-primary button-sm" disabled={busy}>
              {busy ? t.pages.geotagPanel.savingButton : t.pages.geotagPanel.saveButton}
            </button>
            <button
              type="button"
              className="button button-secondary button-sm"
              disabled={busy}
              onClick={() => {
                setMode("view");
                setError("");
              }}
            >
              {t.pages.geotagPanel.cancelButton}
            </button>
          </div>
          {error ? (
            <p className="form-status status-error" role="alert">
              <CircleAlert size={15} aria-hidden="true" /> {error}
            </p>
          ) : null}
        </form>
      ) : null}

      {mode === "view" && location && osmLinks ? (
        <div className="geotag-view">
          <div className="geotag-view__meta">
            <MapPin size={16} aria-hidden="true" />
            <span>
              <strong>{location.place || t.pages.geotagPanel.unnamedPlace}</strong>
              <small dir="ltr">{formatCoordinates(location)}</small>
            </span>
          </div>
          <iframe
            className="geotag-map"
            src={osmLinks.embedUrl}
            title={t.pages.geotagPanel.mapTitle.replace("{label}", record.title || record.id)}
            loading="lazy"
          />
          <div className="button-row">
            <a className="button button-secondary button-sm" href={osmLinks.viewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} aria-hidden="true" /> {t.pages.geotagPanel.openInOsm}
            </a>
            <button type="button" className="button button-secondary button-sm" onClick={startEdit}>
              <Pencil size={14} aria-hidden="true" /> {t.pages.geotagPanel.editButton}
            </button>
            <button type="button" className="button button-secondary button-sm" disabled={busy} onClick={() => void handleRemove()}>
              <Trash2 size={14} aria-hidden="true" /> {t.pages.geotagPanel.removeButton}
            </button>
          </div>
          {error ? (
            <p className="form-status status-error" role="alert">
              <CircleAlert size={15} aria-hidden="true" /> {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "view" && !location ? (
        <EmptyState
          icon={<MapPin size={22} aria-hidden="true" />}
          title={t.pages.geotagPanel.emptyTitle}
          description={t.pages.geotagPanel.emptyDescription}
          actions={
            <button type="button" className="button button-primary button-sm" onClick={startEdit}>
              {t.pages.geotagPanel.addLocationButton}
            </button>
          }
        />
      ) : null}

      {location ? (
        <section className="geotag-nearby" aria-labelledby="geotag-nearby-title">
          <h3 id="geotag-nearby-title">{t.pages.geotagPanel.nearbyTitle}</h3>
          {nearbyState.status === "loading" ? (
            <p className="form-status" role="status" aria-live="polite" aria-busy="true">
              <Loader2 className="status-refresh-icon is-spinning" size={16} aria-hidden="true" />
              {t.pages.geotagPanel.nearbyLoading}
            </p>
          ) : null}
          {nearbyState.status === "error" ? (
            <p className="form-status status-error" role="alert">
              <CircleAlert size={15} aria-hidden="true" /> {t.pages.geotagPanel.nearbyError.replace("{message}", nearbyState.message)}
            </p>
          ) : null}
          {nearbyState.status === "ready" && nearbyState.items.length === 0 ? (
            <p className="helper-text">{t.pages.geotagPanel.nearbyEmpty}</p>
          ) : null}
          {nearbyState.status === "ready" && nearbyState.items.length > 0 ? (
            <ul className="geotag-nearby__list">
              {nearbyState.items.map(({ record: nearbyRecordItem, distanceKm }) => (
                <li key={nearbyRecordItem.id}>
                  <Link href={`/archive/${encodeURIComponent(nearbyRecordItem.id)}`}>
                    {nearbyRecordItem.title || nearbyRecordItem.id}
                  </Link>
                  <span className="badge">{formatDistanceKm(distanceKm, locale)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
