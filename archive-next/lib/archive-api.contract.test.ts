import { describe, expect, expectTypeOf, it } from "vitest";
import type { components } from "./generated/archive-api";

type MontageSource = components["schemas"]["MontageSource"];
type MontageClip = components["schemas"]["MontageClip"];
type MontageProjectRevision = components["schemas"]["MontageProjectRevision"];
type MontageExportRequest = components["schemas"]["MontageExportRequest"];
type MontageExportResponse = components["schemas"]["MontageExportResponse"];

/**
 * V1.5 operational expansion — Task 1 contract shape tests.
 * The generated client must expose the revisioned montage contract exactly as
 * documented in docs/api/archive-contract.openapi.json.
 */
describe("montage contract shapes (Task 1)", () => {
  it("pins a clip to a versioned source with bounded timeline ranges", () => {
    expectTypeOf<MontageClip>().toMatchTypeOf<{
      id: string;
      trackId: string;
      source: MontageSource;
      timelineStart: number;
      sourceIn: number;
      sourceOut: number;
    }>();
  });

  it("requires a version token on every source reference", () => {
    expectTypeOf<MontageSource["sourceVersionToken"]>().toBeString();
  });

  it("exposes an immutable revision snapshot with numbered history", () => {
    expectTypeOf<MontageProjectRevision["revisionNumber"]>().toBeNumber();
    expectTypeOf<MontageProjectRevision["clips"]>().toMatchTypeOf<MontageClip[]>();
  });

  it("constrains export requests to expectedRevision plus allowlisted presets", () => {
    expectTypeOf<MontageExportRequest>().toMatchTypeOf<{
      expectedRevision: number;
      preset: "web-1080p" | "web-4k" | "archive-master";
    }>();
  });

  it("reports export progress through the documented status union", () => {
    const status: MontageExportResponse["status"] = "queued";
    expect(["queued", "processing", "completed", "failed", "cancelled"]).toContain(status);
  });
});
