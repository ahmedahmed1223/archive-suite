/**
 * exportService.js
 * Generates export files from archive records.
 * Supports: csv, xlsx, zip (metadata JSON + file attachments stub)
 */
import { utils as XLSXUtils, write as XLSXWrite } from "xlsx";
import { recordsToBibtex, recordsToRis } from "./citationExport.js";

/** Build flat row from a storage record for CSV/XLSX export */
function recordToRow(record) {
  const d = record.data ?? record;
  return {
    id: record.uid ?? record.id ?? "",
    title: d.title ?? d.name ?? "",
    type: d.documentType ?? d.type ?? "",
    tags: Array.isArray(d.tags) ? d.tags.join(", ") : (d.tags ?? ""),
    project: d.project ?? "",
    summary: d.summary ?? "",
    ocrText: (d.ocrText ?? "").slice(0, 500),
    createdAt: d.createdAt ?? record.createdAt ?? "",
    updatedAt: d.updatedAt ?? record.updatedAt ?? "",
    fileUrl: d.fileUrl ?? d.url ?? "",
    mimeType: d.mimeType ?? "",
  };
}

export async function exportRecords(provider, { format = "csv", store = "videoItems", ids = null } = {}) {
  // Get all records from store
  let records = await provider.getAll(store).catch(() => []);

  // Filter by IDs if specified
  if (ids && ids.length > 0) {
    const idSet = new Set(ids.map(String));
    records = records.filter(r => idSet.has(String(r.uid ?? r.id ?? "")));
  }

  // Exclude deleted records
  records = records.filter(r => !(r.data?.isDeleted ?? r.isDeleted));

  // Academic citation formats operate on the raw records, not the flat rows.
  if (format === "bibtex") {
    return {
      contentType: "application/x-bibtex; charset=utf-8",
      filename: `archive-citations-${Date.now()}.bib`,
      buffer: Buffer.from(recordsToBibtex(records), "utf-8"),
    };
  }

  if (format === "ris") {
    return {
      contentType: "application/x-research-info-systems; charset=utf-8",
      filename: `archive-citations-${Date.now()}.ris`,
      buffer: Buffer.from(recordsToRis(records), "utf-8"),
    };
  }

  const rows = records.map(recordToRow);

  if (format === "csv") {
    const headers = Object.keys(rows[0] ?? recordToRow({}));
    const csvRows = [
      headers.join(","),
      ...rows.map(row => headers.map(h => JSON.stringify(row[h] ?? "")).join(","))
    ];
    return {
      contentType: "text/csv; charset=utf-8",
      filename: `archive-export-${Date.now()}.csv`,
      buffer: Buffer.from("﻿" + csvRows.join("\n"), "utf-8"), // BOM for Excel Arabic support
    };
  }

  if (format === "xlsx") {
    const ws = XLSXUtils.json_to_sheet(rows);
    const wb = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(wb, ws, "Archive");
    const buffer = XLSXWrite(wb, { type: "buffer", bookType: "xlsx" });
    return {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `archive-export-${Date.now()}.xlsx`,
      buffer,
    };
  }

  // ZIP: return JSON metadata as a fallback (full ZIP with file attachments is future work)
  if (format === "zip") {
    const json = JSON.stringify(
      { exportedAt: new Date().toISOString(), count: rows.length, records: rows },
      null,
      2
    );
    return {
      contentType: "application/json",
      filename: `archive-export-${Date.now()}.json`,
      buffer: Buffer.from(json, "utf-8"),
    };
  }

  throw new Error(`Unsupported format: ${format}`);
}
