/**
 * DocumentViewer — renders different document types:
 * - image/jpeg, image/png, image/webp, image/* → <img>
 * - application/pdf                            → pdf.js canvas renderer (PdfViewer)
 * - other                                      → download link fallback
 *
 * pdfjs-dist is imported dynamically to keep the main bundle small.
 */
import { useState, useEffect, useRef } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, ZoomIn, ZoomOut } from "lucide-react";

export function clampPdfPage(value: any, totalPages: any) {
  const total = Math.max(1, Number(totalPages) || 1);
  return Math.max(1, Math.min(total, Math.round(Number(value) || 1)));
}

export function PdfPageNavigation({ currentPage, totalPages, onPageChange, zoom = 1.5, onZoomChange }: any) {
  const [draft, setDraft] = useState(String(currentPage));
  useEffect(() => setDraft(String(currentPage)), [currentPage]);
  const submit = (event: any) => {
    event.preventDefault();
    const next = clampPdfPage(draft, totalPages);
    setDraft(String(next));
    onPageChange?.(next);
  };
  const iconButton = "btn btn-square btn-ghost btn-sm";
  return (
    <div className="sticky top-0 z-10 flex w-full flex-wrap items-center justify-center gap-2 border-b border-base-300 bg-base-100/95 p-2 shadow-sm backdrop-blur" dir="rtl" aria-label="أدوات تنقل PDF">
      <div className="join" dir="ltr">
        <button type="button" className={`${iconButton} join-item`} onClick={() => onPageChange?.(1)} disabled={currentPage <= 1} aria-label="الصفحة الأولى" title="الصفحة الأولى"><ChevronFirst className="h-4 w-4" /></button>
        <button type="button" className={`${iconButton} join-item`} onClick={() => onPageChange?.(currentPage - 1)} disabled={currentPage <= 1} aria-label="الصفحة السابقة" title="الصفحة السابقة"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" className={`${iconButton} join-item`} onClick={() => onPageChange?.(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="الصفحة التالية" title="الصفحة التالية"><ChevronRight className="h-4 w-4" /></button>
        <button type="button" className={`${iconButton} join-item`} onClick={() => onPageChange?.(totalPages)} disabled={currentPage >= totalPages} aria-label="الصفحة الأخيرة" title="الصفحة الأخيرة"><ChevronLast className="h-4 w-4" /></button>
      </div>
      <form onSubmit={submit} className="flex items-center gap-1.5 text-sm">
        <label htmlFor="pdf-page-number">صفحة</label>
        <input id="pdf-page-number" value={draft} onChange={(event: any) => setDraft(event.target.value)} inputMode="numeric" className="input input-bordered input-sm w-16 text-center" dir="ltr" aria-label="رقم صفحة PDF" />
        <span dir="ltr">/ {totalPages}</span>
        <button type="submit" className="btn btn-neutral btn-sm">انتقال</button>
      </form>
      <div className="join" dir="ltr">
        <button type="button" className={`${iconButton} join-item`} onClick={() => onZoomChange?.(Math.max(0.75, zoom - 0.25))} disabled={zoom <= 0.75} aria-label="تصغير PDF" title="تصغير"><ZoomOut className="h-4 w-4" /></button>
        <button type="button" className="btn btn-ghost btn-sm join-item min-w-16" onClick={() => onZoomChange?.(1.5)} aria-label="إعادة التكبير الافتراضي">{Math.round((zoom / 1.5) * 100)}%</button>
        <button type="button" className={`${iconButton} join-item`} onClick={() => onZoomChange?.(Math.min(3, zoom + 0.25))} disabled={zoom >= 3} aria-label="تكبير PDF" title="تكبير"><ZoomIn className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function DocumentViewer({ url, mimeType, fileName, pageCount }: any) {
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
      <FileText className="h-14 w-14 text-base-content/45" aria-hidden="true" />
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

function PdfViewer({ url, pageCount }: any) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(pageCount || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1.5);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const canvasRef = useRef(null);
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError("");
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Use the CDN worker to avoid bundling the large worker script.
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const doc = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;

        if (cancelled) return;
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      } catch (err: any) {
        console.error("PDF load error:", err);
        if (!cancelled) setError(err?.message || "تعذّر تحميل ملف PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    const render = async () => {
      try {
        const page = await (pdfDoc as any).getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const viewport = page.getViewport({ scale: zoom });
        (canvas as any).width = viewport.width;
        (canvas as any).height = viewport.height;
        await page.render({ canvasContext: (canvas as any).getContext("2d"), viewport }).promise;
      } catch (renderError: any) {
        if (!cancelled) setError(renderError?.message || "تعذّر عرض صفحة PDF.");
      }
    };
    render();
    return () => { cancelled = true; };
  }, [currentPage, pdfDoc, zoom]);

  function goToPage(pageNum: any) {
    if (!pdfDocRef.current) return;
    setCurrentPage(clampPdfPage(pageNum, totalPages));
  }

  return (
    <div className="flex max-h-[85vh] flex-col overflow-hidden border border-base-300 bg-base-200/40" dir="ltr">
      <PdfPageNavigation currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} zoom={zoom} onZoomChange={setZoom} />
      <div className="flex items-center justify-end gap-1 border-b border-base-300 bg-base-100 px-2 py-1" dir="rtl">
        <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-xs gap-1"><ExternalLink className="h-3.5 w-3.5" />فتح منفصل</a>
        <a href={url} download className="btn btn-ghost btn-xs gap-1"><Download className="h-3.5 w-3.5" />تنزيل</a>
      </div>
      {loading && (
        <div className="text-gray-400 py-8">جاري تحميل PDF...</div>
      )}
      {error && <div className="alert alert-error m-3" dir="rtl"><span>{error}</span></div>}
      <div className="min-h-0 flex-1 overflow-auto p-3 text-center">
        <canvas ref={canvasRef} className="mx-auto max-w-none rounded bg-white shadow-xl" aria-label={`صفحة PDF ${currentPage}`} />
      </div>
    </div>
  );
}
