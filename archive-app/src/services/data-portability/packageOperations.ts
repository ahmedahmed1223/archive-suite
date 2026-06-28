import {
  EXCEL_ARCHIVE_CHUNK_SIZE,
  EXCEL_ARCHIVE_PACKAGE_TYPE,
  EXCEL_ARCHIVE_PAYLOAD_SHEET,
  EXCEL_ARCHIVE_SCHEMA_VERSION,
  TRANSFER_APP_VERSION,
  TRANSFER_PACKAGE_TYPE,
  TRANSFER_SCHEMA_VERSION,
  stableStringifyForChecksum
} from "./packageFormat.js";
import {
  createPortableArchivePayload,
  getPortablePayloadCounts
} from "./payload.js";
import { validateBackupData } from "./validation.js";
import { calculateTransferChecksum } from "./checksum.js";
import { safeJsonParse, sanitizePlainData } from "./json.js";

export function createTransferPackage(state: any, sourceDevice: any, options: any = {}): any {
  const payload = createPortableArchivePayload(state);
  const cleanPayload = sanitizePlainData(payload);
  const checksum = calculateTransferChecksum(stableStringifyForChecksum(cleanPayload));
  const deviceMeta = typeof sourceDevice === "string"
    ? { deviceName: sourceDevice }
    : (sourceDevice && typeof sourceDevice === "object" ? sourceDevice : {});
  const sourceDeviceName = deviceMeta.deviceName || "جهاز غير مسمى";
  const sourceDeviceId = deviceMeta.deviceId || null;

  return {
    packageType: TRANSFER_PACKAGE_TYPE,
    schemaVersion: TRANSFER_SCHEMA_VERSION,
    appVersion: TRANSFER_APP_VERSION,
    exportedAt: new Date().toISOString(),
    sourceDeviceName,
    sourceDeviceId,
    targetDeviceId: options.targetDeviceId || null,
    mode: options.mode || "full",
    baseSyncFloor: options.baseSyncFloor || null,
    counts: getPortablePayloadCounts(cleanPayload),
    checksum,
    payload: cleanPayload
  };
}

function normalizePackagePayload(rawPayload: any, options: any = {}): any {
  const cleanPayload = sanitizePlainData(rawPayload);
  return typeof options.normalizePayload === "function"
    ? options.normalizePayload(cleanPayload)
    : cleanPayload;
}

export function readTransferPackage(text: string, options: any = {}): any {
  const parsed = safeJsonParse(text, null, { onError: options.onParseError });
  if (!parsed || typeof parsed !== "object") {
    return { valid: false, errors: ["ملف النقل غير صالح أو تالف"] };
  }

  const rawPayload = sanitizePlainData((parsed as any).packageType === TRANSFER_PACKAGE_TYPE ? (parsed as any).payload : parsed);
  const payload = normalizePackagePayload(rawPayload, options);
  if (!payload || typeof payload !== "object") {
    return { valid: false, errors: ["ملف النقل لا يحتوي بيانات قابلة للقراءة"] };
  }

  const validation = validateBackupData(payload);
  if (!validation.valid) return { valid: false, errors: validation.errors };

  if ((parsed as any).packageType === TRANSFER_PACKAGE_TYPE && (parsed as any).checksum) {
    const actualChecksum = calculateTransferChecksum(stableStringifyForChecksum(rawPayload));
    if (actualChecksum !== (parsed as any).checksum) {
      return { valid: false, errors: ["فشل التحقق من سلامة الملف. قد يكون الملف تالفا أو معدلا."] };
    }
  }

  return {
    valid: true,
    package: (parsed as any).packageType === TRANSFER_PACKAGE_TYPE
      ? { ...(parsed as Record<string, unknown>), payload }
      : createTransferPackage(
        typeof options.createFallbackPackageState === "function"
          ? options.createFallbackPackageState(payload, rawPayload)
          : payload,
        "ملف قديم"
      ),
    payload
  };
}

export function createArchiveExcelPackagePayload(state: any): any {
  const payload = createPortableArchivePayload(state);
  const cleanPayload = sanitizePlainData(payload);
  const payloadJson = JSON.stringify(cleanPayload);
  const checksum = calculateTransferChecksum(stableStringifyForChecksum(cleanPayload));
  const chunks: string[] = [];

  for (let index = 0; index < payloadJson.length; index += EXCEL_ARCHIVE_CHUNK_SIZE) {
    chunks.push(payloadJson.slice(index, index + EXCEL_ARCHIVE_CHUNK_SIZE));
  }

  const exportedAt = new Date().toISOString();
  const rows = [
    { key: "packageType", value: EXCEL_ARCHIVE_PACKAGE_TYPE },
    { key: "schemaVersion", value: String(EXCEL_ARCHIVE_SCHEMA_VERSION) },
    { key: "appVersion", value: TRANSFER_APP_VERSION },
    { key: "exportedAt", value: exportedAt },
    { key: "checksum", value: checksum },
    { key: "chunkCount", value: String(chunks.length) },
    ...chunks.map((chunk, index) => ({ key: `chunk_${String(index).padStart(3, "0")}`, value: chunk }))
  ];

  return { rows, payload: cleanPayload, checksum, exportedAt, chunkCount: chunks.length };
}

export function appendArchiveExcelPayloadSheet(XLSX: any, workbook: any, state: any): any {
  const archivePackage = createArchiveExcelPackagePayload(state);
  const worksheet = XLSX.utils.json_to_sheet(archivePackage.rows);
  worksheet["!cols"] = [{ wch: 24 }, { wch: 96 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, EXCEL_ARCHIVE_PAYLOAD_SHEET);
  workbook.Workbook = workbook.Workbook || {};
  workbook.Workbook.Sheets = workbook.SheetNames.map((name: string) => ({
    name,
    Hidden: name === EXCEL_ARCHIVE_PAYLOAD_SHEET ? 1 : 0
  }));
  return archivePackage;
}

const XLSX_MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export function readArchiveExcelPackage(arrayBuffer: ArrayBuffer, XLSX: any, options: any = {}): any {
  if (arrayBuffer.byteLength > XLSX_MAX_IMPORT_BYTES) {
    return { valid: false, errors: ["حجم ملف Excel يتجاوز الحد المسموح به (20MB)."] };
  }

  const magic = new Uint8Array(arrayBuffer.slice(0, 4));
  const isOOXML = magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 0x03 && magic[3] === 0x04;
  if (!isOOXML) {
    return { valid: false, errors: ["صيغة ملف Excel غير مدعومة. يُقبل ملف .xlsx فقط (OpenXML)."] };
  }

  try {
    const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dense: true });
    const ws = wb.Sheets?.[EXCEL_ARCHIVE_PAYLOAD_SHEET];
    if (!ws) {
      return { valid: false, errors: ["هذا الملف للعرض والتحليل فقط، ولا يمكن استيراده بأمان في v1 لأنه لا يحتوي حزمة بيانات التطبيق."] };
    }

    const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
    const values = new Map(rows.map((row: any) => [String(row.key || "").trim(), String(row.value || "")]));
    if (values.get("packageType") !== EXCEL_ARCHIVE_PACKAGE_TYPE) {
      return { valid: false, errors: ["ملف Excel لا يحتوي حزمة أرشيف فيديو صالحة."] };
    }

    const chunkCount = Number(values.get("chunkCount") || 0);
    if (!Number.isFinite(chunkCount) || chunkCount <= 0) {
      return { valid: false, errors: ["حزمة Excel لا تحتوي أجزاء بيانات قابلة للقراءة."] };
    }

    const payloadText = Array.from({ length: chunkCount }, (_, index) => values.get(`chunk_${String(index).padStart(3, "0")}`) || "").join("");
    const parsedPayload = safeJsonParse(payloadText, null, { onError: options.onParseError });
    const rawPayload = sanitizePlainData(parsedPayload);
    if (!rawPayload) {
      return { valid: false, errors: ["تعذر قراءة بيانات Excel المخفية. قد يكون الملف تالفاً أو معدلاً."] };
    }

    const checksum = values.get("checksum");
    if (checksum && checksum !== calculateTransferChecksum(stableStringifyForChecksum(rawPayload))) {
      return { valid: false, errors: ["فشل التحقق من سلامة ملف Excel. قد يكون الملف معدلاً بعد التصدير."] };
    }

    const payload = normalizePackagePayload(rawPayload, options);
    const validation = validateBackupData(payload);
    if (!validation.valid) return { valid: false, errors: validation.errors };

    return {
      valid: true,
      payload,
      package: {
        packageType: EXCEL_ARCHIVE_PACKAGE_TYPE,
        schemaVersion: Number(values.get("schemaVersion") || EXCEL_ARCHIVE_SCHEMA_VERSION),
        exportedAt: values.get("exportedAt"),
        checksum,
        counts: getPortablePayloadCounts(payload)
      }
    };
  } catch (error: any) {
    return { valid: false, errors: [error?.message || "فشل قراءة ملف Excel"] };
  }
}
