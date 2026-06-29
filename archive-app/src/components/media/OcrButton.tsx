/**
 * OcrButton — triggers OCR on an image document and surfaces the result.
 * Only rendered when the MIME type is an image (OCR is only meaningful for
 * image files; PDFs should use pdf.js text extraction instead).
 *
 * Props:
 *   file      {File|null}    - The File object if available locally.
 *   fileUrl   {string}       - URL to fetch the file from when `file` is absent.
 *   mimeType  {string}       - MIME type of the document.
 *   onResult  {(result)=>void} - Called with the raw PaddleOCR response.
 */
import { useState } from "react";
import { extractTextFromImage } from "../../services/ocrService.js";
import { useToast } from "../../hooks/useToast.js";

export function OcrButton({ file, fileUrl, mimeType, onResult }: any) {
  const [loading, setLoading] = useState(false);
  const { showToast, ToastContainer } = useToast();

  // OCR is only supported for image types.
  const isSupported = mimeType?.startsWith("image/");
  if (!isSupported) return null;

  async function handleOcr() {
    setLoading(true);
    try {
      // Prefer the File object; fall back to fetching from URL.
      let imageFile = file;
      if (!imageFile && fileUrl) {
        const resp = await fetch(fileUrl);
        const blob = await resp.blob();
        imageFile = new File([blob], "document.jpg", { type: mimeType });
      }
      if (!imageFile) throw new Error("لا يوجد ملف للتعرف الضوئي.");
      const result = await extractTextFromImage(imageFile);
      onResult?.(result);
      showToast({ message: "تم استخراج النص بنجاح", variant: "success" });
    } catch (err: any) {
      showToast({ message: err.message || "تعذّر التعرف الضوئي", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOcr}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
      >
        {loading ? "جاري التعرف على النص..." : "استخراج النص (OCR)"}
      </button>
      <ToastContainer />
    </>
  );
}
