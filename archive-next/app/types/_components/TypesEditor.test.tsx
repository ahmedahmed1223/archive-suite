// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import TypesEditor from "./TypesEditor";
import { loadDraft } from "@/lib/local-draft";
import { getTypeIcon, setTypeIcon } from "@/lib/type-icons";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderEditor(overrides: Partial<React.ComponentProps<typeof TypesEditor>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  const result = render(
    <TypesEditor
      initialType={null}
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onSave, onCancel, ...result };
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

describe("TypesEditor autosave draft (V1-769)", () => {
  test("does not show a restore banner when there is no saved draft", () => {
    renderEditor();
    expect(screen.queryByText(/يوجد نوع غير محفوظ/)).toBeNull();
  });

  test("autosaves a non-empty new-type draft and offers to restore it on next mount", () => {
    const { unmount } = renderEditor();
    fireEvent.change(screen.getByLabelText(/معرّف النوع/), { target: { value: "document" } });
    unmount();

    expect(loadDraft("types-editor-new")).not.toBeNull();

    renderEditor();
    expect(screen.getByText(/يوجد نوع غير محفوظ/)).toBeTruthy();
  });

  test("restoring the draft fills the form back in and dismisses the banner", () => {
    const { unmount } = renderEditor();
    fireEvent.change(screen.getByLabelText(/معرّف النوع/), { target: { value: "document" } });
    unmount();

    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "استعادة المسودة" }));

    expect(screen.getByLabelText(/معرّف النوع/)).toHaveProperty("value", "document");
    expect(screen.queryByText(/يوجد نوع غير محفوظ/)).toBeNull();
  });

  test("discarding the draft clears storage and does not restore it later", () => {
    const { unmount } = renderEditor();
    fireEvent.change(screen.getByLabelText(/معرّف النوع/), { target: { value: "document" } });
    unmount();

    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "تجاهل" }));
    expect(loadDraft("types-editor-new")).toBeNull();

    cleanup();
    renderEditor();
    expect(screen.queryByText(/يوجد نوع غير محفوظ/)).toBeNull();
  });

  test("does not autosave a draft while editing an existing type", () => {
    const existing = {
      id: "document",
      name: "مستند",
      fields: [{ name: "العنوان", type: "text" as const, fieldAcl: { view: [], edit: [] } }]
    };
    const { unmount } = renderEditor({ initialType: existing });
    fireEvent.change(screen.getByLabelText(/اسم النوع/), { target: { value: "مستند معدّل" } });
    unmount();

    expect(loadDraft("types-editor-new")).toBeNull();
  });

  test("clears the draft after a successful save", async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText(/معرّف النوع/), { target: { value: "document" } });
    fireEvent.change(screen.getByLabelText(/اسم النوع/), { target: { value: "مستند" } });
    fireEvent.change(screen.getByLabelText("اسم الحقل"), { target: { value: "العنوان" } });

    fireEvent.click(screen.getByRole("button", { name: "حفظ النوع" }));

    await vi.waitFor(() => expect(loadDraft("types-editor-new")).toBeNull());
  });
});

describe("TypesEditor icon picker (V1-794)", () => {
  test("shows no icon selected by default for a new type", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: "FileText" })).toHaveAttribute("aria-pressed", "false");
  });

  test("preselects the icon previously saved for an existing type", () => {
    const existing = {
      id: "document",
      name: "مستند",
      fields: [{ name: "العنوان", type: "text" as const, fieldAcl: { view: [], edit: [] } }]
    };
    setTypeIcon("document", "FileText");

    renderEditor({ initialType: existing });

    expect(screen.getByRole("button", { name: "FileText" })).toHaveAttribute("aria-pressed", "true");
  });

  test("persists the chosen icon under the saved type id on submit", async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText(/معرّف النوع/), { target: { value: "document" } });
    fireEvent.change(screen.getByLabelText(/اسم النوع/), { target: { value: "مستند" } });
    fireEvent.change(screen.getByLabelText("اسم الحقل"), { target: { value: "العنوان" } });
    fireEvent.click(screen.getByRole("button", { name: "FileText" }));

    fireEvent.click(screen.getByRole("button", { name: "حفظ النوع" }));

    await vi.waitFor(() => expect(getTypeIcon("document")).toBe("FileText"));
  });
});
