// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PageToolbar from "./PageToolbar";

describe("PageToolbar", () => {
  it("keeps the page title, actions, metadata, and controls in the shared landmark", () => {
    render(
      <PageToolbar
        title="عنوان الصفحة"
        description="وصف موجز"
        meta={<span>٤ عناصر</span>}
        actions={<button type="button">إضافة</button>}
        tone="accent"
        density="compact"
      >
        <button type="button">تصفية</button>
      </PageToolbar>
    );

    const toolbar = screen.getByRole("banner", { name: "عنوان الصفحة" });
    expect(toolbar).toHaveAttribute("data-tone", "accent");
    expect(toolbar).toHaveAttribute("data-density", "compact");
    expect(toolbar).toHaveAttribute("data-has-actions", "true");
    expect(toolbar).toHaveAttribute("data-has-controls", "true");
    expect(screen.getByRole("heading", { name: "عنوان الصفحة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إضافة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تصفية" })).toBeInTheDocument();
  });
});
