// @ts-nocheck
import { describe, expect, it } from "vitest";

import {
  TIPS_DISMISSED_KEY,
  getDismissTipPatch,
  getDismissedTips,
  getTipId,
  getTipsForPage,
  shouldShowTip
} from "./contextualTips.js";

const manifestMeta = {
  archive: {
    title: "الأرشيف",
    hint: "تصفية ومعاينة وإضافة فيديو.",
    helpSection: "dashboard-archive"
  },
  htags: {
    title: "الوسوم الهرمية",
    hint: "وسوم جذرية وفرعية.",
    helpSection: "tags"
  },
  bare: { title: "بدون تلميح" }
};

describe("getTipsForPage", () => {
  it("returns one tip derived from page metadata", () => {
    const tips = getTipsForPage("archive", manifestMeta);
    expect(tips).toHaveLength(1);
    expect(tips[0]).toEqual({
      id: "tip:archive",
      pageId: "archive",
      title: "الأرشيف",
      body: "تصفية ومعاينة وإضافة فيديو.",
      helpSection: "dashboard-archive"
    });
  });

  it("normalizes the help section alias", () => {
    const [tip] = getTipsForPage("htags", manifestMeta);
    expect(tip.helpSection).toBe("tags");
  });

  it("returns no tips for a page without a hint", () => {
    expect(getTipsForPage("bare", manifestMeta)).toEqual([]);
  });

  it("returns no tips for an unknown page or empty id", () => {
    expect(getTipsForPage("nope", manifestMeta)).toEqual([]);
    expect(getTipsForPage("", manifestMeta)).toEqual([]);
  });

  it("falls back to the real manifest when no meta is passed", () => {
    const tips = getTipsForPage("archive");
    expect(tips).toHaveLength(1);
    expect(tips[0].id).toBe("tip:archive");
  });
});

describe("getTipId", () => {
  it("namespaces the page id", () => {
    expect(getTipId("search")).toBe("tip:search");
  });
});

describe("shouldShowTip", () => {
  it("shows a tip that is not dismissed", () => {
    expect(shouldShowTip("tip:archive", ["tip:search"])).toBe(true);
    expect(shouldShowTip("tip:archive", new Set(["tip:search"]))).toBe(true);
  });

  it("hides a dismissed tip", () => {
    expect(shouldShowTip("tip:archive", ["tip:archive"])).toBe(false);
  });

  it("never shows a tip without an id", () => {
    expect(shouldShowTip("", ["tip:archive"])).toBe(false);
  });
});

describe("getDismissedTips", () => {
  it("reads the array from settings", () => {
    expect(getDismissedTips({ ui: { [TIPS_DISMISSED_KEY]: ["tip:archive"] } })).toEqual(["tip:archive"]);
  });

  it("returns an empty array for missing or malformed data", () => {
    expect(getDismissedTips({})).toEqual([]);
    expect(getDismissedTips({ ui: { [TIPS_DISMISSED_KEY]: "bad" } })).toEqual([]);
  });
});

describe("getDismissTipPatch", () => {
  it("appends a new tip id immutably", () => {
    const settings = { ui: { [TIPS_DISMISSED_KEY]: ["tip:search"] } };
    const patch = getDismissTipPatch("tip:archive", settings);
    expect(patch.ui[TIPS_DISMISSED_KEY]).toEqual(["tip:search", "tip:archive"]);
    expect(settings.ui[TIPS_DISMISSED_KEY]).toEqual(["tip:search"]);
  });

  it("does not duplicate an already-dismissed id", () => {
    const patch = getDismissTipPatch("tip:archive", { ui: { [TIPS_DISMISSED_KEY]: ["tip:archive"] } });
    expect(patch.ui[TIPS_DISMISSED_KEY]).toEqual(["tip:archive"]);
  });

  it("is a no-op list for an empty id", () => {
    const patch = getDismissTipPatch("", { ui: { [TIPS_DISMISSED_KEY]: ["tip:archive"] } });
    expect(patch.ui[TIPS_DISMISSED_KEY]).toEqual(["tip:archive"]);
  });
});
