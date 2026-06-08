// OCR handler — proxies image files to the PaddleOCR microservice.
// Called by POST /api/ocr (multipart form-data with `file` field).

import { createLogger } from "../logger.js";

const log = createLogger("ocr");
const OCR_URL = process.env.OCR_SERVICE_URL;

export async function handleOcr(req, res) {
  if (!OCR_URL) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "خدمة التعرف الضوئي على النص غير مفعّلة. عيّن OCR_SERVICE_URL في ملف البيئة." }));
    return;
  }

  // Forward multipart request directly to OCR service using native fetch
  try {
    // Read body into buffer, enforcing a maximum size to prevent memory exhaustion.
    const MAX_OCR_BYTES = parseInt(process.env.MAX_OCR_BYTES || "", 10) || 20 * 1024 * 1024; // 20 MB
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_OCR_BYTES) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "الملف أكبر من الحد المسموح به (20 MB)." }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const contentType = req.headers["content-type"] || "application/octet-stream";

    const response = await fetch(`${OCR_URL}/ocr`, {
      method: "POST",
      headers: { "content-type": contentType, "content-length": String(body.length) },
      body,
    });

    const data = await response.json();
    res.writeHead(response.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  } catch (err) {
    log.error({ err }, "OCR upstream error");
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "تعذّر الاتصال بخدمة التعرف الضوئي على النص." }));
  }
}
