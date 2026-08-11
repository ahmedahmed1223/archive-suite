// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ShortcutsOverlay from "@/components/ShortcutsOverlay";
import { getAllShortcuts, getShortcut } from "@/lib/keyboard-shortcuts";

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return {
    useLocale: () => ({ locale: "ar", direction: "rtl", t: getDictionary("ar"), setLocale: vi.fn() }),
  };
});

const storedValues = new Map<string, string>();
const localStorageMock: Storage = {
  get length() { return storedValues.size; },
  clear: () => storedValues.clear(),
  getItem: (key) => storedValues.get(key) ?? null,
  key: (index) => Array.from(storedValues.keys())[index] ?? null,
  removeItem: (key) => { storedValues.delete(key); },
  setItem: (key, value) => { storedValues.set(key, value); },
};

beforeEach(() => {
  storedValues.clear();
  Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageMock });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("keyboard-shortcuts — shortcutsHelp", () => {
  test("registers a default '?' binding", () => {
    const binding = getShortcut("shortcutsHelp");
    expect(binding.key).toBe("?");
    expect(binding.shiftKey).toBe(true);
  });

  test("is included in getAllShortcuts with an Arabic label", () => {
    const all = getAllShortcuts();
    expect(all.shortcutsHelp.label.length).toBeGreaterThan(0);
    expect(all.shortcutsHelp.binding.key).toBe("?");
  });
});

describe("ShortcutsOverlay", () => {
  test("opens when '?' is pressed and lists all shortcuts", async () => {
    render(<ShortcutsOverlay />);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.keyDown(window, { key: "?", shiftKey: true });

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("فتح لوحة الأوامر")).toBeTruthy();
  });

  test("closes on Escape", async () => {
    render(<ShortcutsOverlay />);
    fireEvent.keyDown(window, { key: "?", shiftKey: true });
    const dialog = await screen.findByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("does not open while typing inside an input", () => {
    render(
      <>
        <ShortcutsOverlay />
        <input aria-label="بحث" />
      </>
    );

    const input = screen.getByLabelText("بحث");
    fireEvent.keyDown(input, { key: "?", shiftKey: true });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
