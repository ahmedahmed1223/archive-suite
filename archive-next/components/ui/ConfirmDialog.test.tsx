// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ConfirmDialogProvider, useConfirmDialog, type ConfirmDialogApi } from "@/components/ui/ConfirmDialog";

let dialogApi: ConfirmDialogApi;

function ApiCapture() {
  dialogApi = useConfirmDialog();
  return null;
}

function renderProvider() {
  return render(
    <ConfirmDialogProvider>
      <ApiCapture />
    </ConfirmDialogProvider>
  );
}

afterEach(cleanup);

describe("ConfirmDialogProvider — confirm", () => {
  test("resolves true when the confirm button is clicked", async () => {
    renderProvider();
    const result = dialogApi.confirm({ message: "سيتم حذف السجل نهائيًا.", destructive: true });

    fireEvent.click(await screen.findByRole("button", { name: "تأكيد" }));

    await expect(result).resolves.toBe(true);
  });

  test("resolves false when the cancel button is clicked", async () => {
    renderProvider();
    const result = dialogApi.confirm({ message: "سيتم حذف السجل نهائيًا." });

    fireEvent.click(await screen.findByRole("button", { name: "إلغاء" }));

    await expect(result).resolves.toBe(false);
  });

  test("resolves false and closes when Escape is pressed", async () => {
    renderProvider();
    const result = dialogApi.confirm({ message: "سيتم حذف السجل نهائيًا." });
    const dialog = await screen.findByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });

    await expect(result).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("shows the impact message and moves initial focus to the safe cancel button", async () => {
    renderProvider();
    void dialogApi.confirm({ message: "تحذير: لا يمكن التراجع عن هذا الإجراء.", destructive: true });

    await screen.findByRole("dialog");
    expect(screen.getByText("تحذير: لا يمكن التراجع عن هذا الإجراء.")).toBeTruthy();
    const cancelButton = screen.getByRole("button", { name: "إلغاء" });
    await waitFor(() => expect(document.activeElement).toBe(cancelButton));
  });

  test("supports custom button labels", async () => {
    renderProvider();
    const result = dialogApi.confirm({ message: "حذف القاعدة؟", confirmLabel: "حذف", destructive: true });

    fireEvent.click(await screen.findByRole("button", { name: "حذف" }));

    await expect(result).resolves.toBe(true);
  });
});

describe("ConfirmDialogProvider — prompt", () => {
  test("resolves the typed value on submit", async () => {
    renderProvider();
    const result = dialogApi.prompt({ message: "اسم العرض المحفوظ" });

    const input = await screen.findByRole("textbox", { name: "اسم العرض المحفوظ" });
    fireEvent.change(input, { target: { value: "عرضي" } });
    fireEvent.click(screen.getByRole("button", { name: "موافق" }));

    await expect(result).resolves.toBe("عرضي");
  });

  test("prefills the default value and focuses the input", async () => {
    renderProvider();
    const result = dialogApi.prompt({ message: "اسم البحث المحفوظ", defaultValue: "بحث مخصص" });

    const input = await screen.findByRole("textbox", { name: "اسم البحث المحفوظ" });
    expect((input as HTMLInputElement).value).toBe("بحث مخصص");
    await waitFor(() => expect(document.activeElement).toBe(input));

    fireEvent.click(screen.getByRole("button", { name: "موافق" }));
    await expect(result).resolves.toBe("بحث مخصص");
  });

  test("resolves null on cancel", async () => {
    renderProvider();
    const result = dialogApi.prompt({ message: "اسم العرض المحفوظ" });

    fireEvent.click(await screen.findByRole("button", { name: "إلغاء" }));

    await expect(result).resolves.toBeNull();
  });

  test("resolves null when Escape closes the dialog", async () => {
    renderProvider();
    const result = dialogApi.prompt({ message: "اسم العرض المحفوظ" });
    const dialog = await screen.findByRole("dialog");

    fireEvent.keyDown(dialog, { key: "Escape" });

    await expect(result).resolves.toBeNull();
  });
});

describe("ConfirmDialogProvider — alert", () => {
  test("resolves when the close button is clicked and focuses it initially", async () => {
    renderProvider();
    const result = dialogApi.alert({ message: "فشل الإلغاء: خطأ في الخادم" });

    await screen.findByRole("dialog");
    expect(screen.getByText("فشل الإلغاء: خطأ في الخادم")).toBeTruthy();
    const closeButton = screen.getByRole("button", { name: "حسناً" });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));

    fireEvent.click(closeButton);
    await expect(result).resolves.toBeUndefined();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("useConfirmDialog", () => {
  test("throws outside the provider", () => {
    function Bare() {
      useConfirmDialog();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/ConfirmDialogProvider/);
  });
});
