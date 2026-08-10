"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CircleAlert, ExternalLink, MapPin } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { Skeleton } from "@/components/ui/Skeleton";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { buildOsmLinks, formatCoordinates, geoTaggedRecords, type GeoTaggedRecord } from "@/lib/geotag";
import "./map.css";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Leaflet touches `window` at import time; ssr:false keeps it out of the
// server bundle entirely rather than guarding every internal call.
const GeoMap = dynamic(() => import("@/components/GeoMap"), { ssr: false });

type LoadState =
  | { status: "loading" }
  | { status: "ready"; points: GeoTaggedRecord[] }
  | { status: "error"; message: string };

/** Safety net against an unbounded archive, not a silent truncation — the UI reports it. */
const MAX_PAGES = 25;
const PAGE_LIMIT = 200;

export default function MapPage() {
  const { locale, t } = useLocale();
  const copy = locale === "en" ? { loadError: "Could not load records.", eyebrow: "Library", title: "Map", description: "All records with saved geographic locations on one map.", geotagged: "geotagged records", error: "Could not load the map", emptyTitle: "No geotagged records yet", emptyDescription: "Add a geographic location from a record’s details page to show it here.", capped: "Only the first {count} geotagged records are displayed due to the page safety limit; additional records may not have loaded.", list: "Geotagged records", openOsm: "Open in OpenStreetMap" } : { loadError: "تعذر تحميل السجلات.", eyebrow: "المكتبة", title: "الخريطة", description: "كل السجلات ذات الموقع الجغرافي المسجَّل على خريطة واحدة.", geotagged: "سجل موقَّع", error: "تعذر تحميل الخريطة", emptyTitle: "لا توجد سجلات موقَّعة جغرافياً بعد", emptyDescription: "أضف موقعاً جغرافياً لسجل من صفحة تفاصيله ليظهر هنا.", capped: "عُرضت أول {count} سجلاً موقَّعاً فقط (حد أمان الصفحات)؛ قد توجد سجلات إضافية لم تُحمَّل.", list: "قائمة السجلات الموقَّعة", openOsm: "فتح في OpenStreetMap" };
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [capped, setCapped] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setState({ status: "loading" });
      const records: ArchiveRecord[] = [];
      let cursor: string | undefined;
      let pages = 0;

      do {
        const response = await api.search({ store: undefined, cursor, limit: PAGE_LIMIT });
        if (cancelled) return;
        if (!response.ok) {
          setState({ status: "error", message: response.error || copy.loadError });
          return;
        }
        records.push(...response.records);
        cursor = response.nextCursor ?? undefined;
        pages += 1;
      } while (cursor && pages < MAX_PAGES);

      if (cancelled) return;
      setCapped(Boolean(cursor));
      setState({ status: "ready", points: geoTaggedRecords(records) });
    })();

    return () => {
      cancelled = true;
    };
  }, [api, copy.loadError]);

  return (
    <AppShell subtitle={t.pageTitles.library} navLabel={t.pageTitles.map} contentClassName="map-page-content">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={state.status === "ready" ? <span className="badge">{state.points.length} {copy.geotagged}</span> : null}
      />

      {state.status === "loading" ? <Skeleton className="map-page-skeleton" /> : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <strong>{copy.error}</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {state.status === "ready" && state.points.length === 0 ? (
        <EmptyState
          icon={<MapPin size={22} aria-hidden="true" />}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      ) : null}

      {state.status === "ready" && state.points.length > 0 ? (
        <div className="map-page-layout">
          {capped ? (
            <p className="helper-text" role="status">
              {copy.capped.replace("{count}", String(state.points.length))}
            </p>
          ) : null}
          <GeoMap
            points={state.points}
            onSelect={(recordId) => {
              window.location.href = `/archive/${encodeURIComponent(recordId)}`;
            }}
          />
          <ul className="map-page-list" aria-label={copy.list}>
            {state.points.map(({ record, location }) => (
              <li key={record.id}>
                <Link href={`/archive/${encodeURIComponent(record.id)}`}>{record.title || record.id}</Link>
                <span className="helper-text" dir="ltr">{formatCoordinates(location)}</span>
                <a
                  className="button button-secondary button-sm"
                  href={buildOsmLinks(location).viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={13} aria-hidden="true" /> {copy.openOsm}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppShell>
  );
}
