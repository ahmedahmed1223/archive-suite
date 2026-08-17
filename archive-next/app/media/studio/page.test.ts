// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { isInteractiveTarget } from "./page";

/**
 * V3-MEDIA-001: the studio's global keyboard shortcuts (space to play/pause,
 * left/right arrow to seek) must never steal a keystroke from a text field or
 * eat the native Space-activates-button behavior. Mirrors the isTypingTarget
 * coverage in lib/keyboard-shortcuts.test.ts, extended with the button/link/
 * select opt-out this page adds on top.
 */
describe("media studio keyboard-shortcut safety", () => {
  test("treats text inputs, textareas, and contenteditable regions as interactive", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");

    expect(isInteractiveTarget(input)).toBe(true);
    expect(isInteractiveTarget(textarea)).toBe(true);
    expect(isInteractiveTarget(editable)).toBe(true);
  });

  test("treats focused buttons, links, and selects as interactive so Space still activates them", () => {
    expect(isInteractiveTarget(document.createElement("button"))).toBe(true);
    expect(isInteractiveTarget(document.createElement("a"))).toBe(true);
    expect(isInteractiveTarget(document.createElement("select"))).toBe(true);
  });

  test("lets the shortcut fire for plain elements and no target", () => {
    expect(isInteractiveTarget(document.createElement("div"))).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
  });
});
