/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { TooltipV2 } from "../TooltipV2.jsx";

// TooltipV2 clones its single child and adds event handlers to it.
// The child must be a plain DOM element — not a wrapper component — so that
// the cloned props (onMouseEnter, onFocus, aria-describedby, etc.) reach the DOM.
function renderTooltip(content: React.ReactNode, delay = 0) {
  return render(
    <TooltipV2 content={content} delay={delay}>
      <button type="button">زر</button>
    </TooltipV2>
  );
}

describe("TooltipV2", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show tooltip content initially", () => {
    renderTooltip("تلميح مخفي");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on mouse enter with delay=0", () => {
    renderTooltip("تلميح");
    act(() => { fireEvent.mouseEnter(screen.getByRole("button")); });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("تلميح");
  });

  it("hides tooltip on mouse leave", () => {
    renderTooltip("تلميح");
    const btn = screen.getByRole("button");
    act(() => { fireEvent.mouseEnter(btn); });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    act(() => { fireEvent.mouseLeave(btn); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on focus (keyboard accessible)", () => {
    renderTooltip("تلميح لوحة مفاتيح");
    act(() => { fireEvent.focus(screen.getByRole("button")); });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("hides tooltip on blur", () => {
    renderTooltip("تلميح");
    const btn = screen.getByRole("button");
    act(() => { fireEvent.focus(btn); });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    act(() => { fireEvent.blur(btn); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("wires aria-describedby on the trigger when tooltip is visible", () => {
    renderTooltip("وصف");
    const btn = screen.getByRole("button");
    act(() => { fireEvent.mouseEnter(btn); });
    const tooltip = screen.getByRole("tooltip");
    expect(btn).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("respects delay prop — tooltip not shown before delay elapses", () => {
    vi.useFakeTimers();
    render(
      <TooltipV2 content="متأخر" delay={500}>
        <button type="button">زر</button>
      </TooltipV2>
    );
    act(() => { fireEvent.mouseEnter(screen.getByRole("button")); });
    // Before 500ms — still hidden
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});
