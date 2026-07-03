"use client";

export type RecommendationFeedbackValue = "useful" | "not-useful" | "dismissed";

interface RecommendationFeedbackEntry {
  value: RecommendationFeedbackValue;
  at: string;
}

const storageKey = "videoArchive:recommendationFeedback";

function readFeedback(): Record<string, RecommendationFeedbackEntry> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as Record<string, RecommendationFeedbackEntry> : {};
  } catch {
    return {};
  }
}

function writeFeedback(feedback: Record<string, RecommendationFeedbackEntry>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(feedback));
}

export function setRecommendationFeedback(key: string, value: RecommendationFeedbackValue) {
  const feedback = readFeedback();
  feedback[key] = { value, at: new Date().toISOString() };
  writeFeedback(feedback);
}

export function getRecommendationFeedback(key: string) {
  return readFeedback()[key]?.value;
}

export function isRecommendationDismissed(key: string) {
  return getRecommendationFeedback(key) === "dismissed";
}
