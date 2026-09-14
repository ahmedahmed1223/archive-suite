export function mediaComparisonHref(recordId: string, store: string | null | undefined): string {
  const params = new URLSearchParams({ recordId });
  const normalizedStore = store?.trim();
  if (normalizedStore && normalizedStore !== "archive-items") {
    params.set("store", normalizedStore);
  }
  return `/media/compare?${params.toString()}`;
}

/**
 * Keeps the record context when an archivist moves from its descriptive
 * workbench to the media studio. The studio can then show its valid empty
 * media state when no playable source exists, rather than losing the record.
 */
export function mediaStudioHref(recordId: string): string {
  return `/media/studio?${new URLSearchParams({ recordId }).toString()}`;
}
