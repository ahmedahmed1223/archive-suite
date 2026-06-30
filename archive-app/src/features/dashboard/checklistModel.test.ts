import { describe, expect, it } from "vitest";

import {
  CHECKLIST_BANNER_ID,
  buildGettingStartedChecklist,
  dismissChecklist,
  isChecklistComplete,
  isChecklistDismissed
} from "./checklistModel.js";

describe("buildGettingStartedChecklist", () => {
  it("returns all steps as not-done when state is empty", () => {
    const steps = buildGettingStartedChecklist();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("marks create-type done when contentTypes are present", () => {
    const steps = buildGettingStartedChecklist({ contentTypes: [{ id: "t1" }] });
    const step = steps.find((s) => s.id === "create-type");
    expect(step?.done).toBe(true);
  });

  it("marks add-item done when there is at least one non-deleted item", () => {
    const steps = buildGettingStartedChecklist({ videoItems: [{ id: "v1" }] });
    expect(steps.find((s) => s.id === "add-item")?.done).toBe(true);
  });

  it("does NOT mark add-item done when all items are deleted", () => {
    const steps = buildGettingStartedChecklist({ videoItems: [{ id: "v1", isDeleted: true }] });
    expect(steps.find((s) => s.id === "add-item")?.done).toBe(false);
  });

  it("marks upload-file done when an item has a filePath", () => {
    const steps = buildGettingStartedChecklist({
      videoItems: [{ id: "v1", filePath: "/media/clip.mp4" }]
    });
    expect(steps.find((s) => s.id === "upload-file")?.done).toBe(true);
  });

  it("marks upload-file done via metadata.fileSize", () => {
    const steps = buildGettingStartedChecklist({
      videoItems: [{ id: "v1", metadata: { fileSize: 1024 } }]
    });
    expect(steps.find((s) => s.id === "upload-file")?.done).toBe(true);
  });

  it("marks upload-file done via uploads array", () => {
    const steps = buildGettingStartedChecklist({ uploads: [{ id: "u1" }] });
    expect(steps.find((s) => s.id === "upload-file")?.done).toBe(true);
  });

  it("marks create-collection done when virtualCollections are present", () => {
    const steps = buildGettingStartedChecklist({ virtualCollections: [{ id: "c1" }] });
    expect(steps.find((s) => s.id === "create-collection")?.done).toBe(true);
  });

  it("marks backup done when settings.lastBackupAt is set", () => {
    const steps = buildGettingStartedChecklist({ settings: { lastBackupAt: "2026-01-01" } });
    expect(steps.find((s) => s.id === "backup")?.done).toBe(true);
  });

  it("marks security done when onboardingSecurityMode is not quick", () => {
    const steps = buildGettingStartedChecklist({
      settings: { ui: { onboardingSecurityMode: "full" } }
    });
    expect(steps.find((s) => s.id === "security")?.done).toBe(true);
  });

  it("does NOT mark security done when onboardingSecurityMode is quick", () => {
    const steps = buildGettingStartedChecklist({
      settings: { ui: { onboardingSecurityMode: "quick" } }
    });
    expect(steps.find((s) => s.id === "security")?.done).toBe(false);
  });

  it("each step has id, label, and done fields", () => {
    for (const step of buildGettingStartedChecklist()) {
      expect(typeof step.id).toBe("string");
      expect(typeof step.label).toBe("string");
      expect(typeof step.done).toBe("boolean");
    }
  });
});

describe("isChecklistComplete", () => {
  it("returns false when some steps are not done", () => {
    const steps = buildGettingStartedChecklist();
    expect(isChecklistComplete(steps)).toBe(false);
  });

  it("returns true when all steps are done", () => {
    const steps = buildGettingStartedChecklist().map((s) => ({ ...s, done: true }));
    expect(isChecklistComplete(steps)).toBe(true);
  });

  it("returns false for empty array", () => {
    expect(isChecklistComplete([])).toBe(false);
  });
});

describe("isChecklistDismissed / dismissChecklist", () => {
  it("returns false when banner not in list", () => {
    expect(isChecklistDismissed({})).toBe(false);
    expect(isChecklistDismissed({ ui: { dismissedBanners: [] } })).toBe(false);
  });

  it("returns true when CHECKLIST_BANNER_ID is in dismissedBanners", () => {
    expect(isChecklistDismissed({ ui: { dismissedBanners: [CHECKLIST_BANNER_ID] } })).toBe(true);
  });

  it("dismissChecklist adds CHECKLIST_BANNER_ID to banners", () => {
    const result = dismissChecklist({});
    expect(result).toContain(CHECKLIST_BANNER_ID);
  });

  it("dismissChecklist preserves existing banners", () => {
    const result = dismissChecklist({ ui: { dismissedBanners: ["demo"] } });
    expect(result).toContain("demo");
    expect(result).toContain(CHECKLIST_BANNER_ID);
  });

  it("dismissChecklist is idempotent", () => {
    const once = dismissChecklist({ ui: { dismissedBanners: [CHECKLIST_BANNER_ID] } });
    expect(once.filter((b) => b === CHECKLIST_BANNER_ID).length).toBe(1);
  });
});
