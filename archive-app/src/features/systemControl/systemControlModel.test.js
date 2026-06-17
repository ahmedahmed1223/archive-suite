import { describe, expect, test } from "vitest";
import {
  METRIC_LEVELS,
  OVERALL_STATES,
  METRIC_THRESHOLDS,
  classifyMetric,
  formatPercent,
  formatBytes,
  buildServiceList,
  deriveOverallState,
  buildSystemControlModel
} from "./systemControlModel.js";

describe("classifyMetric", () => {
  test("returns ok below the warn threshold", () => {
    expect(classifyMetric(50, METRIC_THRESHOLDS.cpu)).toBe(METRIC_LEVELS.OK);
  });

  test("returns warn at the warn threshold (inclusive)", () => {
    expect(classifyMetric(75, METRIC_THRESHOLDS.cpu)).toBe(METRIC_LEVELS.WARN);
  });

  test("returns crit at the crit threshold (inclusive)", () => {
    expect(classifyMetric(90, METRIC_THRESHOLDS.cpu)).toBe(METRIC_LEVELS.CRIT);
  });

  test("returns unknown for non-finite input", () => {
    expect(classifyMetric(null)).toBe(METRIC_LEVELS.UNKNOWN);
    expect(classifyMetric(undefined)).toBe(METRIC_LEVELS.UNKNOWN);
    expect(classifyMetric("not-a-number")).toBe(METRIC_LEVELS.UNKNOWN);
  });

  test("uses per-metric thresholds (memory crit at 92)", () => {
    expect(classifyMetric(91, METRIC_THRESHOLDS.memory)).toBe(METRIC_LEVELS.WARN);
    expect(classifyMetric(92, METRIC_THRESHOLDS.memory)).toBe(METRIC_LEVELS.CRIT);
  });
});

describe("formatPercent", () => {
  test("formats a normal value with a percent sign", () => {
    expect(formatPercent(42.34)).toBe("42.3%");
  });

  test("clamps values above 100", () => {
    expect(formatPercent(150)).toBe("100%");
  });

  test("clamps negative values to zero", () => {
    expect(formatPercent(-5)).toBe("0%");
  });

  test("returns dash for missing input", () => {
    expect(formatPercent(null)).toBe("—");
  });
});

describe("formatBytes", () => {
  test("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  test("formats kilobytes and megabytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
  });

  test("formats gigabytes with one decimal", () => {
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });

  test("returns dash for invalid input", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
  });
});

describe("buildServiceList", () => {
  test("returns empty array for non-array input", () => {
    expect(buildServiceList(undefined)).toEqual([]);
    expect(buildServiceList(null)).toEqual([]);
    expect(buildServiceList({})).toEqual([]);
  });

  test("normalizes mixed status keywords", () => {
    const list = buildServiceList([
      { id: "api", name: "API", status: "running" },
      { id: "queue", name: "Queue", status: "stopped" },
      { id: "ocr", name: "OCR", status: "weird" }
    ]);
    expect(list.map((s) => s.status)).toEqual(["up", "down", "unknown"]);
  });

  test("falls back to a generated id when none is given", () => {
    const list = buildServiceList([{ status: "ok" }]);
    expect(list[0].id).toBe("service-0");
    expect(list[0].status).toBe("up");
  });

  test("skips non-object entries", () => {
    const list = buildServiceList([null, "x", { id: "ok", status: "up" }]);
    expect(list).toHaveLength(1);
  });
});

describe("deriveOverallState", () => {
  test("down when server is explicitly not ok", () => {
    expect(deriveOverallState({ serverOk: false })).toBe(OVERALL_STATES.DOWN);
  });

  test("down when any service is down", () => {
    const state = deriveOverallState({
      services: [{ status: "up" }, { status: "down" }],
      serverOk: true
    });
    expect(state).toBe(OVERALL_STATES.DOWN);
  });

  test("down when any metric is critical", () => {
    const state = deriveOverallState({
      metrics: [{ level: METRIC_LEVELS.CRIT }],
      serverOk: true
    });
    expect(state).toBe(OVERALL_STATES.DOWN);
  });

  test("degraded when a metric is warning", () => {
    const state = deriveOverallState({
      metrics: [{ level: METRIC_LEVELS.WARN }],
      services: [{ status: "up" }],
      serverOk: true
    });
    expect(state).toBe(OVERALL_STATES.DEGRADED);
  });

  test("degraded when a service status is unknown", () => {
    const state = deriveOverallState({
      services: [{ status: "unknown" }],
      serverOk: true
    });
    expect(state).toBe(OVERALL_STATES.DEGRADED);
  });

  test("ok when everything is healthy", () => {
    const state = deriveOverallState({
      services: [{ status: "up" }],
      metrics: [{ level: METRIC_LEVELS.OK }],
      serverOk: true
    });
    expect(state).toBe(OVERALL_STATES.OK);
  });

  test("unknown with no data and no server signal", () => {
    expect(deriveOverallState({})).toBe(OVERALL_STATES.UNKNOWN);
  });
});

describe("buildSystemControlModel", () => {
  test("normalizes a minimal /api/health payload", () => {
    const model = buildSystemControlModel({
      ok: true,
      backend: "pocketbase",
      engine: "pocketbase",
      db: { ok: true, latencyMs: 12 },
      uptimeSec: 3600,
      version: "1.2.3"
    });
    expect(model.overall).toBe(OVERALL_STATES.OK);
    expect(model.backend).toBe("pocketbase");
    expect(model.uptimeSec).toBe(3600);
    expect(model.version).toBe("1.2.3");
    // The database is surfaced as a synthetic service.
    expect(model.services[0]).toMatchObject({ id: "database", status: "up" });
  });

  test("marks overall down when the database is unhealthy", () => {
    const model = buildSystemControlModel({
      ok: true,
      db: { ok: false, error: "ECONNREFUSED" }
    });
    expect(model.services[0].status).toBe("down");
    expect(model.overall).toBe(OVERALL_STATES.DOWN);
  });

  test("derives metric percent from used/total when percent is absent", () => {
    const model = buildSystemControlModel({
      ok: true,
      db: { ok: true, latencyMs: 5 },
      metrics: { memory: { used: 8 * 1024 * 1024 * 1024, total: 16 * 1024 * 1024 * 1024 } }
    });
    const mem = model.metrics.find((m) => m.id === "memory");
    expect(mem.percent).toBe(50);
    expect(mem.level).toBe(METRIC_LEVELS.OK);
    expect(mem.detail).toBe("8 GB / 16 GB");
  });

  test("escalates to degraded on a warning-level metric", () => {
    const model = buildSystemControlModel({
      ok: true,
      db: { ok: true, latencyMs: 5 },
      metrics: { cpu: { percent: 80 } }
    });
    expect(model.metrics.find((m) => m.id === "cpu").level).toBe(METRIC_LEVELS.WARN);
    expect(model.overall).toBe(OVERALL_STATES.DEGRADED);
  });

  test("merges explicit services with the synthetic database service", () => {
    const model = buildSystemControlModel({
      ok: true,
      db: { ok: true, latencyMs: 5 },
      services: [{ id: "api", name: "API", status: "up" }]
    });
    expect(model.services.map((s) => s.id)).toEqual(["database", "api"]);
  });

  test("handles empty/invalid payload without throwing", () => {
    const model = buildSystemControlModel();
    expect(model.overall).toBe(OVERALL_STATES.UNKNOWN);
    expect(model.metrics).toEqual([]);
    expect(model.services).toEqual([]);
    expect(model.backend).toBe("محلي");
  });

  test("does not mutate the input payload", () => {
    const payload = { ok: true, db: { ok: true, latencyMs: 5 }, metrics: { cpu: { percent: 10 } } };
    const snapshot = JSON.parse(JSON.stringify(payload));
    buildSystemControlModel(payload);
    expect(payload).toEqual(snapshot);
  });
});
