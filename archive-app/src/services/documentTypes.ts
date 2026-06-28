export type DocumentType = "image" | "pdf" | "document" | "spreadsheet" | "file" | "video" | "audio";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  image: "صورة",
  pdf: "PDF",
  document: "مستند",
  spreadsheet: "جدول",
  file: "ملف",
  video: "فيديو",
  audio: "صوت"
};

export function detectDocumentType(file: Pick<File, "type" | "name">): { documentType: DocumentType; mimeType: string } {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return { documentType: "image", mimeType: mime };
  if (mime === "application/pdf") return { documentType: "pdf", mimeType: mime };
  if (mime.startsWith("video/")) return { documentType: "video", mimeType: mime };
  if (mime.startsWith("audio/")) return { documentType: "audio", mimeType: mime };
  if (mime.includes("word") || mime.includes("document")) return { documentType: "document", mimeType: mime };
  if (mime.includes("spreadsheet") || mime.includes("excel")) return { documentType: "spreadsheet", mimeType: mime };

  const ext = file.name.split(".").pop()?.toLowerCase();
  const extMap: Partial<Record<string, DocumentType>> = {
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
    xls: "spreadsheet"
  };
  return {
    documentType: extMap[ext || ""] || "file",
    mimeType: mime || `application/${ext || "octet-stream"}`
  };
}
