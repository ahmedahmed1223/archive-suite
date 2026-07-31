// ponytail: pure fuzzy-match over an already-loaded candidate list (V1-869) —
// no external analytics/spellcheck service, just Levenshtein distance.
function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }
  return dist[rows - 1][cols - 1];
}

export interface SearchSuggestion {
  value: string;
  distance: number;
}

/** أقرب القيم من الفهرس القائم (وسوم/تصنيفات) لعبارة بحث لم تُعطِ نتائج. */
export function suggestNearMatches(query: string, candidates: readonly string[], limit = 5): SearchSuggestion[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const maxDistance = Math.max(1, Math.floor(trimmed.length / 3));

  return candidates
    .map((value) => ({ value, distance: levenshtein(trimmed, value) }))
    .filter((s) => s.distance > 0 && s.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
