/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardV2 } from "../CardV2.jsx";

describe("CardV2", () => {
  it("renders children inside the card", () => {
    render(<CardV2>محتوى البطاقة</CardV2>);
    expect(screen.getByText("محتوى البطاقة")).toBeInTheDocument();
  });

  it("applies solid variant border class by default", () => {
    const { container } = render(<CardV2>محتوى</CardV2>);
    expect((container.firstElementChild as HTMLElement).className).toMatch(/border-\[var\(--va-border-soft\)\]/);
  });

  it("applies subtle variant (no border-soft shadow)", () => {
    const { container } = render(<CardV2 variant="subtle">محتوى</CardV2>);
    expect((container.firstElementChild as HTMLElement).className).toMatch(/border-transparent/);
  });

  it("renders Header, Body, Footer compound parts", () => {
    render(
      <CardV2>
        <CardV2.Header>الرأس</CardV2.Header>
        <CardV2.Body>الجسم</CardV2.Body>
        <CardV2.Footer>الذيل</CardV2.Footer>
      </CardV2>
    );
    expect(screen.getByText("الرأس")).toBeInTheDocument();
    expect(screen.getByText("الجسم")).toBeInTheDocument();
    expect(screen.getByText("الذيل")).toBeInTheDocument();
  });

  it("CardV2.Header renders as a div with text content", () => {
    const { container } = render(<CardV2.Header>رأس</CardV2.Header>);
    expect(container.querySelector("div")).toBeInTheDocument();
    expect(screen.getByText("رأس")).toBeInTheDocument();
  });

  it("CardV2.Body renders with secondary text class", () => {
    const { container } = render(<CardV2.Body>جسم</CardV2.Body>);
    expect((container.firstElementChild as HTMLElement).className).toMatch(/va-text-2/);
  });

  it("CardV2.Footer renders with justify-end layout", () => {
    const { container } = render(<CardV2.Footer>تذييل</CardV2.Footer>);
    expect((container.firstElementChild as HTMLElement).className).toMatch(/justify-end/);
  });
});
