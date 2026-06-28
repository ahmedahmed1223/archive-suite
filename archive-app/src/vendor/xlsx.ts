let _cache: typeof import("xlsx") | null = null;

export async function loadXlsx(): Promise<typeof import("xlsx")> {
  if (!_cache) _cache = await import("xlsx");
  return _cache;
}
