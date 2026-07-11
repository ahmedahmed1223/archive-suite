import { describe, expect, it } from "vitest";
import {
  deriveIntakeNextAction,
  deriveReviewReadiness,
  findDuplicateFiles,
  summarizeFileProgress,
  recoverIntakeDraft,
  type IntakeDraft,
} from "./intake-journey";

const validDraft: IntakeDraft = {
  version: 1,
  step: "metadata",
  mode: "guided",
  folder: "incoming/field",
  titlePrefix: "مقابلة",
  type: "video",
  subtype: "interview",
  tags: "شفهي, 2026",
  summary: "مقابلة ميدانية",
  templateId: "oral-history",
  updatedAt: "2026-07-11T08:00:00.000Z",
};

describe("intake journey", () => {
  it("recovers a valid persisted draft and rejects incompatible data", () => {
    expect(recoverIntakeDraft(JSON.stringify(validDraft))).toEqual(validDraft);
    expect(recoverIntakeDraft('{"version":2,"step":"review"}')).toBeNull();
    expect(recoverIntakeDraft("not-json")).toBeNull();
  });

  it("warns when selected files repeat the same name and size", () => {
    expect(findDuplicateFiles([
      { name: "clip.mp4", size: 42 },
      { name: "notes.txt", size: 9 },
      { name: "clip.mp4", size: 42 },
    ])).toEqual(["clip.mp4"]);
  });

  it("summarizes partial file failure without hiding successful files", () => {
    expect(summarizeFileProgress([
      { fileName: "one.mp4", status: "success" },
      { fileName: "two.mp4", status: "error", message: "network" },
    ])).toEqual({ total: 2, succeeded: 1, failed: 1, pending: 0, retryable: ["two.mp4"] });
  });

  it("requires files and guided metadata before review", () => {
    expect(deriveReviewReadiness({ fileCount: 0, mode: "guided", type: "" })).toEqual({
      ready: false,
      missing: ["files", "type"],
    });
    expect(deriveReviewReadiness({ fileCount: 2, mode: "quick", type: "" })).toEqual({ ready: true, missing: [] });
  });

  it("derives a recoverable next action for each journey outcome", () => {
    expect(deriveIntakeNextAction({ fileCount: 0, mode: "guided", type: "", failedFiles: 0 })).toMatchObject({ key: "select-files" });
    expect(deriveIntakeNextAction({ fileCount: 1, mode: "guided", type: "", failedFiles: 0 })).toMatchObject({ key: "complete-metadata" });
    expect(deriveIntakeNextAction({ fileCount: 2, mode: "guided", type: "video", failedFiles: 1 })).toMatchObject({ key: "retry-failed" });
    expect(deriveIntakeNextAction({ fileCount: 2, mode: "quick", type: "", failedFiles: 0, completed: true })).toMatchObject({ key: "open-jobs", href: "/media/jobs" });
  });
});
