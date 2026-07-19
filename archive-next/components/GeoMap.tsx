"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
// Self-hosted via the bundler (not a CDN): this app installs offline/on
// intranets (V1-210D/V1-211D), where a public CDN fetch would silently fail.
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { GeoTaggedRecord } from "@/lib/geotag";

/**
 * V1-703: imperative Leaflet map, not react-leaflet — one fewer dependency,
 * and this component is already dynamically imported with ssr:false by its
 * only caller (Leaflet touches `window`/DOM layout at import time).
 */
export default function GeoMap({
  points,
  onSelect
}: Readonly<{
  points: readonly GeoTaggedRecord[];
  onSelect: (recordId: string) => void;
}>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let map: import("leaflet").Map | undefined;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !containerRef.current) return;

      // Leaflet's default marker icon resolves image paths relative to its
      // own CSS file, which breaks under a bundler; repoint it at the
      // bundler-resolved (self-hosted) copies imported above.
      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x.src,
        iconUrl: markerIcon.src,
        shadowUrl: markerShadow.src
      });

      map = L.map(containerRef.current, { attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);

      const markers = points.map(({ record, location }) => {
        const marker = L.marker([location.lat, location.lng]).addTo(map!);
        marker.bindTooltip(location.place ? `${record.title || record.id} — ${location.place}` : record.title || record.id);
        marker.on("click", () => onSelectRef.current(record.id));
        return marker;
      });

      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 12 });
      } else {
        map.setView([20, 0], 2);
      }
    })();

    return () => {
      disposed = true;
      try {
        map?.remove();
      } catch {
        // Leaflet's internal marker/icon teardown can throw when the
        // container was already detached (fast re-render, React Strict
        // Mode's double-invoke in dev, or page navigation) — the map
        // instance is discarded either way, so this is safe to ignore.
      }
    };
    // points identity changes each fetch; re-mounting the map per fetch is
    // acceptable here (an admin-facing view, not a hot path).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  return <div ref={containerRef} className="geo-map" role="img" aria-label="خريطة السجلات ذات الموقع الجغرافي" />;
}
