/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InputV2 } from "../InputV2.jsx";

describe("InputV2", () => {
  it("renders a textbox by default", () => {
    render(<InputV2 />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with associated label via htmlFor", () => {
    render(<InputV2 id="email-field" label="البريد الإلكتروني" />);
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeInTheDocument();
  });

  it("sets aria-invalid when error is provided", () => {
    render(<InputV2 label="الاسم" error="حقل مطلوب" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("renders error message with role=alert", () => {
    render(<InputV2 error="حقل مطلوب" />);
    expect(screen.getByRole("alert")).toHaveTextContent("حقل مطلوب");
  });

  it("renders helper text without alert role when no error", () => {
    render(<InputV2 helperText="أدخل اسمك الكامل" />);
    const help = screen.getByText("أدخل اسمك الكامل");
    expect(help).toBeInTheDocument();
    expect(help).not.toHaveAttribute("role", "alert");
  });

  it("does NOT set aria-invalid when no error", () => {
    render(<InputV2 label="اسم" />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
  });

  it("renders prefix slot content", () => {
    render(<InputV2 prefix={<span data-testid="pfx">@</span>} />);
    expect(screen.getByTestId("pfx")).toBeInTheDocument();
  });

  it("renders suffix slot content", () => {
    render(<InputV2 suffix={<span data-testid="sfx">ج.م</span>} />);
    expect(screen.getByTestId("sfx")).toBeInTheDocument();
  });

  it("forwards ref to the input element", () => {
    const ref = React.createRef();
    render(<InputV2 ref={ref} />);
    expect(ref.current?.tagName).toBe("INPUT");
  });
});
