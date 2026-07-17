// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/ui/DataTable";

type Row = { id: string; title: string; type: string };

const columns: Array<ColumnDef<Row, unknown>> = [
  { id: "title", header: "العنوان", accessorKey: "title" },
  { id: "type", header: "النوع", accessorKey: "type" }
];

const data: Row[] = [{ id: "1", title: "سجل تجريبي", type: "مستند" }];

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("DataTable column visibility (V1-746)", () => {
  test("does not render a columns menu when no storage key is given", () => {
    render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} />);
    expect(screen.queryByRole("button", { name: "الأعمدة" })).toBeNull();
  });

  test("hiding a column via the menu removes it from the table and persists the choice", () => {
    render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} columnVisibilityStorageKey="test-table" />);

    fireEvent.click(screen.getByRole("button", { name: "الأعمدة" }));
    expect(screen.getByRole("columnheader", { name: "النوع" })).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "النوع" }));
    expect(screen.queryByRole("columnheader", { name: "النوع" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "العنوان" })).toBeTruthy();

    const stored = window.localStorage.getItem("masar.view-state:anon:table-columns-test-table");
    expect(stored && JSON.parse(stored).columnVisibility).toEqual({ type: false });
  });

  test("restores a previously hidden column on the next mount", () => {
    window.localStorage.setItem(
      "masar.view-state:anon:table-columns-test-table",
      JSON.stringify({ columnVisibility: { type: false } })
    );

    render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} columnVisibilityStorageKey="test-table" />);

    expect(screen.queryByRole("columnheader", { name: "النوع" })).toBeNull();
  });

  test("closes the menu on Escape", () => {
    render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} columnVisibilityStorageKey="test-table" />);

    fireEvent.click(screen.getByRole("button", { name: "الأعمدة" }));
    expect(screen.getByRole("checkbox", { name: "العنوان" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("checkbox", { name: "العنوان" })).toBeNull();
  });
});
