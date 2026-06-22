/**
 * exportService.js
 * Generates export files from archive records.
 * Supports: csv, xlsx, xlsx-template, pdf, zip (metadata JSON + file attachments stub)
 */
import fs from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { utils as XLSXUtils, write as XLSXWrite } from "xlsx";
import { recordsToBibtex, recordsToRis } from "./citationExport.js";

const EXPORT_COLUMNS = [
  { key: "id", label: "المعرّف", description: "معرّف السجل الداخلي", example: "rec_123" },
  { key: "title", label: "العنوان", description: "عنوان العنصر في الأرشيف", example: "محاضرة يونيو 2026" },
  { key: "type", label: "النوع", description: "نوع المحتوى أو المستند", example: "video / pdf / image" },
  { key: "tags", label: "الوسوم", description: "وسوم مفصولة بفاصلة", example: "بحث, أرشفة" },
  { key: "project", label: "المشروع", description: "المشروع أو المجموعة", example: "مشروع التوثيق" },
  { key: "summary", label: "الملخص", description: "وصف قصير قابل للتحرير", example: "ملخص مختصر للمحتوى" },
  { key: "ocrText", label: "نص OCR", description: "أول 500 حرف من النص المستخرج", example: "نص مستخرج..." },
  { key: "createdAt", label: "تاريخ الإنشاء", description: "تاريخ إنشاء السجل", example: "2026-06-13T10:00:00.000Z" },
  { key: "updatedAt", label: "آخر تحديث", description: "تاريخ آخر تعديل", example: "2026-06-13T11:00:00.000Z" },
  { key: "fileUrl", label: "رابط الملف", description: "رابط الملف أو المصدر", example: "https://example.com/file.pdf" },
  { key: "mimeType", label: "MIME", description: "نوع MIME عند توفره", example: "application/pdf" },
];

import { config } from "../config/env.js";

const PDF_FONT_CANDIDATES = [
  config.pdfFontPath,
  "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "C:/Windows/Fonts/arial.ttf",
  "C:/Windows/Fonts/tahoma.ttf",
].filter(Boolean);

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

function rowsToSheet(rows) {
  const worksheet = XLSXUtils.json_to_sheet(rows, { header: EXPORT_COLUMNS.map(c => c.key) });
  XLSXUtils.sheet_add_aoa(worksheet, [EXPORT_COLUMNS.map(c => c.label)], { origin: "A1" });
  worksheet["!cols"] = EXPORT_COLUMNS.map((column) => ({
    wch: Math.max(column.label.length + 4, column.example.length + 4, 14),
  }));
  worksheet["!autofilter"] = { ref: XLSXUtils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: EXPORT_COLUMNS.length - 1 } }) };
  return worksheet;
}

function buildWorkbook(rows, { template = false } = {}) {
  const workbook = XLSXUtils.book_new();
  XLSXUtils.book_append_sheet(workbook, rowsToSheet(rows), template ? "بيانات الأرشيف" : "Archive");

  if (template) {
    const instructions = [
      ["Archive Suite - قالب تصدير قابل للتخصيص"],
      ["عدّل القيم في ورقة بيانات الأرشيف، وأبقِ أسماء الأعمدة كما هي عند إعادة الاستيراد أو المشاركة."],
      [],
      ["الحقل", "الوصف", "مثال"],
      ...EXPORT_COLUMNS.map((column) => [column.label, column.description, column.example]),
    ];
    const instructionSheet = XLSXUtils.aoa_to_sheet(instructions);
    instructionSheet["!cols"] = [{ wch: 24 }, { wch: 54 }, { wch: 32 }];
    XLSXUtils.book_append_sheet(workbook, instructionSheet, "تعليمات");

    const options = [
      ["الخيار", "القيمة", "ملاحظات"],
      ["generatedAt", new Date().toISOString(), "وقت إنشاء القالب"],
      ["rowCount", rows.length, "عدد السجلات المصدّرة"],
      ["supportedFormats", "csv,xlsx,pdf,bibtex,ris,zip", "صيغ التصدير المتاحة"],
      ["customFields", "", "أضف أعمدة مخصصة بعد أعمدة النظام عند الحاجة"],
    ];
    const optionsSheet = XLSXUtils.aoa_to_sheet(options);
    optionsSheet["!cols"] = [{ wch: 22 }, { wch: 36 }, { wch: 48 }];
    XLSXUtils.book_append_sheet(workbook, optionsSheet, "إعدادات القالب");
  }

  return workbook;
}

async function loadPdfFont(pdfDoc) {
  pdfDoc.registerFontkit(fontkit);
  for (const candidate of PDF_FONT_CANDIDATES) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        const bytes = fs.readFileSync(candidate);
        return { font: await pdfDoc.embedFont(bytes, { subset: true }), unicode: true, source: candidate };
      }
    } catch {
      // Try the next candidate and fall back to Helvetica if none are usable.
    }
  }
  return { font: await pdfDoc.embedFont(StandardFonts.Helvetica), unicode: false, source: "Helvetica" };
}

function pdfText(text, unicode) {
  const value = String(text ?? "");
  if (unicode) return value;
  return value.replace(/[^\x20-\x7E]/g, "").trim() || "Archive";
}

function wrapText(text, font, size, maxWidth, unicode) {
  const words = pdfText(text, unicode).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function buildPdfReport(rows) {
  const pdfDoc = await PDFDocument.create();
  const { font, unicode, source } = await loadPdfFont(pdfDoc);
  const boldFont = unicode ? font : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize = [595.28, 841.89]; // A4
  const margin = 42;
  let page = pdfDoc.addPage(pageSize);
  let y = page.getHeight() - margin;

  const addPageIfNeeded = (needed = 40) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage(pageSize);
      y = page.getHeight() - margin;
    }
  };
  const draw = (text, x, size = 10, color = rgb(0.13, 0.16, 0.22), selectedFont = font) => {
    page.drawText(pdfText(text, unicode), { x, y, size, font: selectedFont, color });
  };
  const paragraph = (text, x, width, size = 10, leading = 15) => {
    for (const line of wrapText(text, font, size, width, unicode)) {
      addPageIfNeeded(leading);
      draw(line, x, size);
      y -= leading;
    }
  };

  page.drawRectangle({ x: 0, y: page.getHeight() - 118, width: page.getWidth(), height: 118, color: rgb(0.06, 0.12, 0.18) });
  draw("تقرير Archive Suite", margin, 24, rgb(1, 1, 1), boldFont);
  y -= 30;
  draw(`عدد السجلات: ${rows.length}`, margin, 11, rgb(0.86, 0.93, 1));
  y -= 18;
  draw(`تاريخ التصدير: ${new Date().toISOString()}`, margin, 10, rgb(0.76, 0.85, 0.95));
  y -= 45;

  const typeCounts = rows.reduce((acc, row) => {
    const type = row.type || "unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  draw("ملخص المحتوى", margin, 16, rgb(0.04, 0.09, 0.16), boldFont);
  y -= 22;
  paragraph(Object.entries(typeCounts).map(([type, count]) => `${type}: ${count}`).join("   |   ") || "لا توجد سجلات.", margin, page.getWidth() - margin * 2, 10);
  y -= 8;

  draw("السجلات", margin, 15, rgb(0.04, 0.09, 0.16), boldFont);
  y -= 20;
  for (const [index, row] of rows.slice(0, 60).entries()) {
    addPageIfNeeded(70);
    page.drawRectangle({ x: margin, y: y - 44, width: page.getWidth() - margin * 2, height: 52, borderColor: rgb(0.82, 0.86, 0.91), borderWidth: 0.6, color: index % 2 ? rgb(0.98, 0.99, 1) : rgb(1, 1, 1) });
    draw(`${index + 1}. ${row.title || row.id || "بدون عنوان"}`, margin + 12, 11, rgb(0.04, 0.09, 0.16), boldFont);
    y -= 16;
    paragraph(`النوع: ${row.type || "-"} | المشروع: ${row.project || "-"} | الوسوم: ${row.tags || "-"}`, margin + 12, page.getWidth() - margin * 2 - 24, 8.5, 12);
    if (row.summary) paragraph(row.summary, margin + 12, page.getWidth() - margin * 2 - 24, 8.5, 12);
    y -= 12;
  }

  if (rows.length > 60) {
    addPageIfNeeded(28);
    draw(`تم عرض أول 60 سجلاً من أصل ${rows.length}. استخدم Excel للتفاصيل الكاملة.`, margin, 10, rgb(0.45, 0.25, 0.05), boldFont);
  }
  page.drawText(pdfText(`Font: ${source}`, unicode), { x: margin, y: 18, size: 7, font, color: rgb(0.55, 0.58, 0.64) });
  return Buffer.from(await pdfDoc.save());
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
    const wb = buildWorkbook(rows);
    const buffer = XLSXWrite(wb, { type: "buffer", bookType: "xlsx" });
    return {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `archive-export-${Date.now()}.xlsx`,
      buffer,
    };
  }

  if (format === "xlsx-template") {
    const wb = buildWorkbook(rows, { template: true });
    const buffer = XLSXWrite(wb, { type: "buffer", bookType: "xlsx" });
    return {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: `archive-template-${Date.now()}.xlsx`,
      buffer,
    };
  }

  if (format === "pdf") {
    return {
      contentType: "application/pdf",
      filename: `archive-report-${Date.now()}.pdf`,
      buffer: await buildPdfReport(rows),
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
