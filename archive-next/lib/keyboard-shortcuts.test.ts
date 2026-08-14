// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { getAllShortcuts, getShortcut, isTypingTarget, matchesKeyEvent } from "./keyboard-shortcuts";

describe("keyboard shortcuts (V1-832)", () => {
  test("isTypingTarget covers inputs, textareas and contenteditable", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    // jsdom implements neither the isContentEditable getter nor the
    // contentEditable setter, so drive the attribute the browser reflects to.
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const disabledEditable = document.createElement("div");
    disabledEditable.setAttribute("contenteditable", "false");
    const plain = document.createElement("div");

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(disabledEditable)).toBe(false);
    expect(isTypingTarget(plain)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  test("every documented shortcut has a label and a binding", () => {
    Object.values(getAllShortcuts()).forEach(({ label, binding }) => {
      expect(label.trim().length).toBeGreaterThan(0);
      expect(binding.key.length).toBeGreaterThan(0);
    });
  });

  test("uses the selected locale for shortcut labels", () => {
    expect(getAllShortcuts("en").commandPalette.label).toBe("Open command palette");
    expect(getAllShortcuts("ar").commandPalette.label).toBe("فتح لوحة الأوامر");
  });

  test("no shortcut claims a browser combination", () => {
    // Ctrl+S/N/T/W/P belong to the browser; V1-832 requires we leave them alone.
    const reserved = new Set(["s", "n", "t", "w", "p"]);
    Object.values(getAllShortcuts()).forEach(({ binding }) => {
      const usesPrimaryModifier = Boolean(binding.ctrlKey || binding.metaKey);
      expect(usesPrimaryModifier && reserved.has(binding.key.toLowerCase())).toBe(false);
    });
  });

  test("single-key bindings match bare keypresses only", () => {
    const search = getShortcut("focusSearch");
    expect(matchesKeyEvent(new KeyboardEvent("keydown", { key: "/" }), search)).toBe(true);
    expect(matchesKeyEvent(new KeyboardEvent("keydown", { key: "/", ctrlKey: true }), search)).toBe(false);
  });

  test("save accepts either Ctrl or Cmd, not both", () => {
    const save = getShortcut("saveRecord");
    expect(matchesKeyEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true }), save)).toBe(true);
    expect(matchesKeyEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true }), save)).toBe(true);
    expect(matchesKeyEvent(new KeyboardEvent("keydown", { key: "Enter" }), save)).toBe(false);
  });
});
