/**
 * Prometheus metrics for Archive Suite server.
 * Exposes: default Node.js metrics + custom app metrics.
 */
import { createLogger } from "../logger.js";

const log = createLogger("metrics");
let client = null;

// Custom metrics registry
let httpRequestDuration = null;
let activeRequests = null;
let rpcOperations = null;
let authAttempts = null;

export async function initMetrics() {
  try {
    const prom = await import("prom-client");
    client = prom;

    // Collect default Node.js metrics (heap, CPU, event loop, etc.)
    prom.collectDefaultMetrics({ prefix: "archive_" });

    httpRequestDuration = new prom.Histogram({
      name: "archive_http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status_code"],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });

    activeRequests = new prom.Gauge({
      name: "archive_active_requests_total",
      help: "Number of active HTTP requests",
    });

    rpcOperations = new prom.Counter({
      name: "archive_rpc_operations_total",
      help: "Total RPC operations",
      labelNames: ["method", "store", "status"],
    });

    authAttempts = new prom.Counter({
      name: "archive_auth_attempts_total",
      help: "Total authentication attempts",
      labelNames: ["outcome"], // success | failure | totp_required | totp_invalid
    });

    log.info("Prometheus metrics initialized.");
  } catch (err) {
    log.warn({ err }, "prom-client not available — metrics disabled.");
  }
}

export async function getMetricsOutput() {
  if (!client) return "# metrics not available\n";
  return client.register.metrics();
}

export function getContentType() {
  return client?.register?.contentType ?? "text/plain; version=0.0.4";
}

export function recordRequest(method, route, statusCode, durationSec) {
  httpRequestDuration?.observe({ method, route, status_code: statusCode }, durationSec);
}

export function incActiveRequests() { activeRequests?.inc(); }
export function decActiveRequests() { activeRequests?.dec(); }

export function recordRpc(method, store, status) {
  rpcOperations?.inc({ method, store: store || "_", status });
}

export function recordAuth(outcome) {
  authAttempts?.inc({ outcome });
}
