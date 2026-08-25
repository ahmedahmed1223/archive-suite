// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import ActiveFilterBar from "./ActiveFilterBar";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

afterEach(() => cleanup());

function renderBar(filters: { key: string; label: string; onRemove: () => void }[], onReset?: () => void) {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie>
      <ActiveFilterBar filters={filters} onReset={onReset} />
    </LocaleProvider>
  );
}

describe("ActiveFilterBar (V15-SEARCH-002)", () => {
  it("renders nothing when there are no filters", () => {
    const { container } = renderBar([]);
    expect(container.querySelector(".active-filter-bar")).toBeNull();
  });

  it("renders one chip per active filter", () => {
    renderBar([
      { key: "type", label: "فيديو", onRemove: vi.fn() },
      { key: "tag", label: "عاجل", onRemove: vi.fn() },
    ]);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("فيديو")).toBeTruthy();
  });

  it("calls onRemove when a chip remove button is clicked", () => {
    const onRemove = vi.fn();
    renderBar([{ key: "type", label: "فيديو", onRemove }]);
    const btn = screen.getByRole("button", { name: /إزالة الفلتر/ });
    btn.click();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("shows the reset button only when onReset is provided", () => {
    const onReset = vi.fn();
    const { rerender } = renderBar([{ key: "type", label: "فيديو", onRemove: vi.fn() }]);
    expect(screen.queryByRole("button", { name: /مسح الكل/ })).toBeNull();
    rerender(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <ActiveFilterBar filters={[{ key: "type", label: "فيديو", onRemove: vi.fn() }]} onReset={onReset} />
      </LocaleProvider>
    );
    const reset = screen.getByRole("button", { name: /مسح الكل/ });
    reset.click();
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("announces the group via aria-label", () => {
    const { container } = renderBar([{ key: "type", label: "فيديو", onRemove: vi.fn() }]);
    const bar = container.querySelector(".active-filter-bar");
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute("aria-label")).toContain("الفلاتر النشطة");
    expect(bar?.textContent).toContain("فيديو");
  });
});
