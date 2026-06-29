/**
 * Enterprise backup manifest — pure functions, no I/O.
 *
 * Manifest entry schema:
 * {
 *   backupId:   string,          // unique id (e.g. UUID or timestamp slug)
 *   createdAt:  string,          // ISO-8601 timestamp
 *   sizeBytes:  number,
 *   sha256:     string,          // hex SHA-256 of the object stored in S3
 *   region:     string,          // AWS region
 *   bucket:     string,
 *   key:        string,          // full S3 object key
 *   encryption: "aes-256-gcm" | "none"
 * }
 */

export interface ManifestEntry {
  backupId: string;
  createdAt: string;
  sizeBytes: number;
  sha256: string;
  region: string;
  bucket: string;
  key: string;
  encryption: "aes-256-gcm" | "none";
}

interface FindRestorableOptions {
  before?: string;
  region?: string;
}

/**
 * Return a new entries array with the given entry appended.
 * Entries are kept in ascending createdAt order.
 */
export function appendBackupManifestEntry(entries: ManifestEntry[], entry: ManifestEntry): ManifestEntry[] {
  if (!Array.isArray(entries)) {
    throw new TypeError("appendBackupManifestEntry: entries must be an array.");
  }
  if (!entry || typeof entry !== "object") {
    throw new TypeError("appendBackupManifestEntry: entry must be an object.");
  }
  validateEntry(entry);
  return [...entries, { ...entry }];
}

/**
 * Find the latest manifest entry matching the given filter.
 */
export function findRestorableEntry(entries: ManifestEntry[], { before, region }: FindRestorableOptions = {}): ManifestEntry | null {
  if (!Array.isArray(entries)) {
    throw new TypeError("findRestorableEntry: entries must be an array.");
  }

  let filtered = entries;

  if (region) {
    filtered = filtered.filter((e) => e.region === region);
  }

  if (before) {
    const cutoff = new Date(before).getTime();
    if (Number.isNaN(cutoff)) {
      throw new TypeError("findRestorableEntry: 'before' must be a valid ISO-8601 date string.");
    }
    filtered = filtered.filter((e) => new Date(e.createdAt).getTime() < cutoff);
  }

  if (filtered.length === 0) return null;

  // Return the entry with the most-recent createdAt
  return filtered.reduce((latest, e) =>
    new Date(e.createdAt).getTime() > new Date(latest.createdAt).getTime() ? e : latest
  );
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: (keyof ManifestEntry)[] = ["backupId", "createdAt", "sizeBytes", "sha256", "region", "bucket", "key", "encryption"];
const VALID_ENCRYPTION = new Set(["aes-256-gcm", "none"]);

function validateEntry(entry: ManifestEntry): void {
  for (const field of REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === null) {
      throw new TypeError(`appendBackupManifestEntry: entry.${field} is required.`);
    }
  }
  if (!VALID_ENCRYPTION.has(entry.encryption)) {
    throw new TypeError(`appendBackupManifestEntry: entry.encryption must be "aes-256-gcm" or "none".`);
  }
  if (typeof entry.sizeBytes !== "number" || entry.sizeBytes < 0) {
    throw new TypeError("appendBackupManifestEntry: entry.sizeBytes must be a non-negative number.");
  }
}
