import { TRANSFER_PACKAGE_TYPE } from "./packageFormat.js";
import {
  readArchiveExcelPackage,
  readTransferPackage
} from "./packageOperations.js";
import { safeJsonParse } from "./json.js";
import { validateBackupData } from "./validation.js";

export function isArchiveExcelImportFile(file = {}) {
  const name = String(file.name || "");
  const type = String(file.type || "");
  return /\.xlsx$/i.test(name) || type.includes("spreadsheetml");
}

export async function readArchiveImportFile(file, options = {}) {
  if (!file) return { valid: false, errors: ["لم يتم اختيار ملف للاستيراد"] };

  const {
    loadXlsx,
    normalizePayload = (payload) => payload,
    onParseError
  } = options;
  const isExcelFile = isArchiveExcelImportFile(file);

  if (isExcelFile) {
    if (typeof loadXlsx !== "function") {
      return { valid: false, errors: ["تعذر تحميل قارئ Excel"] };
    }
    const XLSX = await loadXlsx();
    const excelPackage = readArchiveExcelPackage(await file.arrayBuffer(), XLSX, { normalizePayload, onParseError });
    if (!excelPackage.valid) {
      return {
        valid: false,
        isExcelFile,
        sourceType: "excel",
        errors: excelPackage.errors || ["ملف Excel غير قابل للاستيراد"]
      };
    }

    return {
      valid: true,
      isExcelFile,
      sourceType: "excel",
      payload: excelPackage.payload,
      packageInfo: excelPackage.package
    };
  }

  const text = await file.text();
  const parsed = safeJsonParse(text, null, { onError: onParseError });
  if (!parsed || typeof parsed !== "object") {
    return { valid: false, isExcelFile, sourceType: "json", errors: ["ملف الاستيراد غير صالح أو تالف"] };
  }

  if (parsed.packageType === TRANSFER_PACKAGE_TYPE) {
    const transfer = readTransferPackage(text, { normalizePayload, onParseError });
    if (!transfer.valid) {
      return {
        valid: false,
        isExcelFile,
        sourceType: "transfer",
        errors: transfer.errors || ["ملف النقل غير صالح"]
      };
    }

    return {
      valid: true,
      isExcelFile,
      sourceType: "transfer",
      payload: transfer.payload,
      packageInfo: transfer.package
    };
  }

  const payload = normalizePayload(parsed);
  const validation = validateBackupData(payload);
  if (!validation.valid) {
    return { valid: false, isExcelFile, sourceType: "json", errors: validation.errors };
  }

  return {
    valid: true,
    isExcelFile,
    sourceType: "json",
    payload,
    packageInfo: null
  };
}
