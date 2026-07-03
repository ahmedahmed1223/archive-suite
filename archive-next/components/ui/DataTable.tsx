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
import { useRef, useState } from "react";
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

  return (
    <div className={cx("ui-data-table-wrap scroll-x", wrapperClassName)} ref={scrollRef} data-virtualized={virtualized ? "true" : "false"}>
      <table className={cx("data-table ui-data-table", tableClassName)} aria-label={ariaLabel}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      className="ui-data-table-sort"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                    </button>
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
