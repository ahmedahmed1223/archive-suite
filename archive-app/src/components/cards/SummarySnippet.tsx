import { useAppStore } from "../../stores/appStore.js";
import { selectSummaryForItem } from "../../stores/slices/summarySlice.js";

import { hasValidSummary } from "../../features/ai/itemSummary.js";

export interface SummarySnippetProps {
  itemId: string;
}

// §1738 — Tiny card-level snippet that shows the shortSummary when available.
// Renders nothing when no valid summary exists.
export function SummarySnippet({ itemId }: SummarySnippetProps) {
  const summary = useAppStore((state: any) => selectSummaryForItem(state, itemId));

  if (!hasValidSummary(summary)) return null;

  return <p className="line-clamp-2 text-xs text-gray-400">{summary.shortSummary}</p>;
}

export default SummarySnippet;
