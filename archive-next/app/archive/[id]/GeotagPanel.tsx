"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, ExternalLink, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
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
    if (!response.ok) throw new Error(response.error || "تعذر حفظ الموقع.");
    onRecordUpdate(updated);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const parsed = parseCoordinate(coords);
    if (!parsed) {
      setError('إحداثيات غير صالحة. استخدم صيغة "خط العرض، خط الطول" (خط العرض بين ٩٠- و٩٠، خط الطول بين ١٨٠- و١٨٠).');
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
      setError(cause instanceof Error ? cause.message : "تعذر حفظ الموقع.");
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
      setError(cause instanceof Error ? cause.message : "تعذر إزالة الموقع.");
    } finally {
      setBusy(false);
    }
  }

  const osmLinks = location ? buildOsmLinks(location) : null;

  return (
    <article className="panel geotag-panel" aria-labelledby="geotag-title">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2 id="geotag-title">الموقع الجغرافي</h2>
          <p className="helper-text">إحداثيات GPS وربط السجل مكانياً بسجلات قريبة.</p>
        </div>
        {location ? <span className="badge">مسجّل</span> : null}
      </div>

      {mode === "edit" ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            اسم المكان
            <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="مثال: عمّان، الأردن" />
          </label>
          <label>
            الإحداثيات
            <input value={coords} onChange={(event) => setCoords(event.target.value)} dir="ltr" placeholder="31.9539, 35.9106" />
          </label>
          <div className="button-row">
            <button type="submit" className="button button-primary button-sm" disabled={busy}>
              {busy ? "جار الحفظ..." : "حفظ الموقع"}
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
              إلغاء
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
              <strong>{location.place || "بدون اسم مكان"}</strong>
              <small dir="ltr">{formatCoordinates(location)}</small>
            </span>
          </div>
          <iframe
            className="geotag-map"
            src={osmLinks.embedUrl}
            title={`خريطة موقع ${record.title || record.id}`}
            loading="lazy"
          />
          <div className="button-row">
            <a className="button button-secondary button-sm" href={osmLinks.viewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} aria-hidden="true" /> فتح في OpenStreetMap
            </a>
            <button type="button" className="button button-secondary button-sm" onClick={startEdit}>
              <Pencil size={14} aria-hidden="true" /> تعديل
            </button>
            <button type="button" className="button button-secondary button-sm" disabled={busy} onClick={() => void handleRemove()}>
              <Trash2 size={14} aria-hidden="true" /> إزالة الموقع
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
          title="لا يوجد موقع جغرافي مسجل"
          description="أضف إحداثيات لهذا السجل لعرضه على الخريطة وربطه بسجلات قريبة."
          actions={
            <button type="button" className="button button-primary button-sm" onClick={startEdit}>
              إضافة موقع
            </button>
          }
        />
      ) : null}

      {location ? (
        <section className="geotag-nearby" aria-labelledby="geotag-nearby-title">
          <h3 id="geotag-nearby-title">سجلات قريبة</h3>
          {nearbyState.status === "loading" ? (
            <p className="form-status" role="status" aria-live="polite" aria-busy="true">
              <Loader2 className="status-refresh-icon is-spinning" size={16} aria-hidden="true" />
              جار البحث عن سجلات قريبة...
            </p>
          ) : null}
          {nearbyState.status === "error" ? (
            <p className="form-status status-error" role="alert">
              <CircleAlert size={15} aria-hidden="true" /> تعذر تحميل السجلات القريبة: {nearbyState.message}
            </p>
          ) : null}
          {nearbyState.status === "ready" && nearbyState.items.length === 0 ? (
            <p className="helper-text">لا توجد سجلات أخرى تحمل موقعاً جغرافياً بعد.</p>
          ) : null}
          {nearbyState.status === "ready" && nearbyState.items.length > 0 ? (
            <ul className="geotag-nearby__list">
              {nearbyState.items.map(({ record: nearbyRecordItem, distanceKm }) => (
                <li key={nearbyRecordItem.id}>
                  <Link href={`/archive/${encodeURIComponent(nearbyRecordItem.id)}`}>
                    {nearbyRecordItem.title || nearbyRecordItem.id}
                  </Link>
                  <span className="badge">{formatDistanceKm(distanceKm)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
