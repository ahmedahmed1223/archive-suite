/**
 * OCR service — calls the server-side PaddleOCR endpoint.
 * POST /api/ocr accepts multipart/form-data with a `file` field and returns
 * the raw PaddleOCR JSON response.  Auth uses the same Bearer-token pattern as
 * the rest of the cloud HTTP layer (JWT stored in localStorage by cloudSession).
 */
import { getCloudToken } from "../bootstrap/cloudSession.js";

/**
 * Extract text from an image file via the server-side PaddleOCR proxy.
 *
 * @param {File} imageFile  - A File (or Blob) to send for OCR.
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object>}  The raw PaddleOCR response object.
 * @throws {Error}  If the request fails or OCR service returns an error.
 */
export async function extractTextFromImage(imageFile, { signal } = {}) {
  const formData = new FormData();
  formData.append("file", imageFile);

  const headers = {};
  const token = getCloudToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch("/api/ocr", {
    method: "POST",
    body: formData,
    signal,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "فشل التعرف الضوئي على النص");
  }

  return await response.json();
}
