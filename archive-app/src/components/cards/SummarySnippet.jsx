import { useAppStore } from "../../stores/appStore.js";
import { selectSummaryForItem } from "../../stores/slices/summarySlice.js";
import { hasValidSummary } from "../../features/ai/itemSummary.js";

// §1738 — Tiny card-level snippet that shows the shortSummary when available.
// Renders nothing when no valid summary exists.

export function SummarySnippet({ itemId }) {
  const summary = useAppStore((state) => selectSummaryForItem(state, itemId));

  if (!hasValidSummary(summary)) return null;

  return (
    <p className="line-clamp-2 text-xs text-gray-400">
      {summary.shortSummary}
    </p>
  );
}

export default SummarySnippet;
