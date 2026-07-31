// ponytail: pure suggestion function (V1-846) — no rename happens here, caller decides
export interface FilenameSuggestionInput {
  originalName: string;
  type?: string;
  title?: string;
  createdAt?: string;
}

function slugify(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-");
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
}

/** تاريخ بصيغة YYYY-MM-DD من `createdAt`، أو فارغ إن تعذّر التحليل. */
function dateSegment(createdAt?: string): string {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/**
 * يقترح اسمًا موحّدًا: [نوع]-[تاريخ]-[عنوان مبسّط][الامتداد الأصلي].
 * الأجزاء الغائبة تُحذف بلا شرطات زائدة. لا يُطبَّق تلقائيًا — الاسم الأصلي دومًا خيار متاح.
 */
export function suggestFilename(input: FilenameSuggestionInput): string {
  const ext = extensionOf(input.originalName);
  const parts = [input.type, dateSegment(input.createdAt), input.title ? slugify(input.title) : undefined].filter(
    (part): part is string => Boolean(part && part.length > 0)
  );
  if (parts.length === 0) return input.originalName;
  return `${parts.join("-")}${ext}`;
}

export function deviatesFromSuggestion(input: FilenameSuggestionInput): boolean {
  return suggestFilename(input) !== input.originalName;
}
