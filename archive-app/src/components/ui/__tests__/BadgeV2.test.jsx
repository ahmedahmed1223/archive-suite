/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BadgeV2 } from "../BadgeV2.jsx";

describe("BadgeV2", () => {
  it("renders children text", () => {
    render(<BadgeV2>نشط</BadgeV2>);
    expect(screen.getByText("نشط")).toBeInTheDocument();
  });

  it("applies default variant classes when no variant given", () => {
    render(<BadgeV2>افتراضي</BadgeV2>);
    const badge = screen.getByText("افتراضي");
    expect(badge.className).toMatch(/va-surface-2/);
  });

  it("applies success variant class", () => {
    render(<BadgeV2 variant="success">ناجح</BadgeV2>);
    const badge = screen.getByText("ناجح");
    expect(badge.className).toMatch(/va-status-success/);
  });

  it("applies warning variant class", () => {
    render(<BadgeV2 variant="warning">تحذير</BadgeV2>);
    const badge = screen.getByText("تحذير");
    expect(badge.className).toMatch(/va-status-warning/);
  });

  it("applies danger variant class", () => {
    render(<BadgeV2 variant="danger">خطر</BadgeV2>);
    const badge = screen.getByText("خطر");
    expect(badge.className).toMatch(/va-status-danger/);
  });

  it("applies info variant class", () => {
    render(<BadgeV2 variant="info">معلومات</BadgeV2>);
    const badge = screen.getByText("معلومات");
    expect(badge.className).toMatch(/va-status-info/);
  });

  it("renders dot indicator when dot=true", () => {
    render(<BadgeV2 dot>مع نقطة</BadgeV2>);
    // The dot span is aria-hidden; we query by aria-hidden presence
    const badge = screen.getByText("مع نقطة").closest("span");
    const dot = badge.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it("does not render dot indicator when dot=false (default)", () => {
    render(<BadgeV2>بدون نقطة</BadgeV2>);
    const badge = screen.getByText("بدون نقطة").closest("span");
    const dot = badge.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeInTheDocument();
  });

  it("applies sm size class", () => {
    render(<BadgeV2 size="sm">صغير</BadgeV2>);
    const badge = screen.getByText("صغير");
    expect(badge.className).toMatch(/h-5/);
  });

  it("applies md size class (default)", () => {
    render(<BadgeV2>متوسط</BadgeV2>);
    const badge = screen.getByText("متوسط");
    expect(badge.className).toMatch(/h-6/);
  });

  it("merges custom className", () => {
    render(<BadgeV2 className="custom-class">خاص</BadgeV2>);
    const badge = screen.getByText("خاص");
    expect(badge.className).toMatch(/custom-class/);
  });
});
