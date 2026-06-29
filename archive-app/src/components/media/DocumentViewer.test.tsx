// @vitest-environment jsdom
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { clampPdfPage, PdfPageNavigation } from "./DocumentViewer.jsx";

describe("PDF page navigation", () => {
  it("clamps direct page jumps", () => {
    expect(clampPdfPage(0, 10)).toBe(1);
    expect(clampPdfPage(99, 10)).toBe(10);
  });

  it("jumps to a researcher-entered page number", () => {
    const onPageChange = vi.fn();
    render(<PdfPageNavigation currentPage={2} totalPages={10} onPageChange={onPageChange} />);
    fireEvent.change(screen.getByLabelText("رقم صفحة PDF"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "انتقال" }));
    expect(onPageChange).toHaveBeenCalledWith(8);
  });
});
