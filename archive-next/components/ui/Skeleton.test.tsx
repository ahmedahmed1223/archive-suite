// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { Skeleton } from "@/components/ui/Skeleton";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

afterEach(cleanup);

function renderSkeleton(node: ReactNode, locale: "ar" | "en" = "ar") {
  return render(<LocaleProvider initialLocale={locale} hasLocaleCookie>{node}</LocaleProvider>);
}

describe("Skeleton", () => {
  test("announces the loading label as a polite status", () => {
    renderSkeleton(<Skeleton label="جار تحميل السجلات..." />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("جار تحميل السجلات...")).toBeTruthy();
  });

  test("falls back to the localized generic loading label", () => {
    renderSkeleton(<Skeleton />);
    expect(screen.getByText("جارٍ التحميل…")).toBeTruthy();
  });

  test("hides the decorative bars from assistive technology", () => {
    const { container } = renderSkeleton(<Skeleton lines={3} />);

    const bars = container.querySelector(".ui-skeleton__bars");
    expect(bars?.getAttribute("aria-hidden")).toBe("true");
    expect(bars?.querySelectorAll(".ui-skeleton__bar").length).toBe(3);
  });

  test("renders the requested number of bars and defaults to three", () => {
    const { container, rerender } = renderSkeleton(<Skeleton />);
    expect(container.querySelectorAll(".ui-skeleton__bar").length).toBe(3);

    rerender(<LocaleProvider initialLocale="ar" hasLocaleCookie><Skeleton lines={5} /></LocaleProvider>);
    expect(container.querySelectorAll(".ui-skeleton__bar").length).toBe(5);
  });

  test("renders at least one bar when given a non-positive line count", () => {
    const { container } = renderSkeleton(<Skeleton lines={0} />);
    expect(container.querySelectorAll(".ui-skeleton__bar").length).toBe(1);
  });

  test("exposes the block variant and merges custom class names", () => {
    const { container } = renderSkeleton(<Skeleton className="my-skeleton" variant="block" />);

    const root = container.querySelector(".ui-skeleton");
    expect(root?.getAttribute("data-variant")).toBe("block");
    expect(root?.classList.contains("my-skeleton")).toBe(true);
  });
});
