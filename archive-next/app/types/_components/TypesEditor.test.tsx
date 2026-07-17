// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import TypesEditor from "./TypesEditor";

afterEach(cleanup);

function renderEditor(overrides: Partial<React.ComponentProps<typeof TypesEditor>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <TypesEditor
      initialType={null}
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onSave, onCancel };
}

describe("TypesEditor instant field validation (V1-768)", () => {
  test("does not show an error before a field is touched", () => {
    renderEditor();
    expect(screen.queryByText("أدخل معرّف النوع.")).toBeNull();
  });

  test("shows an inline error under the type id field on blur when empty", () => {
    renderEditor();
    const idInput = screen.getByLabelText(/معرّف النوع/);

    fireEvent.blur(idInput);

    expect(screen.getByText("أدخل معرّف النوع.")).toBeTruthy();
  });

  test("clears the type id error once a value is entered", () => {
    renderEditor();
    const idInput = screen.getByLabelText(/معرّف النوع/);

    fireEvent.blur(idInput);
    expect(screen.getByText("أدخل معرّف النوع.")).toBeTruthy();

    fireEvent.change(idInput, { target: { value: "document" } });
    expect(screen.queryByText("أدخل معرّف النوع.")).toBeNull();
  });

  test("shows an inline error under a field name on blur when empty", () => {
    renderEditor();
    const fieldNameInput = screen.getByLabelText("اسم الحقل");

    fireEvent.blur(fieldNameInput);

    expect(screen.getByText("أدخل اسمًا لهذا الحقل.")).toBeTruthy();
  });

  test("flags duplicate field names inline once both are touched", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "إضافة حقل" }));

    const fieldNameInputs = screen.getAllByLabelText("اسم الحقل");
    fireEvent.change(fieldNameInputs[0], { target: { value: "ملاحظات" } });
    fireEvent.change(fieldNameInputs[1], { target: { value: "ملاحظات" } });
    fireEvent.blur(fieldNameInputs[0]);
    fireEvent.blur(fieldNameInputs[1]);

    expect(screen.getAllByText("اسم الحقل «ملاحظات» مكرر.")).toHaveLength(2);
  });

  test("flags an incomplete conditional display rule inline once touched", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("checkbox", { name: "عرض مشروط" }));

    const equalsInput = screen.getByLabelText("يساوي");
    fireEvent.blur(equalsInput);

    expect(screen.getByText("أدخل الحقل المصدر وقيمة المقارنة لهذا العرض المشروط.")).toBeTruthy();
  });

  test("submitting an invalid form touches every field so all inline errors surface at once", async () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "حفظ النوع" }));

    expect(await screen.findByText("أدخل معرّف النوع.")).toBeTruthy();
    expect(screen.getByText("أدخل اسم النوع.")).toBeTruthy();
    expect(screen.getByText("أدخل اسمًا لهذا الحقل.")).toBeTruthy();
  });
});
