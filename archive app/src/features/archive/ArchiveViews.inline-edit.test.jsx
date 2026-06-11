/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { VideoTableView } from "./ArchiveViews.jsx";

const baseItem = {
  id: "item-1",
  title: "المادة الأولى",
  type: "video",
  subtype: "",
  tags: ["أرشيف"],
  metadata: {},
  updatedAt: "2026-06-11T09:00:00.000Z"
};

const typeOptions = [
  { value: "video", label: "فيديو" },
  { value: "document", label: "مستند" }
];

function renderTable(props = {}) {
  return render(
    <VideoTableView
      items={[baseItem]}
      previewItem={null}
      typeLabel={(item) => typeOptions.find((option) => option.value === item.type)?.label || item.type}
      subtypeLabel={() => ""}
      typeOptions={typeOptions}
      showDeleted={false}
      onPreview={() => {}}
      onOpen={() => {}}
      onFavorite={() => {}}
      onDelete={() => {}}
      onRestore={() => {}}
      itemSize="compact"
      disableRowMotion
      onCellSave={vi.fn()}
      {...props}
    />
  );
}

describe("VideoTableView inline cell editing", () => {
  it("moves to the next editable cell after saving with Tab", async () => {
    const onCellSave = vi.fn();
    renderTable({ onCellSave });

    fireEvent.click(screen.getByRole("button", { name: /تحرير عنوان/ }));

    const titleInput = screen.getByRole("textbox", { name: /عنوان المادة/ });
    fireEvent.change(titleInput, { target: { value: "عنوان محدث" } });
    fireEvent.keyDown(titleInput, { key: "Tab" });

    expect(onCellSave).toHaveBeenCalledWith(baseItem, { title: "عنوان محدث" });
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /اختر النوع/ })).toBeInTheDocument();
    });
  });

  it("moves to the previous editable cell with Shift+Tab even when value is unchanged", async () => {
    renderTable();

    fireEvent.click(screen.getByRole("button", { name: /تحرير نوع/ }));

    const typeSelect = screen.getByRole("combobox", { name: /اختر النوع/ });
    fireEvent.keyDown(typeSelect, { key: "Tab", shiftKey: true });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /عنوان المادة/ })).toBeInTheDocument();
    });
  });
});
