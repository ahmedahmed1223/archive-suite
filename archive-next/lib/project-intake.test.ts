import { describe, expect, it } from "vitest";
import {
  canAdvanceTo,
  INTAKE_STAGES,
  isStageValid,
  nextStage,
  type IntakeDraft,
} from "./project-intake";

const base: IntakeDraft = {
  uploadId: "u1",
  rightsConfirmed: false,
  duplicateState: "none",
};

describe("staged intake wizard (Task 8)", () => {
  it("exposes exactly five named stages in order", () => {
    expect(INTAKE_STAGES).toEqual(["source", "inspection", "metadata", "rights", "review"]);
  });

  it("blocks source stage without an upload", () => {
    expect(isStageValid("source", { ...base, uploadId: undefined })).toBe(false);
    expect(isStageValid("source", base)).toBe(true);
  });

  it("makes a detected duplicate a decision, never an automatic merge", () => {
    const flagged = { ...base, duplicateState: "duplicate" as const };
    // Cannot pass inspection while the duplicate is unacknowledged…
    expect(isStageValid("inspection", flagged)).toBe(false);
    // …but the operator's explicit decision unblocks it.
    expect(isStageValid("inspection", { ...flagged, duplicateDecisionMade: true })).toBe(true);
  });

  it("blocks submission without confirmed rights or a destination project", () => {
    const ready: IntakeDraft = {
      ...base,
      projectId: "p1",
      title: "تسجيل",
      rightsConfirmed: true,
    };
    expect(isStageValid("review", ready)).toBe(true);

    expect(isStageValid("review", { ...ready, rightsConfirmed: false })).toBe(false);
    expect(isStageValid("review", { ...ready, projectId: undefined })).toBe(false);
  });

  it("refuses to advance from an invalid stage", () => {
    expect(nextStage("metadata", { ...base, title: " " })).toBeNull();
    expect(nextStage("metadata", { ...base, title: "عنوان" })).toBe("rights");
    expect(nextStage("review", { ...base })).toBeNull(); // last stage
  });

  it("canAdvanceTo mirrors isStageValid", () => {
    expect(canAdvanceTo("metadata", { ...base, title: "x" })).toBe(true);
    expect(canAdvanceTo("metadata", { ...base, title: "" })).toBe(false);
  });
});
