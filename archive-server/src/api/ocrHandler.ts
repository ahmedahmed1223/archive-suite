import type { IncomingMessage, ServerResponse } from "node:http";
import { createLogger } from "../logger.js";
import { config } from "../config/env.js";

const log = createLogger("ocr");
const OCR_URL = config.ocrServiceUrl;

export async function handleOcr(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!OCR_URL) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "خدمة التعرف الضوئي على النص غير مفعّلة. عيّن OCR_SERVICE_URL في ملف البيئة." }));
    return;
  }

  try {
    const MAX_OCR_BYTES = config.maxOcrBytes || (20 * 1024 * 1024);
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      totalBytes += (chunk as Buffer).length;
      if (totalBytes > MAX_OCR_BYTES!) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "الملف أكبر من الحد المسموح به (20 MB)." }));
        req.destroy();
        return;
      }
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);
    const contentType = req.headers["content-type"] || "application/octet-stream";

    const response = await fetch(`${OCR_URL}/ocr`, {
      method: "POST",
      headers: { "content-type": String(contentType), "content-length": String(body.length) },
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
