/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SwitchV2 } from "../SwitchV2.jsx";

describe("SwitchV2", () => {
  it("renders with role=switch", () => {
    render(<SwitchV2 />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("reflects checked=false via aria-checked=false", () => {
    render(<SwitchV2 checked={false} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("reflects checked=true via aria-checked=true", () => {
    render(<SwitchV2 checked={true} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with toggled value when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SwitchV2 checked={false} onChange={onChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when toggled from checked=true", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SwitchV2 checked={true} onChange={onChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not call onChange when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SwitchV2 checked={false} onChange={onChange} disabled />);
    // disabled switch has tabIndex=-1 so we click its parent hit-area wrapper
    const sw = screen.getByRole("switch");
    await user.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("has aria-disabled when disabled", () => {
    render(<SwitchV2 disabled />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "true");
  });

  it("toggles aria-checked via Space key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SwitchV2 checked={false} onChange={onChange} />);
    screen.getByRole("switch").focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles via Enter key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SwitchV2 checked={false} onChange={onChange} />);
    screen.getByRole("switch").focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders visible label when label prop is provided", () => {
    render(<SwitchV2 label="تفعيل الإشعارات" />);
    expect(screen.getByText("تفعيل الإشعارات")).toBeInTheDocument();
  });

  it("uncontrolled: toggles internal state when no value/onChange provided", async () => {
    const user = userEvent.setup();
    render(<SwitchV2 />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});
