/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { InlineCellEditor } from "./InlineCellEditor.jsx";

describe("InlineCellEditor keyboard navigation", () => {
  it("commits with next-cell navigation metadata on Tab", () => {
    const onSave = vi.fn();

    render(
      <InlineCellEditor
        value="عنوان قديم"
        isEditing
        placeholder="عنوان المادة"
        onSave={onSave}
      />
    );

    const input = screen.getByRole("textbox", { name: /عنوان المادة/ });
    fireEvent.change(input, { target: { value: "عنوان جديد" } });
    fireEvent.keyDown(input, { key: "Tab" });

    expect(onSave).toHaveBeenCalledWith("عنوان جديد", { navigationDirection: "next" });
  });

  it("commits with previous-cell navigation metadata on Shift+Tab", () => {
    const onSave = vi.fn();

    render(
      <InlineCellEditor
        value="وسم"
        isEditing
        placeholder="وسوم مفصولة بفواصل"
        onSave={onSave}
      />
    );

    const input = screen.getByRole("textbox", { name: /وسوم مفصولة بفواصل/ });
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });

    expect(onSave).toHaveBeenCalledWith("وسم", { navigationDirection: "previous" });
  });
});
