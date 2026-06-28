/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogV2 } from "../DialogV2.jsx";

/**
 * JSDOM does not implement HTMLDialogElement.showModal() / close().
 * Polyfill them so the useEffect inside DialogV2 works without throwing.
 */
beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

describe("DialogV2", () => {
  it("renders title and description when open", () => {
    render(
      <DialogV2 open onClose={vi.fn()} title="تأكيد" description="هل أنت متأكد؟">
        <p>محتوى</p>
      </DialogV2>
    );
    expect(screen.getByText("تأكيد")).toBeInTheDocument();
    expect(screen.getByText("هل أنت متأكد؟")).toBeInTheDocument();
  });

  it("renders children inside the dialog", () => {
    render(
      <DialogV2 open onClose={vi.fn()} title="نافذة">
        <span>محتوى النافذة</span>
      </DialogV2>
    );
    expect(screen.getByText("محتوى النافذة")).toBeInTheDocument();
  });

  it("has aria-modal=true on the dialog element", () => {
    const { container } = render(
      <DialogV2 open onClose={vi.fn()} title="نافذة">
        محتوى
      </DialogV2>
    );
    const dialog = container.querySelector("dialog")!;
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("wires aria-labelledby to title element id", () => {
    const { container } = render(
      <DialogV2 open onClose={vi.fn()} title="عنوان">
        محتوى
      </DialogV2>
    );
    const dialog = container.querySelector("dialog")!;
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(container.querySelector(`#${labelledBy}`)).toHaveTextContent("عنوان");
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <DialogV2 open onClose={onClose} title="نافذة">
        محتوى
      </DialogV2>
    );
    await user.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders footer content when footer prop is provided", () => {
    render(
      <DialogV2
        open
        onClose={vi.fn()}
        title="نافذة"
        footer={<button type="button">إلغاء</button>}
      >
        محتوى
      </DialogV2>
    );
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeInTheDocument();
  });

  it("has dir=rtl on the dialog element", () => {
    const { container } = render(
      <DialogV2 open onClose={vi.fn()}>
        محتوى
      </DialogV2>
    );
    expect(container.querySelector("dialog")).toHaveAttribute("dir", "rtl");
  });
});
