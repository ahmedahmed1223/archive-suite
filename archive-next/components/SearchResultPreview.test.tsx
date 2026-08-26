// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SearchResultPreview, { resolveSearchPreviewRecord } from "./SearchResultPreview";

const records = [
  { id: "one", title: "أول سجل", description: "الوصف الأول" },
  { id: "two", title: "ثاني سجل", description: "الوصف الثاني" },
];

afterEach(cleanup);

describe("SearchResultPreview", () => {
  it("renders the selected result in an accessible live region", () => {
    render(
      <SearchResultPreview
        records={records}
        selectedId="two"
        previewLabel="معاينة النتيجة"
        empty={<p>فارغ</p>}
        renderPreview={(record, headingId) => <h2 id={headingId}>{record.title}</h2>}
      />
    );

    expect(screen.getByRole("region", { name: "معاينة النتيجة" })).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { name: "ثاني سجل" })).toBeInTheDocument();
  });

  it("falls back to the first record when filtering removes the selected result", () => {
    expect(resolveSearchPreviewRecord(records, "missing")?.id).toBe("one");
  });

  it("renders the supplied empty state without a selected result", () => {
    render(<SearchResultPreview records={[]} selectedId={null} previewLabel="معاينة" empty={<p>فارغ</p>} renderPreview={() => null} />);
    expect(screen.getByText("فارغ")).toBeInTheDocument();
  });
});
