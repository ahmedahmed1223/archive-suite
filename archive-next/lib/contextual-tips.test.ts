import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  getPageTips,
  isTipsDismissedForSession,
  dismissTipsForSession,
  isTipsEnabledGlobally,
  setTipsEnabledGlobally,
  resetAllDismissedTips,
  dismissTips,
  isTipsDismissed
} from "@/lib/contextual-tips";

function createStorage() {
  const entries = new Map<string, string>();

  return {
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    removeItem: vi.fn((key: string) => entries.delete(key)),
    setItem: vi.fn((key: string, value: string) => entries.set(key, value))
  };
}

describe("role-aware contextual tips (V1-306C)", () => {
  test("viewer guidance excludes archive editing instructions", () => {
    const titles = getPageTips("archive", "viewer").map((tip) => tip.title);
    expect(titles).toContain("وضع القراءة");
    expect(titles).not.toContain("تعديل السجلات");
  });

  test("editor guidance includes archive editing instructions", () => {
    const titles = getPageTips("archive", "editor").map((tip) => tip.title);
    expect(titles).toContain("تعديل السجلات");
    expect(titles).not.toContain("وضع القراءة");
  });

  test("admin guidance includes archive editing instructions", () => {
    expect(getPageTips("archive", "admin").map((tip) => tip.title)).toContain("تعديل السجلات");
  });

  test("shared guidance remains visible to every role", () => {
    expect(getPageTips("archive", "viewer").map((tip) => tip.title)).toContain("السجلات");
    expect(getPageTips("archive", "admin").map((tip) => tip.title)).toContain("السجلات");
  });
});

describe("contextual tips dismiss/enable persistence (design fix)", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", createStorage());
    vi.stubGlobal("sessionStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("session dismiss is scoped to sessionStorage and does not persist across sessions", () => {
    expect(isTipsDismissedForSession("search")).toBe(false);
    dismissTipsForSession("search");
    expect(isTipsDismissedForSession("search")).toBe(true);
    expect(isTipsDismissed("search")).toBe(false);
  });

  test("tips are enabled by default", () => {
    expect(isTipsEnabledGlobally()).toBe(true);
  });

  test("disabling globally persists across the isTipsEnabledGlobally check", () => {
    setTipsEnabledGlobally(false);
    expect(isTipsEnabledGlobally()).toBe(false);
  });

  test("re-enabling globally also clears every permanent and session dismissal", () => {
    dismissTips("search");
    dismissTipsForSession("archive");
    setTipsEnabledGlobally(false);
    setTipsEnabledGlobally(true);

    expect(isTipsEnabledGlobally()).toBe(true);
    expect(isTipsDismissed("search")).toBe(false);
    expect(isTipsDismissedForSession("archive")).toBe(false);
  });

  test("resetAllDismissedTips clears both dismissal stores directly", () => {
    dismissTips("search");
    dismissTipsForSession("archive");
    resetAllDismissedTips();

    expect(isTipsDismissed("search")).toBe(false);
    expect(isTipsDismissedForSession("archive")).toBe(false);
  });
});
