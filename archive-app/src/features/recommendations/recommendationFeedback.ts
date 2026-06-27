export const RECOMMENDATION_FEEDBACK_KEY = "videoArchive:recommendationFeedback";

const FEEDBACK_VALUES = new Set(["useful", "not-useful", "dismissed"] as const);

type RecommendationFeedbackValue = "useful" | "not-useful" | "dismissed";

interface RecommendationFeedbackEntry {
  value: RecommendationFeedbackValue;
  at: string;
}

type RecommendationFeedbackMap = Record<string, RecommendationFeedbackEntry>;

interface RecommendationItem {
  id?: string;
  key?: string;
}

interface RecommendationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function resolveStorage(storage?: RecommendationStorage | null): RecommendationStorage | null {
  if (storage) return storage;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

function isFeedbackValue(value: unknown): value is RecommendationFeedbackValue {
  return FEEDBACK_VALUES.has(value as RecommendationFeedbackValue);
}

export function getRecommendationFeedback(storage?: RecommendationStorage | null): RecommendationFeedbackMap {
  const target = resolveStorage(storage);
  if (!target) return {};
  try {
    const parsed = JSON.parse(target.getItem(RECOMMENDATION_FEEDBACK_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as RecommendationFeedbackMap
      : {};
  } catch {
    return {};
  }
}

export function setRecommendationFeedback(
  key: string,
  value: unknown,
  storage?: RecommendationStorage | null
): RecommendationFeedbackMap {
  if (!key || !isFeedbackValue(value)) return getRecommendationFeedback(storage);
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

export function filterDismissedRecommendations<TRecommendation extends RecommendationItem>(
  recommendations: TRecommendation[] = [],
  feedback: RecommendationFeedbackMap = {}
): TRecommendation[] {
  return recommendations.filter((item) => feedback[item.key || item.id || ""]?.value !== "dismissed");
}
