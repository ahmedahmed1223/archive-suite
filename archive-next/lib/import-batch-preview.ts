// ponytail: pure per-file preview for any import batch (V1-857) — name/size/
// duration/checksum plus expected-duplicate detection against checksums the
// caller already has (attachments already fetched), no new API call here.
export interface ImportCandidateFile {
  name: string;
  size: number;
  checksum: string;
  durationSeconds?: number;
}

export interface ImportPreviewItem extends ImportCandidateFile {
  isDuplicate: boolean;
}

export function buildImportBatchPreview(
  files: readonly ImportCandidateFile[],
  existingChecksums: ReadonlySet<string>
): ImportPreviewItem[] {
  const seenInBatch = new Set<string>();

  return files.map((file) => {
    const isDuplicate = existingChecksums.has(file.checksum) || seenInBatch.has(file.checksum);
    seenInBatch.add(file.checksum);
    return { ...file, isDuplicate };
  });
}
