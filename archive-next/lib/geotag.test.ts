import { describe, expect, it } from "vitest";
import type { ArchiveRecord } from "./archive-api";
import {
  buildOsmLinks,
  formatCoordinates,
  formatDistanceKm,
  geoTaggedRecords,
  getRecordLocation,
  haversineDistanceKm,
  nearbyRecords,
  parseCoordinate
} from "./geotag";

function record(overrides: Partial<ArchiveRecord> & Pick<ArchiveRecord, "id">): ArchiveRecord {
  return {
    title: overrides.id,
    ...overrides
  };
}

describe("parseCoordinate", () => {
  it("parses a pasted 'lat, lng' pair", () => {
    expect(parseCoordinate("31.9539, 35.9106")).toEqual({ lat: 31.9539, lng: 35.9106 });
  });

  it("parses separate lat/lng strings", () => {
    expect(parseCoordinate("31.9539", "35.9106")).toEqual({ lat: 31.9539, lng: 35.9106 });
  });

  it("parses a pasted pair separated by whitespace", () => {
    expect(parseCoordinate("31.9539 35.9106")).toEqual({ lat: 31.9539, lng: 35.9106 });
  });

  it("rejects an empty string", () => {
    expect(parseCoordinate("")).toBeNull();
  });

  it("rejects a single lat with no lng provided", () => {
    expect(parseCoordinate("31.9539")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseCoordinate("abc, def")).toBeNull();
  });

  it("rejects out-of-range latitude", () => {
    expect(parseCoordinate("91, 35")).toBeNull();
    expect(parseCoordinate("-91, 35")).toBeNull();
  });

  it("rejects out-of-range longitude", () => {
    expect(parseCoordinate("31, 181")).toBeNull();
    expect(parseCoordinate("31, -181")).toBeNull();
  });

  it("accepts boundary values", () => {
    expect(parseCoordinate("90, 180")).toEqual({ lat: 90, lng: 180 });
    expect(parseCoordinate("-90, -180")).toEqual({ lat: -90, lng: -180 });
  });
});

describe("formatCoordinates", () => {
  it("formats lat/lng with degree markers and 4 decimals by default", () => {
    expect(formatCoordinates({ lat: 31.9539, lng: 35.9106 })).toBe("31.9539°, 35.9106°");
  });
});

describe("formatDistanceKm", () => {
  it("formats short distances with one decimal in Arabic digits", () => {
    expect(formatDistanceKm(3.24)).toBe("٣٫٢ كم");
  });

  it("formats long distances rounded to whole km", () => {
    expect(formatDistanceKm(123.6)).toBe("١٢٤ كم");
  });
});

describe("buildOsmLinks", () => {
  it("builds a view URL and an embed URL containing the coordinates", () => {
    const links = buildOsmLinks({ lat: 31.9539, lng: 35.9106 });
    expect(links.viewUrl).toContain("mlat=31.9539");
    expect(links.viewUrl).toContain("mlon=35.9106");
    expect(links.embedUrl).toContain("marker=31.9539%2C35.9106");
    expect(links.embedUrl).toContain("openstreetmap.org/export/embed.html");
  });
});

describe("haversineDistanceKm", () => {
  it("returns ~0 for identical points", () => {
    const point = { lat: 31.9539, lng: 35.9106 };
    expect(haversineDistanceKm(point, point)).toBeCloseTo(0, 5);
  });

  it("returns ~111.2km for one degree of latitude at the equator", () => {
    const distance = haversineDistanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("matches a known great-circle distance (Amman to Cairo) within tolerance", () => {
    const amman = { lat: 31.9539, lng: 35.9106 };
    const cairo = { lat: 30.0444, lng: 31.2357 };
    const distance = haversineDistanceKm(amman, cairo);
    expect(distance).toBeGreaterThan(480);
    expect(distance).toBeLessThan(510);
  });
});

describe("getRecordLocation", () => {
  it("reads a valid location from record.metadata.location", () => {
    const withLocation = record({ id: "r1", metadata: { location: { lat: 31.9539, lng: 35.9106, place: "عمّان" } } });
    expect(getRecordLocation(withLocation)).toEqual({ lat: 31.9539, lng: 35.9106, place: "عمّان" });
  });

  it("returns null when metadata is missing", () => {
    expect(getRecordLocation(record({ id: "r1" }))).toBeNull();
  });

  it("returns null when location has non-numeric coordinates", () => {
    const bad = record({ id: "r1", metadata: { location: { lat: "x", lng: 35 } } });
    expect(getRecordLocation(bad)).toBeNull();
  });

  it("returns null when location coordinates are out of range", () => {
    const bad = record({ id: "r1", metadata: { location: { lat: 999, lng: 35 } } });
    expect(getRecordLocation(bad)).toBeNull();
  });

  it("omits place when it is not a non-empty string", () => {
    const noPlace = record({ id: "r1", metadata: { location: { lat: 1, lng: 2, place: "  " } } });
    expect(getRecordLocation(noPlace)).toEqual({ lat: 1, lng: 2 });
  });
});

describe("nearbyRecords", () => {
  const origin = { lat: 31.9539, lng: 35.9106 };

  it("sorts results by ascending distance", () => {
    const far = record({ id: "far", metadata: { location: { lat: 30.0444, lng: 31.2357 } } });
    const near = record({ id: "near", metadata: { location: { lat: 31.95, lng: 35.91 } } });
    const results = nearbyRecords([far, near], origin, 10000, 5);
    expect(results.map((entry) => entry.record.id)).toEqual(["near", "far"]);
  });

  it("limits the number of results returned", () => {
    const records = Array.from({ length: 10 }, (_, index) =>
      record({ id: `r${index}`, metadata: { location: { lat: 31.9539 + index * 0.001, lng: 35.9106 } } })
    );
    const results = nearbyRecords(records, origin, 10000, 3);
    expect(results).toHaveLength(3);
  });

  it("excludes the origin record by id", () => {
    const self = record({ id: "self", metadata: { location: origin } });
    const other = record({ id: "other", metadata: { location: { lat: 31.955, lng: 35.912 } } });
    const results = nearbyRecords([self, other], origin, 10000, 5, "self");
    expect(results.map((entry) => entry.record.id)).toEqual(["other"]);
  });

  it("filters out records beyond the given radius", () => {
    const near = record({ id: "near", metadata: { location: { lat: 31.955, lng: 35.912 } } });
    const far = record({ id: "far", metadata: { location: { lat: 30.0444, lng: 31.2357 } } });
    const results = nearbyRecords([near, far], origin, 5, 5);
    expect(results.map((entry) => entry.record.id)).toEqual(["near"]);
  });

  it("ignores records without a valid location", () => {
    const noLocation = record({ id: "no-location" });
    const results = nearbyRecords([noLocation], origin, 10000, 5);
    expect(results).toEqual([]);
  });
});

describe("geoTaggedRecords", () => {
  it("pairs each record carrying a valid location with that location", () => {
    const located = record({ id: "r1", metadata: { location: { lat: 31.9539, lng: 35.9106, place: "عمّان" } } });
    const unlocated = record({ id: "r2" });
    expect(geoTaggedRecords([located, unlocated])).toEqual([
      { record: located, location: { lat: 31.9539, lng: 35.9106, place: "عمّان" } }
    ]);
  });

  it("returns an empty array when no record has a valid location", () => {
    expect(geoTaggedRecords([record({ id: "r1" })])).toEqual([]);
  });

  it("preserves input order", () => {
    const first = record({ id: "first", metadata: { location: { lat: 1, lng: 1 } } });
    const second = record({ id: "second", metadata: { location: { lat: 2, lng: 2 } } });
    expect(geoTaggedRecords([second, first]).map((entry) => entry.record.id)).toEqual(["second", "first"]);
  });
});
