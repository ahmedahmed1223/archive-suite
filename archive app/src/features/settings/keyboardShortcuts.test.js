import { describe, expect, it } from "vitest";

import {
  SHORTCUT_DISABLED,
  createShortcutExportPayload,
  getDefaultKeyboardShortcuts,
  normalizeImportedKeyboardShortcuts
} from "./keyboardShortcuts.js";

describe("keyboard shortcut import/export", () => {
  it("exports the effective shortcut map without unrelated settings", () => {
    expect(createShortcutExportPayload({
      keyboardShortcuts: { openSearch: "Ctrl+K" },
      masterPasswordHash: "secret"
    }, "2026-06-13T00:00:00.000Z")).toEqual({
      version: 1,
      exportedAt: "2026-06-13T00:00:00.000Z",
      keyboardShortcuts: {
        ...getDefaultKeyboardShortcuts(),
        openSearch: "Ctrl+K"
      }
    });
  });

  it("imports only known shortcut ids and allowed values", () => {
    const imported = normalizeImportedKeyboardShortcuts({
      version: 1,
      keyboardShortcuts: {
        openSearch: "Ctrl+K",
        quickAdd: "Ctrl+Q",
        unknownAction: "Ctrl+X",
        logout: SHORTCUT_DISABLED
      }
    });

    expect(imported.openSearch).toBe("Ctrl+K");
    expect(imported.quickAdd).toBe("Alt+A");
    expect(imported.logout).toBe(SHORTCUT_DISABLED);
    expect(imported.unknownAction).toBeUndefined();
  });
});
