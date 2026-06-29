/**
 * citationExport.ts — academic citation export (§20.4).
 *
 * Pure functions that turn archive records into BibTeX (.bib) and RIS (.ris)
 * entries for reference managers (Zotero, Mendeley, EndNote). No dependencies.
 *
 * Record shape mirrors recordToRow in exportService.js: each record has either
 * a `data` envelope or top-level fields (title, type, tags, createdAt, fileUrl…).
 */

interface ArchiveRecord {
  uid?: string;
  id?: string;
  data?: {
    title?: string;
    name?: string;
    documentType?: string;
    type?: string;
    tags?: string[];
    author?: string;
    createdBy?: string;
    project?: string;
    summary?: string;
    fileUrl?: string;
    url?: string;
    createdAt?: string;
    [key: string]: unknown;
  };
  createdAt?: string;
}

interface NormalizedFields {
  id: string;
  title: string;
  type: string;
  tags: string[];
  author: string;
  project: string;
  summary: string;
  url: string;
  year: string;
}

function field(record?: ArchiveRecord | null): NormalizedFields {
  const d = (record?.data ?? record ?? {}) as Record<string, unknown>;
  const created = String(d.createdAt ?? record?.createdAt ?? "");
  return {
    id: String(record?.uid ?? record?.id ?? ""),
    title: String(d.title ?? d.name ?? "بدون عنوان").trim(),
    type: String(d.documentType ?? d.type ?? "").toLowerCase(),
    tags: Array.isArray(d.tags) ? d.tags : (d.tags ? [String(d.tags)] : []),
    author: String(d.author ?? d.createdBy ?? "").trim(),
    project: String(d.project ?? "").trim(),
    summary: String(d.summary ?? "").trim(),
    url: String(d.fileUrl ?? d.url ?? "").trim(),
    year: /^\d{4}/.test(created) ? created.slice(0, 4) : "",
  };
}

// Map archive content types → citation entry types.
const BIBTEX_TYPE: Record<string, string> = { video: "misc", audio: "misc", document: "misc", image: "misc", article: "article", book: "book" };
const RIS_TYPE: Record<string, string> = { video: "VIDEO", audio: "SOUND", document: "GEN", image: "FIGURE", article: "JOUR", book: "BOOK" };

/** Stable, ASCII-safe BibTeX cite key from id + title + year. */
export function makeCiteKey(f: NormalizedFields): string {
  const slug = (f.title || "ref").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 16) || "ref";
  const idPart = (f.id || "").replace(/[^A-Za-z0-9]/g, "").slice(-6);
  return `${slug}${f.year || ""}${idPart}`;
}

// BibTeX values are wrapped in braces; escape the special characters.
function bibValue(value?: string | null): string {
  return String(value ?? "").replace(/([{}%&$#_])/g, "\\$1").replace(/[\r\n]+/g, " ").trim();
}

/** One BibTeX entry string for a record. */
export function recordToBibtex(record?: ArchiveRecord | null): string {
  const f = field(record);
  const entryType = BIBTEX_TYPE[f.type] || "misc";
  const lines = [`  title = {${bibValue(f.title)}}`];
  if (f.author) lines.push(`  author = {${bibValue(f.author)}}`);
  if (f.year) lines.push(`  year = {${bibValue(f.year)}}`);
  if (f.project) lines.push(`  publisher = {${bibValue(f.project)}}`);
  if (f.summary) lines.push(`  abstract = {${bibValue(f.summary)}}`);
  if (f.tags.length) lines.push(`  keywords = {${bibValue(f.tags.join(", "))}}`);
  // URLs and the archive id are kept raw — escaping "_"/"&" would break the
  // link; the surrounding braces already protect them from BibTeX parsing.
  if (f.url) lines.push(`  url = {${f.url.replace(/[\r\n]+/g, " ").trim()}}`);
  if (f.id) lines.push(`  note = {Archive ID: ${f.id}}`);
  return `@${entryType}{${makeCiteKey(f)},\n${lines.join(",\n")}\n}`;
}

/** One RIS entry string for a record. */
export function recordToRis(record?: ArchiveRecord | null): string {
  const f = field(record);
  const lines = [`TY  - ${RIS_TYPE[f.type] || "GEN"}`, `TI  - ${f.title}`];
  if (f.author) lines.push(`AU  - ${f.author}`);
  if (f.year) lines.push(`PY  - ${f.year}`);
  if (f.project) lines.push(`PB  - ${f.project}`);
  if (f.summary) lines.push(`AB  - ${f.summary.replace(/[\r\n]+/g, " ")}`);
  for (const tag of f.tags) lines.push(`KW  - ${tag}`);
  if (f.url) lines.push(`UR  - ${f.url}`);
  if (f.id) lines.push(`ID  - ${f.id}`);
  lines.push("ER  - ");
  return lines.join("\n");
}

/** Join many records into a single .bib document. */
export function recordsToBibtex(records: (ArchiveRecord | Record<string, unknown> | null | undefined)[] = []): string {
  return records.map((r) => recordToBibtex(r as ArchiveRecord | null)).join("\n\n") + "\n";
}

/** Join many records into a single .ris document. */
export function recordsToRis(records: (ArchiveRecord | Record<string, unknown> | null | undefined)[] = []): string {
  return records.map((r) => recordToRis(r as ArchiveRecord | null)).join("\n\n") + "\n";
}
