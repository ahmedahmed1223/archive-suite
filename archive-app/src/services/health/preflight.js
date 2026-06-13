export function createOperationSizeCheck(payloadSummary = {}, { formatFileSize } = {}) {
  const expectedRecords = Number(payloadSummary.records ?? payloadSummary.videoItems ?? payloadSummary.itemCount ?? 0);
  const expectedSize = Number(payloadSummary.estimatedSize ?? payloadSummary.fileSize ?? payloadSummary.size ?? 0);
  const formatSize = typeof formatFileSize === "function" ? formatFileSize : (value) => `${value} بايت`;

  return {
    id: "operation_size",
    label: "حجم العملية المتوقع",
    status: expectedSize > 120 * 1024 * 1024 || expectedRecords > 5e4 ? "warning" : "ok",
    message: [
      expectedRecords ? `${expectedRecords} سجل` : "عدد السجلات غير محدد",
      expectedSize ? formatSize(expectedSize) : "حجم غير محدد"
    ].join("، ")
  };
}

export function createSqliteReadinessCheck({ sqliteReady, sqliteError } = {}) {
  return {
    id: "sqlite",
    label: "SQLite",
    status: sqliteReady ? "ok" : "warning",
    message: sqliteReady ? "جاهز" : sqliteError || "SQLite غير مفعّل في هذه النسخة، التخزين المحلي يعمل عبر IndexedDB."
  };
}

export function createStorageEstimateCheck(estimate = {}, { formatFileSize } = {}) {
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const ratio = quota ? usage / quota : 0;
  const formatSize = typeof formatFileSize === "function" ? formatFileSize : (value) => `${value} بايت`;

  return {
    id: "storage",
    label: "المساحة",
    status: ratio > 0.92 ? "warning" : "ok",
    message: quota ? `${formatSize(usage)} مستخدمة من ${formatSize(quota)}` : "متاحة"
  };
}

export function formatPreflightSummary(report) {
  if (!report?.checks?.length) return "";
  return [
    "فحص ما قبل التنفيذ:",
    ...report.checks.map((check) => `${check.status === "ok" ? "✓" : check.status === "error" ? "!" : "•"} ${check.label}: ${check.message}`)
  ].join("\n");
}
