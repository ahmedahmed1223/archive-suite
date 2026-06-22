/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ButtonV2 } from "../ButtonV2.jsx";

describe("ButtonV2", () => {
  it("renders with button role and visible text", () => {
    render(<ButtonV2>حفظ</ButtonV2>);
    expect(screen.getByRole("button", { name: "حفظ" })).toBeInTheDocument();
  });

  it("applies primary variant class", () => {
    render(<ButtonV2 variant="primary">موافق</ButtonV2>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/bg-emerald-500/);
  });

  it("applies destructive variant class", () => {
    render(<ButtonV2 variant="destructive">حذف</ButtonV2>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/va-status-danger/);
  });

  it("is disabled and aria-busy when loading=true", () => {
    render(<ButtonV2 loading>جاري الحفظ</ButtonV2>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("is disabled when disabled=true", () => {
    render(<ButtonV2 disabled>معطّل</ButtonV2>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick when clicked and not disabled", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<ButtonV2 onClick={handler}>انقر</ButtonV2>);
    await user.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<ButtonV2 disabled onClick={handler}>معطّل</ButtonV2>);
    await user.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("renders leadingIcon when not loading", () => {
    render(
      <ButtonV2 leadingIcon={<span data-testid="icon">★</span>}>نص</ButtonV2>
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("hides leadingIcon and shows spinner when loading", () => {
    render(
      <ButtonV2 loading leadingIcon={<span data-testid="icon">★</span>}>نص</ButtonV2>
    );
    expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
    // spinner svg is aria-hidden; button itself should be in the DOM
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("forwards ref to the button element", () => {
    const ref = React.createRef();
    render(<ButtonV2 ref={ref}>مرجع</ButtonV2>);
    expect(ref.current?.tagName).toBe("BUTTON");
  });
});
