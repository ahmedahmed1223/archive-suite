/**
 * ErrorMessage — displays a categorized error with appropriate icon and retry button.
 */
import { categorizeError, ERROR_CATEGORIES } from "../../services/errorMessages.js";
import { useT } from "../../i18n/useT.js";

const CATEGORY_STYLES = {
  [ERROR_CATEGORIES.NETWORK]: { bg: "bg-orange-900/30", border: "border-orange-700", icon: "📡", color: "text-orange-300" },
  [ERROR_CATEGORIES.AUTH]: { bg: "bg-yellow-900/30", border: "border-yellow-700", icon: "🔐", color: "text-yellow-300" },
  [ERROR_CATEGORIES.VALIDATION]: { bg: "bg-red-900/30", border: "border-red-700", icon: "⚠️", color: "text-red-300" },
  [ERROR_CATEGORIES.SERVER]: { bg: "bg-red-900/40", border: "border-red-600", icon: "🔥", color: "text-red-300" },
  [ERROR_CATEGORIES.RATE_LIMIT]: { bg: "bg-purple-900/30", border: "border-purple-700", icon: "⏳", color: "text-purple-300" },
  [ERROR_CATEGORIES.NOT_FOUND]: { bg: "bg-gray-900/30", border: "border-gray-600", icon: "🔍", color: "text-gray-300" },
  [ERROR_CATEGORIES.UNKNOWN]: { bg: "bg-gray-900/30", border: "border-gray-600", icon: "❓", color: "text-gray-300" },
};

export function ErrorMessage({ error, onRetry, className = "" }) {
  const { t } = useT();
  if (!error) return null;
  const { category, message, retry } = categorizeError(error);
  const styles = CATEGORY_STYLES[category] || CATEGORY_STYLES[ERROR_CATEGORIES.UNKNOWN];

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${styles.bg} ${styles.border} ${className}`} role="alert">
      <span className="text-lg flex-shrink-0" aria-hidden="true">{styles.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${styles.color}`}>{message}</p>
      </div>
      {retry && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 px-2 py-1 rounded transition-colors whitespace-nowrap flex-shrink-0"
        >
          {t("actions.retry")}
        </button>
      )}
    </div>
  );
}
