import { describe, expect, test } from "vitest";

import { isEditInSidePanelEnabled, resolveOpenTarget } from "./resolveOpenTarget.js";

describe("resolveOpenTarget (§19.9)", () => {
  test("opens the dedicated detail page by default", () => {
    // Arrange / Act
    const target = resolveOpenTarget();

    // Assert
    expect(target).toBe("detail");
  });

  test("an open action always lands on the dedicated page", () => {
    expect(resolveOpenTarget({ action: "open" })).toBe("detail");
    expect(resolveOpenTarget({ action: "open", editInSidePanel: true })).toBe("detail");
  });

  test("an edit action lands on the dedicated page when the side-panel preference is off", () => {
    expect(resolveOpenTarget({ action: "edit" })).toBe("detail");
    expect(resolveOpenTarget({ action: "edit", editInSidePanel: false })).toBe("detail");
  });

  test("an edit action uses the side panel only when explicitly enabled", () => {
    expect(resolveOpenTarget({ action: "edit", editInSidePanel: true })).toBe("sidePanel");
  });

  test("falls back to the dedicated page for unknown actions", () => {
    expect(resolveOpenTarget({ action: "bogus" })).toBe("detail");
    expect(resolveOpenTarget({ action: "bogus", editInSidePanel: true })).toBe("detail");
  });

  test("only a literal true enables the side panel (no truthy coercion)", () => {
    // Guard against accidental coercion of a non-boolean preference value.
    expect(resolveOpenTarget({ action: "edit", editInSidePanel: "yes" })).toBe("detail");
    expect(resolveOpenTarget({ action: "edit", editInSidePanel: 1 })).toBe("detail");
  });
});

describe("isEditInSidePanelEnabled (§19.9)", () => {
  test("defaults to false for missing or empty settings", () => {
    expect(isEditInSidePanelEnabled(undefined)).toBe(false);
    expect(isEditInSidePanelEnabled(null)).toBe(false);
    expect(isEditInSidePanelEnabled({})).toBe(false);
    expect(isEditInSidePanelEnabled({ ui: {} })).toBe(false);
  });

  test("reflects an explicit true preference", () => {
    expect(isEditInSidePanelEnabled({ ui: { editInSidePanel: true } })).toBe(true);
  });

  test("treats non-true values as disabled", () => {
    expect(isEditInSidePanelEnabled({ ui: { editInSidePanel: false } })).toBe(false);
    expect(isEditInSidePanelEnabled({ ui: { editInSidePanel: "true" } })).toBe(false);
  });
});
