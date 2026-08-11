// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MediaSourcePicker from "./MediaSourcePicker";

const api = vi.hoisted(() => ({ browseFiles: vi.fn() }));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => api,
}));

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return {
    useLocale: () => ({ locale: "en", direction: "ltr", t: getDictionary("en"), setLocale: vi.fn() }),
  };
});

describe("MediaSourcePicker", () => {
  it("uses localized browser copy and loads the archive root", async () => {
    api.browseFiles.mockResolvedValue({ ok: true, path: "", entries: [] });
    render(<MediaSourcePicker label="Browse files" onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Browse files" }));

    expect(await screen.findByRole("dialog", { name: "Choose media source" })).toBeTruthy();
    expect(screen.getByText("Browse archive files — /")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(api.browseFiles).toHaveBeenCalledWith({ path: "" });
  });
});
