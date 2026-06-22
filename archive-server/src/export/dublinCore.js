/**
 * dublinCore.js — Dublin Core metadata mapping (§22.x PBCore/DC export).
 *
 * Pure function. Maps an ArchiveItem / StorageRow record to the 15 standard
 * Dublin Core elements (http://purl.org/dc/elements/1.1/).
 *
 * Record shape: either a Prisma ArchiveItem (typed schema) or the generic
 * StorageRow envelope { uid, data: { title, … } } used by the SPA.
 */

/**
 * Normalise a record to a flat field bag regardless of whether it arrives as
 * a typed ArchiveItem or a generic StorageRow.
 *
 * @param {object} record
 * @returns {object} flat field bag
 */
function fields(record) {
  const d = record?.data ?? record ?? {};
  const createdAt = d.createdAt ?? record?.createdAt ?? "";
  return {
    id: String(record?.uid ?? record?.id ?? d?.id ?? "").trim(),
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

/**
 * Map a record to the 15 Dublin Core elements.
 * Missing fields are returned as empty strings so consumers can always rely on
 * every key being present.
 *
 * @param {object} item - ArchiveItem or StorageRow
 * @returns {{ title, creator, subject, description, publisher, contributor,
 *             date, type, format, identifier, source, language,
 *             relation, coverage, rights }} Dublin Core object
 */
export function toDublinCore(item) {
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
