export const RECOMMENDATION_FEEDBACK_KEY = "videoArchive:recommendationFeedback";
const FEEDBACK_VALUES = new Set(["useful", "not-useful", "dismissed"]);

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

export function getRecommendationFeedback(storage) {
  const target = resolveStorage(storage);
  if (!target) return {};
  try {
    const parsed = JSON.parse(target.getItem(RECOMMENDATION_FEEDBACK_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setRecommendationFeedback(key, value, storage) {
  if (!key || !FEEDBACK_VALUES.has(value)) return getRecommendationFeedback(storage);
  const target = resolveStorage(storage);
  const next = {
    ...getRecommendationFeedback(target),
    [key]: { value, at: new Date().toISOString() }
  };
  try {
    target?.setItem(RECOMMENDATION_FEEDBACK_KEY, JSON.stringify(next));
  } catch {
    /* local preference only */
  }
  return next;
}

export function filterDismissedRecommendations(recommendations = [], feedback = {}) {
  return recommendations.filter((item) => feedback[item.key || item.id]?.value !== "dismissed");
}
