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
          setState({ status: "error", message: response.error || "تعذر تحميل السجلات." });
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
  }, [api]);

  return (
    <AppShell subtitle="المكتبة" navLabel="الخريطة" contentClassName="map-page-content">
      <PageToolbar
        eyebrow={<span className="badge">Library</span>}
        title="الخريطة"
        description="كل السجلات ذات الموقع الجغرافي المسجَّل على خريطة واحدة."
        meta={state.status === "ready" ? <span className="badge">{state.points.length} سجل موقَّع</span> : null}
      />

      {state.status === "loading" ? <Skeleton className="map-page-skeleton" /> : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <strong>تعذر تحميل الخريطة</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {state.status === "ready" && state.points.length === 0 ? (
        <EmptyState
          icon={<MapPin size={22} aria-hidden="true" />}
          title="لا توجد سجلات موقَّعة جغرافياً بعد"
          description="أضف موقعاً جغرافياً لسجل من صفحة تفاصيله ليظهر هنا."
        />
      ) : null}

      {state.status === "ready" && state.points.length > 0 ? (
        <div className="map-page-layout">
          {capped ? (
            <p className="helper-text" role="status">
              عُرضت أول {state.points.length} سجلاً موقَّعاً فقط (حد أمان الصفحات)؛ قد توجد سجلات إضافية لم تُحمَّل.
            </p>
          ) : null}
          <GeoMap
            points={state.points}
            onSelect={(recordId) => {
              window.location.href = `/archive/${encodeURIComponent(recordId)}`;
            }}
          />
          <ul className="map-page-list" aria-label="قائمة السجلات الموقَّعة">
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
                  <ExternalLink size={13} aria-hidden="true" /> فتح في OpenStreetMap
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppShell>
  );
}
