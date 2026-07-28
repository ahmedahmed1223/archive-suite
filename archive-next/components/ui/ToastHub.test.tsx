// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ToastProvider, ToastViewport } from "@/components/ui/Toast";
import ToastHub from "@/components/ui/ToastHub";
import { toastError, toastSuccess } from "@/lib/toast";

function renderHub() {
  return render(
    <ToastProvider swipeDirection="right">
      <ToastHub />
      <ToastViewport />
    </ToastProvider>
  );
}

afterEach(cleanup);

describe("ToastHub action button (V1-737)", () => {
  test("renders no action button for a plain toast", async () => {
    renderHub();
    toastSuccess("تم الحفظ بلا زر تراجع");

    expect(await screen.findByText("تم الحفظ بلا زر تراجع")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "تراجع" })).toBeNull();
  });

  test("renders the action button and fires its callback", async () => {
    renderHub();
    const onAction = vi.fn();
    toastSuccess("تم نقل السجل إلى سلة المحذوفات", { label: "تراجع", onAction });

    const undoButton = await screen.findByRole("button", { name: "تراجع" });
    fireEvent.click(undoButton);

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

/**
 * V1-303D: Radix already routes every toast through a live region, so the gap
 * was never "silent" — it was urgency. `foreground` (Radix's default) renders
 * aria-live="assertive", interrupting whatever the screen reader is mid-way
 * through. A save confirmation does not deserve to cut someone off; a failure
 * does. These assert the live region's politeness per tone, which is the part
 * a user actually experiences.
 */
describe("ToastHub screen-reader urgency (V1-303D)", () => {
  function liveRegionPoliteness(baseElement: HTMLElement): string[] {
    return Array.from(baseElement.querySelectorAll("[aria-live]")).map(
      (element) => element.getAttribute("aria-live") ?? "",
    );
  }

  test("announces a success politely so it never interrupts", async () => {
    const { baseElement } = renderHub();
    toastSuccess("تم حفظ السجل");

    await screen.findByText("تم حفظ السجل");

    expect(liveRegionPoliteness(baseElement)).toContain("polite");
    expect(liveRegionPoliteness(baseElement)).not.toContain("assertive");
  });

  test("announces an error assertively so it interrupts", async () => {
    const { baseElement } = renderHub();
    toastError("تعذر حفظ السجل");

    await screen.findByText("تعذر حفظ السجل");

    expect(liveRegionPoliteness(baseElement)).toContain("assertive");
  });
});
