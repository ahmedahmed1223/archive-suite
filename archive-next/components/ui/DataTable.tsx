"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useId, useRef, useState } from "react";
import { cx } from "@/lib/css";

export interface DataTableProps<TData> {
  ariaLabel?: string;
  columns: Array<ColumnDef<TData, unknown>>;
  data: TData[];
  emptyMessage?: string;
  getRowId?: (row: TData, index: number) => string;
  tableClassName?: string;
  virtualized?: boolean;
  wrapperClassName?: string;
}

function getVisibleRows<TData>(rows: Array<Row<TData>>, virtualRows: Array<{ index: number }>, virtualized: boolean) {
  if (!virtualized) {
    return rows;
  }

  return virtualRows.map((virtualRow) => rows[virtualRow.index]).filter(Boolean);
}

export default function DataTable<TData>({
  ariaLabel,
  columns,
  data,
  emptyMessage = "لا توجد بيانات للعرض.",
  getRowId,
  tableClassName,
  virtualized = false,
  wrapperClassName
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableId = useId();
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: getRowId ? (row, index) => getRowId(row, index) : undefined
  });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
    enabled: virtualized
  });
  const virtualRows = virtualizer.getVirtualItems();
  const visibleRows = getVisibleRows(rows, virtualRows, virtualized);
  const paddingTop = virtualized && virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom =
    virtualized && virtualRows.length > 0
      ? Math.max(0, virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0))
      : 0;
  const sortSummary = sorting.length === 0
    ? "لا يوجد ترتيب مفعل."
    : `تم ترتيب الجدول حسب ${sorting.map(({ id, desc }) => `${id} ${desc ? "تنازليًا" : "تصاعديًا"}`).join("، ثم ")}.`;

  return (
    <div
      className={cx("ui-data-table-wrap scroll-x", wrapperClassName)}
      ref={scrollRef}
      data-virtualized={virtualized ? "true" : "false"}
      tabIndex={0}
      role="region"
      aria-label={ariaLabel ? `${ariaLabel} — منطقة جدول قابلة للتمرير` : "منطقة جدول قابلة للتمرير"}
      aria-describedby={`${tableId}-hint`}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        event.preventDefault();
        event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 64 : -64, behavior: "smooth" });
      }}
    >
      <p id={`${tableId}-hint`} className="ui-visually-hidden">عند الحاجة، ركّز على منطقة الجدول واستخدم السهمين الأيمن والأيسر للتمرير أفقيًا.</p>
      <p className="ui-visually-hidden" aria-live="polite" aria-atomic="true">{sortSummary}</p>
      <table className={cx("data-table ui-data-table", tableClassName)} aria-label={ariaLabel}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  style={{ width: header.getSize() }}
                  aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : undefined}
                >
                  {header.isPlaceholder ? null : (
                    header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="ui-data-table-sort"
                        onClick={header.column.getToggleSortingHandler()}
                        aria-label={`تبديل ترتيب عمود ${header.column.id}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span aria-hidden="true">{header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : " ↕"}</span>
                      </button>
                    ) : flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={columns.length} style={{ height: paddingTop }} />
            </tr>
          ) : null}
          {visibleRows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
          {paddingBottom > 0 ? (
            <tr aria-hidden="true">
              <td colSpan={columns.length} style={{ height: paddingBottom }} />
            </tr>
          ) : null}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="ui-data-table-empty">{emptyMessage}</p> : null}
    </div>
  );
}
