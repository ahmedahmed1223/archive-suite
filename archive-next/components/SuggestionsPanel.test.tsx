// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import type { ArchiveSuggestion } from "@/lib/archive-api";

const suggestions: ArchiveSuggestion[] = [
  { key: "s1", title: "أضف وسوماً", detail: "12 سجل بلا وسوم", severity: "high", count: 12, actionHref: "/tags" },
  { key: "s2", title: "أكمل الأنواع", detail: "5 سجلات بلا نوع", severity: "medium", count: 5, actionHref: "/types" },
  { key: "s3", title: "راجع الحقوق", detail: "3 سجلات بلا ترخيص", severity: "low", count: 3, actionHref: "/rights" }
];

afterEach(cleanup);

describe("SuggestionsPanel bulk actions (V1-744)", () => {
  test("renders no bulk row for a single suggestion", () => {
    render(<SuggestionsPanel suggestions={[suggestions[0]]} onFeedback={vi.fn()} />);
    expect(screen.queryByRole("checkbox", { name: "تحديد كل الاقتراحات" })).toBeNull();
  });

  test("select-all then bulk-dismiss calls onFeedback for every visible suggestion and removes them", async () => {
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    render(<SuggestionsPanel suggestions={suggestions} onFeedback={onFeedback} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "تحديد كل الاقتراحات" }));
    fireEvent.click(screen.getByRole("button", { name: /رفض المحدد/ }));

    await screen.findByText("لا شيء بانتظارك", { exact: false }).catch(() => null);
    expect(onFeedback).toHaveBeenCalledTimes(3);
    suggestions.forEach((suggestion) => {
      expect(onFeedback).toHaveBeenCalledWith(suggestion, "dismissed");
    });
  });

  test("selecting one suggestion and bulk-approving only calls onFeedback for it", async () => {
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    render(<SuggestionsPanel suggestions={suggestions} onFeedback={onFeedback} />);

    fireEvent.click(screen.getByRole("checkbox", { name: `تحديد ${suggestions[1].title}` }));
    fireEvent.click(screen.getByRole("button", { name: /اعتماد المحدد/ }));

    await Promise.resolve();
    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith(suggestions[1], "useful");
  });

  test("bulk buttons are disabled with no selection", () => {
    render(<SuggestionsPanel suggestions={suggestions} onFeedback={vi.fn()} />);
    expect(screen.getByRole("button", { name: /اعتماد المحدد/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /رفض المحدد/ })).toBeDisabled();
  });
});
