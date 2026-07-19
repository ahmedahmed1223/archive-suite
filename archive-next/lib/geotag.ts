import type { ArchiveRecord } from "./archive-api";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoLocation extends GeoPoint {
  place?: string;
}

export interface OsmLinks {
  viewUrl: string;
  embedUrl: string;
}

export interface NearbyRecordResult {
  record: ArchiveRecord;
  distanceKm: number;
}

export interface GeoTaggedRecord {
  record: ArchiveRecord;
  location: GeoLocation;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Parses a coordinate pair either from one pasted string ("31.9539, 35.9106")
 * or from two separate lat/lng strings. Rejects empty input, non-numeric
 * input, and values outside the valid lat (+/-90) / lng (+/-180) range.
 */
export function parseCoordinate(latInput: string, lngInput?: string): GeoPoint | null {
  let latRaw: string;
  let lngRaw: string;

  if (lngInput === undefined) {
    const parts = latInput.split(/[,;\s]+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length !== 2) return null;
    [latRaw, lngRaw] = parts;
  } else {
    latRaw = latInput.trim();
    lngRaw = lngInput.trim();
  }

  if (!latRaw || !lngRaw) return null;

  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { lat, lng };
}

export function formatCoordinates(location: GeoPoint, digits = 4): string {
  return `${location.lat.toFixed(digits)}°, ${location.lng.toFixed(digits)}°`;
}

export function formatDistanceKm(km: number): string {
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `${rounded.toLocaleString("ar-SA", { maximumFractionDigits: 1 })} كم`;
}

export function buildOsmLinks(location: GeoPoint, spanDegrees = 0.01): OsmLinks {
  const { lat, lng } = location;
  const viewUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
  const bbox = [lng - spanDegrees, lat - spanDegrees, lng + spanDegrees, lat + spanDegrees].join("%2C");
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  return { viewUrl, embedUrl };
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** Reads record.metadata.location = { lat, lng, place? }, validating range. */
export function getRecordLocation(record: ArchiveRecord): GeoLocation | null {
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== "object") return null;

  const location = metadata["location"];
  if (!location || typeof location !== "object") return null;

  const lat = (location as Record<string, unknown>)["lat"];
  const lng = (location as Record<string, unknown>)["lng"];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const place = (location as Record<string, unknown>)["place"];
  return { lat, lng, ...(typeof place === "string" && place.trim() ? { place } : {}) };
}

/** Nearest records (excluding excludeId) with a valid location, within radiusKm, closest first. */
export function nearbyRecords(
  records: ArchiveRecord[],
  origin: GeoPoint,
  radiusKm: number,
  limit: number,
  excludeId?: string
): NearbyRecordResult[] {
  const results: NearbyRecordResult[] = [];

  for (const record of records) {
    if (record.id === excludeId) continue;
    const location = getRecordLocation(record);
    if (!location) continue;
    const distanceKm = haversineDistanceKm(origin, location);
    if (distanceKm > radiusKm) continue;
    results.push({ record, distanceKm });
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results.slice(0, limit);
}

/** V1-703: every record carrying a valid location, paired with it, input order preserved. */
export function geoTaggedRecords(records: ArchiveRecord[]): GeoTaggedRecord[] {
  const results: GeoTaggedRecord[] = [];

  for (const record of records) {
    const location = getRecordLocation(record);
    if (location) results.push({ record, location });
  }

  return results;
}
