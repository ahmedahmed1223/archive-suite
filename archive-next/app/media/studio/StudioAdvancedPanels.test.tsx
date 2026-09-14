// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import StudioAdvancedPanels from "./StudioAdvancedPanels";
import styles from "./studio.module.css";

describe("StudioAdvancedPanels", () => {
  test("reveals the advanced media panels on demand for narrow workspaces", () => {
    render(
      <StudioAdvancedPanels label="الإصدارات والمهام">
        <p>محتوى المشتقات والمهام</p>
      </StudioAdvancedPanels>
    );

    const toggle = screen.getByRole("button", { name: "الإصدارات والمهام" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("محتوى المشتقات والمهام").parentElement).not.toHaveClass(styles.isOpen);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("محتوى المشتقات والمهام").parentElement).toHaveClass(styles.isOpen);
  });
});
