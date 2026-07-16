// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { StatusBadge, type StatusBadgeTone } from "./page";

afterEach(cleanup);

describe("StatusBadge", () => {
  test("renders a distinguishing icon per tone, not just a color class", () => {
    const tones: StatusBadgeTone[] = ["success", "warning", "danger", "info", "neutral"];
    const shapes = new Set<string>();

    tones.forEach((tone) => {
      const { container } = render(<StatusBadge tone={tone}>حالة</StatusBadge>);
      const icon = container.querySelector("svg");
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      // Each tone must render a visually distinct icon (different lucide class name),
      // so status is not conveyed by the badge's color alone.
      shapes.add(icon?.getAttribute("class") || "");
      cleanup();
    });

    expect(shapes.size).toBe(tones.length);
  });

  test("defaults to the neutral tone when none is supplied", () => {
    const { container } = render(<StatusBadge>قراءة فقط</StatusBadge>);
    const badge = container.querySelector(".badge");
    expect(badge?.getAttribute("data-tone")).toBe("neutral");
    expect(badge?.textContent).toContain("قراءة فقط");
  });

  test("applies the tone-specific color class alongside the icon", () => {
    const { container } = render(<StatusBadge tone="danger">فشل الاتصال</StatusBadge>);
    const badge = container.querySelector(".badge");
    expect(badge?.classList.contains("badge-danger")).toBe(true);
  });
});
