// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import IconPicker from "@/components/IconPicker";

afterEach(cleanup);

describe("IconPicker (V1-794)", () => {
  test("renders a grid of icon buttons", () => {
    render(<IconPicker onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "FileText" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Video" })).toBeTruthy();
  });

  test("typing in the search box filters the visible buttons", () => {
    render(<IconPicker onChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "بحث عن أيقونة" }), {
      target: { value: "Video" }
    });
    expect(screen.getByRole("button", { name: "Video" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "FileText" })).toBeNull();
  });

  test("clicking an icon button calls onChange with that icon name", () => {
    const onChange = vi.fn();
    render(<IconPicker onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Folder" }));
    expect(onChange).toHaveBeenCalledWith("Folder");
  });

  test("the button matching value has aria-pressed true", () => {
    render(<IconPicker value="Star" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Star" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Folder" })).toHaveAttribute("aria-pressed", "false");
  });
});
