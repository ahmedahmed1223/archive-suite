let _cache = null;

export async function loadXlsx() {
  if (!_cache) _cache = await import("xlsx");
  return _cache;
}
