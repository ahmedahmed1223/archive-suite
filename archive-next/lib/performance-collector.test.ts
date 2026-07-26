import { describe, expect, test } from "vitest";
import { createFrontendPerformanceCollector } from "@/lib/performance-collector";

describe("frontend performance collector (V1-307B)", () => {
  test("emits a route- and viewport-scoped metric", () => {
    const samples: unknown[] = [];
    createFrontendPerformanceCollector("/archive", (sample) => samples.push(sample), 375)("lcpP75Ms", 1200);
    expect(samples).toEqual([{ metric: "lcpP75Ms", value: 1200, route: "/archive", viewportWidth: 375 }]);
  });

  test("does not emit invalid metrics", () => {
    const samples: unknown[] = [];
    createFrontendPerformanceCollector("/archive", (sample) => samples.push(sample), 375)("clsP75", -1);
    expect(samples).toEqual([]);
  });
});
