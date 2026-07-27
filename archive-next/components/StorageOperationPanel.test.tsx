// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StorageOperationPanel from "./StorageOperationPanel";

describe("StorageOperationPanel", () => {
  it("confirms a preview and lets the operator cancel it", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<StorageOperationPanel operation={{ id: "op-1", type: "نقل", status: "preview", completedItems: 0, totalItems: 2, conflict: "copy" }} onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "تأكيد العملية" }));
    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByText("تعارض اسم: السياسة المختارة إنشاء نسخة.")).toBeInTheDocument();
  });
});
