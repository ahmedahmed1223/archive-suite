import * as React from "react";
import { useAppStore } from "../../stores/appStore.js";
import { useAiAssist } from "../../features/ai/useAiAssist.js";
import {
  extractTextForSummary,
  hasValidSummary,
  describeStatus
} from "../../features/ai/itemSummary.js";
import { selectSummaryForItem } from "../../stores/slices/summarySlice.js";

// §1738 — AI summarization panel displayed in an item detail view.
// Shows a summary if available, or a prompt to generate one.

function formatDate(isoString) {
  if (!isoString) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function SummaryPanel({ item, showToast }) {
  const summary = useAppStore((state) => selectSummaryForItem(state, item?.id));
  const setSummary = useAppStore((state) => state.setSummary);
  const { summarize, isBusy, available } = useAiAssist({ showToast });
  const [showDetails, setShowDetails] = React.useState(false);

  const isValid = hasValidSummary(summary);
  const busy = isBusy;

  async function handleSummarize() {
    if (!item?.id || busy) return;
    const text = extractTextForSummary(item);
    if (!text) {
      showToast?.("لا يوجد محتوى للتلخيص.", "warning");
      return;
    }

    // Optimistic pending state
    await setSummary({
      itemId: item.id,
      status: "pending",
      shortSummary: "",
      keyPoints: [],
      detailedSummary: ""
    });

    const result = await summarize(text);

    if (result === null || result === undefined) {
      await setSummary({ itemId: item.id, status: "error" });
      return;
    }

    const shortSummary =
      typeof result === "string"
        ? result
        : result?.summary || result?.text || "";

    const keyPoints = Array.isArray(result?.keyPoints) ? result.keyPoints : [];
    const detailedSummary =
      typeof result === "object" ? result?.detailedSummary || "" : "";

    await setSummary({
      itemId: item.id,
      shortSummary,
      keyPoints,
      detailedSummary,
      status: shortSummary ? "done" : "error"
    });
  }

  if (!item) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          ملخص المحتوى
        </h3>
        {summary && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {describeStatus(summary)}
          </span>
        )}
      </div>

      {/* Loading state */}
      {busy && (
        <div className="mb-3 flex items-center gap-2 text-sm text-blue-500 dark:text-blue-400">
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span>جاري التلخيص...</span>
        </div>
      )}

      {/* Error state */}
      {!busy && summary?.status === "error" && (
        <p className="mb-3 text-sm text-red-500 dark:text-red-400">
          تعذّر توليد الملخص. حاول مجدداً.
        </p>
      )}

      {/* No summary yet */}
      {!busy && !isValid && summary?.status !== "error" && (
        <p className="mb-3 text-sm text-gray-400 dark:text-gray-500">
          لم يُنشأ ملخص لهذا العنصر بعد. اضغط على الزر أدناه لتوليد ملخص تلقائي.
        </p>
      )}

      {/* Summary content */}
      {!busy && isValid && (
        <div className="mb-3 space-y-3">
          {/* Short summary */}
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {summary.shortSummary}
          </p>

          {/* Key points */}
          {summary.keyPoints.length > 0 && (
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {summary.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Details toggle */}
          {summary.detailedSummary && (
            <div>
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="text-xs font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {showDetails ? "إخفاء التفاصيل" : "عرض التفاصيل"}
              </button>
              {showDetails && (
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                  {summary.detailedSummary}
                </p>
              )}
            </div>
          )}

          {/* Creation date */}
          {summary.createdAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              تاريخ الإنشاء: {formatDate(summary.createdAt)}
            </p>
          )}
        </div>
      )}

      {/* Action button */}
      {available && (
        <button
          type="button"
          onClick={handleSummarize}
          disabled={busy}
          className="w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          {isValid ? "تحديث الملخص" : "تلخيص المحتوى"}
        </button>
      )}

      {!available && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          الذكاء الاصطناعي غير متاح في الوضع الحالي.
        </p>
      )}
    </div>
  );
}

export default SummaryPanel;
