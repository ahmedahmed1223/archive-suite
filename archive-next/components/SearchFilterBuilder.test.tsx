// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchFilterBuilder from "./SearchFilterBuilder";

describe("SearchFilterBuilder", () => {
  it("appends a quoted advanced predicate to the existing query", () => {
    const onChange = vi.fn();
    render(<SearchFilterBuilder value="history" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("حقل الفلتر"), { target: { value: "tag" } });
    fireEvent.change(screen.getByLabelText("قيمة الفلتر"), { target: { value: "تاريخ شفهي" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة فلتر" }));
    expect(onChange).toHaveBeenCalledWith('history AND tag:"تاريخ شفهي"');
  });
});
