// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StorageOperationPanel from "./StorageOperationPanel";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

afterEach(cleanup);

function renderPanel(node: ReactNode) {
  return render(<LocaleProvider initialLocale="ar" hasLocaleCookie>{node}</LocaleProvider>);
}

describe("StorageOperationPanel", () => {
  it("confirms a preview and lets the operator cancel it", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderPanel(<StorageOperationPanel operation={{ id: "op-1", type: "نقل", status: "preview", completedItems: 0, totalItems: 2, conflict: "copy" }} onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "تأكيد العملية" }));
    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByText("تعارض اسم: السياسة المختارة إنشاء نسخة.")).toBeInTheDocument();
  });

  it("moves focus to a review and cancels a preview with Escape", async () => {
    const onCancel = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    renderPanel(<StorageOperationPanel operation={{ id: "op-1", type: "نقل", status: "preview", completedItems: 0, totalItems: 2 }} onCancel={onCancel} />);

    const panel = screen.getByLabelText("حالة نقل الملفات");
    expect(panel).toHaveFocus();
    fireEvent.keyDown(panel, { key: "Escape" });
    await Promise.resolve();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
