export type FrontendPerformanceMetric = "lcpP75Ms" | "clsP75" | "inpP75Ms";
export type FrontendPerformanceSample = { metric: FrontendPerformanceMetric; value: number; route: string; viewportWidth: number };

/**
 * Converts browser performance entries into the versioned V1 regression-run
 * shape. Transport is deliberately injected so CI and production telemetry
 * can use different sinks without changing measurement semantics.
 */
export function createFrontendPerformanceCollector(
  route: string,
  send: (sample: FrontendPerformanceSample) => void,
  viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth
) {
  return (metric: FrontendPerformanceMetric, value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    send({ metric, value, route, viewportWidth });
  };
}

