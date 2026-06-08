/**
 * Document type detection and label helpers.
 * Classifies a File by MIME type (falling back to extension) and returns a
 * { documentType, mimeType } pair suitable for storing on archive items.
 */

/** Mapping from documentType key to Arabic display label. */
export const DOCUMENT_TYPE_LABELS = {
  image: "صورة",
  pdf: "PDF",
  document: "مستند",
  spreadsheet: "جدول",
  file: "ملف",
  video: "فيديو",
  audio: "صوت",
};

/**
 * Detect the document type for a given File.
 *
 * @param {File} file
 * @returns {{ documentType: string, mimeType: string }}
 */
export function detectDocumentType(file) {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return { documentType: "image", mimeType: mime };
  if (mime === "application/pdf") return { documentType: "pdf", mimeType: mime };
  if (mime.startsWith("video/")) return { documentType: "video", mimeType: mime };
  if (mime.startsWith("audio/")) return { documentType: "audio", mimeType: mime };
  if (mime.includes("word") || mime.includes("document")) return { documentType: "document", mimeType: mime };
  if (mime.includes("spreadsheet") || mime.includes("excel")) return { documentType: "spreadsheet", mimeType: mime };

  // Fall back to file extension when MIME type is missing or generic.
  const ext = file.name.split(".").pop()?.toLowerCase();
  const extMap = {
    pdf: "pdf",
    jpg: "image",
    jpeg: "image",
    png: "image",
    webp: "image",
    gif: "image",
    svg: "image",
    avif: "image",
    mp4: "video",
    webm: "video",
    mov: "video",
    mkv: "video",
    mp3: "audio",
    wav: "audio",
    m4a: "audio",
    ogg: "audio",
    flac: "audio",
    docx: "document",
    doc: "document",
    xlsx: "spreadsheet",
    xls: "spreadsheet",
  };
  return {
    documentType: extMap[ext] || "file",
    mimeType: mime || `application/${ext || "octet-stream"}`,
  };
}
