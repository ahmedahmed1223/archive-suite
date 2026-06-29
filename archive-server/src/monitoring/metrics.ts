/**
 * Prometheus metrics for Archive Suite server.
 * Exposes: default Node.js metrics + custom app metrics.
 */
import { createLogger } from "../logger.js";

const log = createLogger("metrics");
let client: any = null;

// Custom metrics registry
let httpRequestDuration: any = null;
let activeRequests: any = null;
let rpcOperations: any = null;
let authAttempts: any = null;

export async function initMetrics(): Promise<void> {
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

export async function getMetricsOutput(): Promise<string> {
  if (!client) return "# metrics not available\n";
  return client.register.metrics();
}

export function getContentType(): string {
  return client?.register?.contentType ?? "text/plain; version=0.0.4";
}

export function recordRequest(method: string, route: string, statusCode: number, durationSec: number): void {
  httpRequestDuration?.observe({ method, route, status_code: statusCode }, durationSec);
}

export function incActiveRequests(): void { activeRequests?.inc(); }
export function decActiveRequests(): void { activeRequests?.dec(); }

export function recordRpc(method: string, store: string | undefined, status: string): void {
  rpcOperations?.inc({ method, store: store || "_", status });
}

export function recordAuth(outcome: string): void {
  authAttempts?.inc({ outcome });
}
