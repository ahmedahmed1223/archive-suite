// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ToastProvider, ToastViewport } from "@/components/ui/Toast";
import ToastHub from "@/components/ui/ToastHub";
import { toastSuccess } from "@/lib/toast";

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
