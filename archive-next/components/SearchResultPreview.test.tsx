// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchResultPreview, { resolveSearchPreviewRecord } from "./SearchResultPreview";

const records = [
  { id: "one", title: "أول سجل", description: "الوصف الأول", type: "video" },
  { id: "two", title: "ثاني سجل", description: "الوصف الثاني", type: "audio" },
];

afterEach(cleanup);

describe("SearchResultPreview", () => {
  it("marks the explicitly selected result as selected and supports keyboard-native selection", () => {
    const select = vi.fn();
    render(<SearchResultPreview records={records} selectedId="two" onSelect={select} previewLabel="المعاينة" openLabel="فتح" />);

    expect(screen.getByRole("option", { name: /ثاني سجل/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("option", { name: /أول سجل/ }));
    expect(select).toHaveBeenCalledWith("one");
  });

  it("associates the preview region with its heading and exposes a close action", () => {
    const close = vi.fn();
    render(<SearchResultPreview records={records} selectedId="one" onSelect={vi.fn()} onClose={close} previewLabel="المعاينة" openLabel="فتح" closeLabel="إغلاق" />);

    const region = screen.getByRole("region", { name: "المعاينة" });
    expect(region).toHaveAttribute("aria-labelledby");
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("falls back to the first record when filtering removes the selected result", () => {
    expect(resolveSearchPreviewRecord(records, "missing")?.id).toBe("one");
  });
});
