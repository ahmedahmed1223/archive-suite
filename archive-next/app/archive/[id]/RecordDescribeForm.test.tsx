// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ArchiveRecord } from "@/lib/archive-api";
import { RecordDescribeForm } from "./page";

afterEach(cleanup);

const record: ArchiveRecord = { id: "rec-1", title: "عنوان أصلي" };

function renderForm() {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<RecordDescribeForm record={record} onSave={onSave} />);
  return { onSave };
}

describe("RecordDescribeForm undo/redo (V1-732C)", () => {
  test("undo/redo buttons start disabled with nothing to undo or redo", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /^تراجع/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^إعادة/ })).toBeDisabled();
  });

  test("blurring a changed field creates a checkpoint that undo reverts", () => {
    renderForm();
    const titleInput = screen.getByLabelText("العنوان") as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: "عنوان جديد" } });
    fireEvent.blur(titleInput);
    expect(titleInput.value).toBe("عنوان جديد");

    fireEvent.click(screen.getByRole("button", { name: /^تراجع/ }));
    expect(titleInput.value).toBe("عنوان أصلي");
  });

  test("redo re-applies an undone change", () => {
    renderForm();
    const titleInput = screen.getByLabelText("العنوان") as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: "عنوان جديد" } });
    fireEvent.blur(titleInput);
    fireEvent.click(screen.getByRole("button", { name: /^تراجع/ }));
    expect(titleInput.value).toBe("عنوان أصلي");

    fireEvent.click(screen.getByRole("button", { name: /^إعادة/ }));
    expect(titleInput.value).toBe("عنوان جديد");
  });

  test("undoing an uncommitted edit (no blur yet) still reverts it", () => {
    renderForm();
    const titleInput = screen.getByLabelText("العنوان") as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: "لم يُحفظ بعد" } });
    expect(titleInput.value).toBe("لم يُحفظ بعد");

    fireEvent.click(screen.getByRole("button", { name: /^تراجع/ }));
    expect(titleInput.value).toBe("عنوان أصلي");
  });

  test("typing after an undo clears redo history", () => {
    renderForm();
    const titleInput = screen.getByLabelText("العنوان") as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: "أول تعديل" } });
    fireEvent.blur(titleInput);
    fireEvent.click(screen.getByRole("button", { name: /^تراجع/ }));
    expect(screen.getByRole("button", { name: /^إعادة/ })).not.toBeDisabled();

    fireEvent.change(titleInput, { target: { value: "تعديل آخر" } });
    fireEvent.blur(titleInput);
    expect(screen.getByRole("button", { name: /^إعادة/ })).toBeDisabled();
  });

  test("multiple checkpoints undo in reverse order", () => {
    renderForm();
    const titleInput = screen.getByLabelText("العنوان") as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: "تعديل ١" } });
    fireEvent.blur(titleInput);
    fireEvent.change(titleInput, { target: { value: "تعديل ٢" } });
    fireEvent.blur(titleInput);

    fireEvent.click(screen.getByRole("button", { name: /^تراجع/ }));
    expect(titleInput.value).toBe("تعديل ١");
    fireEvent.click(screen.getByRole("button", { name: /^تراجع/ }));
    expect(titleInput.value).toBe("عنوان أصلي");
    expect(screen.getByRole("button", { name: /^تراجع/ })).toBeDisabled();
  });
});
