export function mediaComparisonHref(recordId: string, store: string | null | undefined): string {
  const params = new URLSearchParams({ recordId });
  const normalizedStore = store?.trim();
  if (normalizedStore && normalizedStore !== "archive-items") {
    params.set("store", normalizedStore);
  }
  return `/media/compare?${params.toString()}`;
}
