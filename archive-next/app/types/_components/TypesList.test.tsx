// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import TypesList from "./TypesList";

afterEach(() => {
  cleanup();
  window.localStorage?.clear?.();
});

const TYPES = [
  { id: "document", name: "مستند", fields: [] },
  { id: "photo", name: "صورة", fields: [] }
];

function renderList() {
  return render(
    <TypesList
      types={TYPES}
      selectedTypeId={null}
      deletingTypeId={null}
      onSelectType={vi.fn()}
      onEditType={vi.fn()}
      onDeleteType={vi.fn()}
      onCreateType={vi.fn()}
    />
  );
}

describe("TypesList icon rendering (V1-794)", () => {
  test("falls back to the first letter of the name when no icon is assigned", () => {
    renderList();
    expect(screen.getByText("م")).toBeTruthy();
  });

  test("renders the assigned lucide icon instead of the letter mark", () => {
    render(
      <TypesList
        types={[{ id: "document", name: "مستند", icon: "FileText", fields: [] }]}
        selectedTypeId={null}
        deletingTypeId={null}
        onSelectType={vi.fn()}
        onEditType={vi.fn()}
        onDeleteType={vi.fn()}
        onCreateType={vi.fn()}
      />
    );
    expect(screen.queryByText("م")).toBeNull();
    expect(document.querySelector("svg.lucide-file-text")).not.toBeNull();
  });
});
