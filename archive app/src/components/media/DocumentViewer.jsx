/**
 * DocumentViewer — renders different document types:
 * - image/jpeg, image/png, image/webp, image/* → <img>
 * - application/pdf                            → pdf.js canvas renderer (PdfViewer)
 * - other                                      → download link fallback
 *
 * pdfjs-dist is imported dynamically to keep the main bundle small.
 */
import { useState, useEffect, useRef } from "react";

export function DocumentViewer({ url, mimeType, fileName, pageCount }) {
  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  if (isImage) {
    return (
      <div className="flex justify-center bg-gray-900 rounded-xl overflow-hidden">
        <img
          src={url}
          alt={fileName || "مستند"}
          className="max-w-full max-h-screen object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  if (isPdf) {
    return <PdfViewer url={url} pageCount={pageCount} />;
  }

  // Generic fallback — offer a download link.
  return (
    <div className="flex flex-col items-center gap-4 p-8 bg-gray-900 rounded-xl">
      <span className="text-6xl" aria-hidden="true">📄</span>
      <p className="text-gray-300">{fileName || "ملف"}</p>
      <a
        href={url}
        download={fileName}
        className="px-4 py-2 va-accent-bg hover:bg-emerald-500 text-white rounded-lg transition-colors"
      >
        تحميل الملف
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal PDF viewer using pdf.js loaded dynamically.
// ---------------------------------------------------------------------------

function PdfViewer({ url, pageCount }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(pageCount || 1);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const pdfDocRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Use the CDN worker to avoid bundling the large worker script.
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const doc = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;

        if (cancelled) return;
        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
        await renderPage(doc, 1);
      } catch (err) {
        console.error("PDF load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function renderPage(doc, pageNum) {
    const page = await doc.getPage(pageNum);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  }

  async function goToPage(pageNum) {
    if (!pdfDocRef.current) return;
    setCurrentPage(pageNum);
    await renderPage(pdfDocRef.current, pageNum);
  }

  return (
    <div className="flex flex-col items-center gap-4" dir="ltr">
      {loading && (
        <div className="text-gray-400 py-8">جاري تحميل PDF...</div>
      )}
      <canvas ref={canvasRef} className="max-w-full shadow-xl rounded" />
      {totalPages > 1 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => goToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-white"
          >
            السابق
          </button>
          <span className="text-gray-300" dir="ltr">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-white"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
