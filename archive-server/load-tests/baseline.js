/**
 * k6 load test — baseline performance check.
 * Tests the most critical API paths under moderate load.
 *
 * Run: k6 run load-tests/baseline.js
 * Spike: k6 run --env TARGET=spike load-tests/baseline.js
 *
 * Requires k6: https://k6.io/docs/getting-started/installation/
 */
import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ""; // set via env for auth'd routes

// Scenarios: normal → peak → spike
const isSpike = __ENV.TARGET === "spike";
const isPeak  = __ENV.TARGET === "peak";

export const options = isSpike
  ? {
      stages: [
        { duration: "10s", target: 50  },
        { duration: "30s", target: 200 },
        { duration: "10s", target: 0   },
      ],
      thresholds: {
        http_req_duration: ["p(95)<2000"],
        http_req_failed:   ["rate<0.05"],
      },
    }
  : isPeak
  ? {
      stages: [
        { duration: "30s", target: 20 },
        { duration: "60s", target: 50 },
        { duration: "30s", target: 0  },
      ],
      thresholds: {
        http_req_duration: ["p(95)<800"],
        http_req_failed:   ["rate<0.01"],
      },
    }
  : {
      // Baseline: 10 users for 1 minute
      stages: [
        { duration: "10s", target: 10 },
        { duration: "50s", target: 10 },
        { duration: "10s", target: 0  },
      ],
      thresholds: {
        http_req_duration: ["p(95)<500", "p(99)<1000"],
        http_req_failed:   ["rate<0.01"],
      },
    };

// Custom metrics
const authTrend    = new Trend("archive_auth_duration_ms");
const searchTrend  = new Trend("archive_search_duration_ms");
const rpcTrend     = new Trend("archive_rpc_duration_ms");
const errorCounter = new Counter("archive_errors_total");
const successRate  = new Rate("archive_success_rate");

const HEADERS = {
  "Content-Type": "application/json",
  ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
};

// ─── Test Scenarios ────────────────────────────────────────────────────────────
export default function () {
  group("Health Check", () => {
    const res = http.get(`${BASE_URL}/api/health`, { headers: HEADERS });
    check(res, { "health: status 200": r => r.status === 200 });
    successRate.add(res.status === 200);
  });

  sleep(0.2);

  if (AUTH_TOKEN) {
    group("API Discovery", () => {
      const res = http.get(`${BASE_URL}/api/v1/`, { headers: HEADERS });
      check(res, { "discovery: status 200": r => r.status === 200 });
    });

    sleep(0.1);

    group("RPC getAll", () => {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/rpc`,
        JSON.stringify({ method: "getAll", args: ["videos"] }),
        { headers: HEADERS }
      );
      rpcTrend.add(Date.now() - start);
      const ok = check(res, {
        "rpc: status 200":      r => r.status === 200,
        "rpc: has data":        r => { try { return Array.isArray(JSON.parse(r.body)); } catch { return false; } },
      });
      if (!ok) errorCounter.add(1);
      successRate.add(ok);
    });

    sleep(0.3);

    group("Search", () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/v1/search?q=test&limit=10`, { headers: HEADERS });
      searchTrend.add(Date.now() - start);
      check(res, { "search: status 200 or 400": r => r.status === 200 || r.status === 400 });
    });
  } else {
    group("Login", () => {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ username: "admin", password: "wrong_password_intentional" }),
        { headers: HEADERS }
      );
      authTrend.add(Date.now() - start);
      // Expect 401 — we're testing server handles it gracefully, not that login works
      check(res, { "login: handled gracefully": r => r.status === 401 || r.status === 200 });
    });
  }

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    "load-tests/results/summary.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, opts = {}) {
  const p = (path) => {
    const parts = path.split(".");
    let v = data;
    for (const p of parts) v = v?.[p];
    return v;
  };
  const d = p("metrics.http_req_duration");
  if (!d) return "No metrics recorded.\n";
  return [
    "\n📊 Load Test Summary",
    `   p50:    ${d.values?.["p(50)"]?.toFixed(0) ?? "N/A"}ms`,
    `   p95:    ${d.values?.["p(95)"]?.toFixed(0) ?? "N/A"}ms`,
    `   p99:    ${d.values?.["p(99)"]?.toFixed(0) ?? "N/A"}ms`,
    `   errors: ${p("metrics.http_req_failed.values.rate") ? (p("metrics.http_req_failed.values.rate") * 100).toFixed(2) + "%" : "0%"}`,
    `   vus:    ${p("metrics.vus.values.max") ?? "N/A"}`,
    "",
  ].join("\n");
}
