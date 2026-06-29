/**
 * pbcore.ts — PBCore 2.1 metadata mapping (§22.x PBCore/DC export).
 *
 * Pure function. Maps an ArchiveItem / StorageRow record to the PBCore 2.1
 * element set (https://pbcore.org/pbcore-schema/).
 *
 * Record shape: either a Prisma ArchiveItem (typed schema) or the generic
 * StorageRow envelope { uid, data: { … } } used by the SPA.
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
    genre?: string;
    relation?: string;
    coverage?: string;
    rights?: string;
    license?: string;
    audienceLevel?: string;
    audienceRating?: string;
    duration?: string | number;
    durationMs?: string | number;
    fileKey?: string;
    url?: string;
    fileUrl?: string;
    fileSizeBytes?: number | null;
    [key: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface NormalizedPBCoreFields {
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
  genre: string;
  relation: string;
  coverage: string;
  rights: string;
  audienceLevel: string;
  audienceRating: string;
  duration: string;
  fileKey: string;
  fileSizeBytes: string;
}

/**
 * Normalise a record to a flat field bag regardless of storage envelope.
 */
function fields(record?: StorageRecord | null): NormalizedPBCoreFields {
  const d = (record?.data ?? record ?? {}) as Record<string, unknown>;
  return {
    id: String(record?.uid ?? record?.id ?? d.id ?? "").trim(),
    title: String(d.title ?? d.name ?? "").trim(),
    description: String(d.description ?? d.summary ?? "").trim(),
    tags: Array.isArray(d.tags) ? d.tags.map(String) : (d.tags ? [String(d.tags)] : []),
    type: String(d.documentType ?? d.type ?? "").trim(),
    mimeType: String(d.mimeType ?? "").trim(),
    language: String(d.language ?? "").trim(),
    createdAt: String(d.createdAt ?? record?.createdAt ?? "").trim(),
    updatedAt: String(d.updatedAt ?? record?.updatedAt ?? "").trim(),
    author: String(d.author ?? d.createdBy ?? "").trim(),
    publisher: String(d.publisher ?? d.project ?? "").trim(),
    contributor: String(d.contributor ?? "").trim(),
    genre: String(d.genre ?? "").trim(),
    relation: String(d.relation ?? "").trim(),
    coverage: String(d.coverage ?? "").trim(),
    rights: String(d.rights ?? d.license ?? "").trim(),
    audienceLevel: String(d.audienceLevel ?? "").trim(),
    audienceRating: String(d.audienceRating ?? "").trim(),
    // Instantiation / technical metadata
    duration: String(d.duration ?? d.durationMs ?? "").trim(),
    fileKey: String(d.fileKey ?? d.url ?? d.fileUrl ?? "").trim(),
    fileSizeBytes: d.fileSizeBytes != null ? String(d.fileSizeBytes) : "",
  };
}

/**
 * Map a PBCore asset type string from the archive content type.
 */
function mapAssetType(type: string): string {
  const map: Record<string, string> = {
    video: "Moving Image",
    audio: "Sound",
    document: "Text",
    image: "Image",
    pdf: "Text",
  };
  return map[type.toLowerCase()] || "Media";
}

interface PBCoreInstantiation {
  instantiationIdentifier: string;
  instantiationDate: string;
  instantiationDimensions: string;
  instantiationPhysical: string;
  instantiationDigital: string;
  instantiationStandard: string;
  instantiationLocation: string;
  instantiationMediaType: string;
  instantiationGenerations: string;
  instantiationFileSize: string;
  instantiationDuration: string;
  instantiationLanguage: string;
  instantiationChannelConfiguration: string;
  instantiationAlternativeModes: string;
  instantiationAnnotation: string;
}

/**
 * Build a PBCore instantiation object from file-level technical fields.
 */
function buildInstantiation(f: NormalizedPBCoreFields): PBCoreInstantiation {
  return {
    instantiationIdentifier: f.id,
    instantiationDate: f.createdAt ? f.createdAt.slice(0, 10) : "",
    instantiationDimensions: "",
    instantiationPhysical: "",
    instantiationDigital: f.mimeType,
    instantiationStandard: "",
    instantiationLocation: f.fileKey,
    instantiationMediaType: f.type,
    instantiationGenerations: "Original",
    instantiationFileSize: f.fileSizeBytes,
    instantiationDuration: f.duration,
    instantiationLanguage: f.language,
    instantiationChannelConfiguration: "",
    instantiationAlternativeModes: "",
    instantiationAnnotation: "",
  };
}

interface PBCoreElement {
  pbcoreAssetType: string;
  pbcoreAssetDate: string;
  pbcoreIdentifier: string;
  pbcoreTitle: string;
  pbcoreSubject: string[];
  pbcoreDescription: string;
  pbcoreGenre: string;
  pbcoreRelation: string;
  pbcoreCoverage: string;
  pbcoreAudienceLevel: string;
  pbcoreAudienceRating: string;
  pbcoreCreator: string;
  pbcoreContributor: string;
  pbcorePublisher: string;
  pbcoreRightsSummary: string;
  pbcoreInstantiation: PBCoreInstantiation;
}

interface ToPBCoreOptions {
  rights?: string;
}

/**
 * Map a record to the PBCore 2.1 element set.
 * Every key is always present; missing values are empty strings or empty arrays
 * so consumers can iterate without existence checks.
 */
export function toPBCore(item?: StorageRecord | null, { rights = "" }: ToPBCoreOptions = {}): PBCoreElement {
  const f = fields(item);
  const effectiveRights = rights || f.rights;

  return {
    pbcoreAssetType: mapAssetType(f.type),
    pbcoreAssetDate: f.createdAt ? f.createdAt.slice(0, 10) : "",
    pbcoreIdentifier: f.id,
    pbcoreTitle: f.title,
    pbcoreSubject: f.tags,                    // array — serialiser emits one element per entry
    pbcoreDescription: f.description,
    pbcoreGenre: f.genre,
    pbcoreRelation: f.relation,
    pbcoreCoverage: f.coverage,
    pbcoreAudienceLevel: f.audienceLevel,
    pbcoreAudienceRating: f.audienceRating,
    pbcoreCreator: f.author,
    pbcoreContributor: f.contributor,
    pbcorePublisher: f.publisher,
    pbcoreRightsSummary: effectiveRights,
    pbcoreInstantiation: buildInstantiation(f),
  };
}
