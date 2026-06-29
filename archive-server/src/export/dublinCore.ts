/**
 * dublinCore.ts — Dublin Core metadata mapping (§22.x PBCore/DC export).
 *
 * Pure function. Maps an ArchiveItem / StorageRow record to the 15 standard
 * Dublin Core elements (http://purl.org/dc/elements/1.1/).
 *
 * Record shape: either a Prisma ArchiveItem (typed schema) or the generic
 * StorageRow envelope { uid, data: { title, … } } used by the SPA.
 */

interface StorageRecord {
  uid?: string;
  id?: string;
  data?: {
    title?: string;
    name?: string;
    description?: string;
    summary?: string;
    tags?: string[] | string;
    documentType?: string;
    type?: string;
    mimeType?: string;
    language?: string;
    createdAt?: string;
    updatedAt?: string;
    author?: string;
    createdBy?: string;
    publisher?: string;
    project?: string;
    contributor?: string;
    source?: string;
    fileUrl?: string;
    url?: string;
    relation?: string;
    coverage?: string;
    rights?: string;
    license?: string;
    [key: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface NormalizedDCFields {
  id: string;
  title: string;
  description: string;
  tags: string[];
  type: string;
  mimeType: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  author: string;
  publisher: string;
  contributor: string;
  source: string;
  relation: string;
  coverage: string;
  rights: string;
}

/**
 * Normalise a record to a flat field bag regardless of whether it arrives as
 * a typed ArchiveItem or a generic StorageRow.
 */
function fields(record?: StorageRecord | null): NormalizedDCFields {
  const d = (record?.data ?? record ?? {}) as Record<string, unknown>;
  const createdAt = String(d.createdAt ?? record?.createdAt ?? "");
  return {
    id: String(record?.uid ?? record?.id ?? d.id ?? "").trim(),
    title: String(d.title ?? d.name ?? "").trim(),
    description: String(d.description ?? d.summary ?? "").trim(),
    tags: Array.isArray(d.tags) ? d.tags.map(String) : (d.tags ? [String(d.tags)] : []),
    type: String(d.documentType ?? d.type ?? "").trim(),
    mimeType: String(d.mimeType ?? "").trim(),
    language: String(d.language ?? "").trim(),
    createdAt,
    updatedAt: String(d.updatedAt ?? record?.updatedAt ?? "").trim(),
    author: String(d.author ?? d.createdBy ?? "").trim(),
    publisher: String(d.publisher ?? d.project ?? "").trim(),
    contributor: String(d.contributor ?? "").trim(),
    source: String(d.source ?? d.fileUrl ?? d.url ?? "").trim(),
    relation: String(d.relation ?? "").trim(),
    coverage: String(d.coverage ?? "").trim(),
    rights: String(d.rights ?? d.license ?? "").trim(),
  };
}

interface DublinCoreElement {
  title: string;
  creator: string;
  subject: string;
  description: string;
  publisher: string;
  contributor: string;
  date: string;
  type: string;
  format: string;
  identifier: string;
  source: string;
  language: string;
  relation: string;
  coverage: string;
  rights: string;
}

/**
 * Map a record to the 15 Dublin Core elements.
 * Missing fields are returned as empty strings so consumers can always rely on
 * every key being present.
 */
export function toDublinCore(item?: StorageRecord | null): DublinCoreElement {
  const f = fields(item);

  return {
    title: f.title,
    creator: f.author,
    subject: f.tags.join("; "),
    description: f.description,
    publisher: f.publisher,
    contributor: f.contributor,
    date: f.createdAt ? f.createdAt.slice(0, 10) : "",   // ISO date portion
    type: f.type,
    format: f.mimeType,
    identifier: f.id,
    source: f.source,
    language: f.language,
    relation: f.relation,
    coverage: f.coverage,
    rights: f.rights,
  };
}
