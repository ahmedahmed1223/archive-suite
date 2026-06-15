/**
 * Pure driver helpers for the guided product tour (§1152).
 *
 * Bridges the pure `tourModel` with the settings store without importing React
 * or the store. The component reads/writes `settings.ui.tourSeenSteps` and
 * `settings.ui.tourDismissed`; these helpers decide auto-start, derive the
 * starting step, and build immutable settings patches for `updateSettings`.
 */

import { PRODUCT_TOUR, getStepIndex, isTourComplete } from "./tourModel.js";

export const TOUR_SEEN_STEPS_KEY = "tourSeenSteps";
export const TOUR_DISMISSED_KEY = "tourDismissed";

/**
 * Seen step ids persisted in settings.
 * @param {{ ui?: { [key: string]: unknown } }} settings
 * @returns {string[]}
 */
export function getSeenSteps(settings = {}) {
  const value = settings && settings.ui && settings.ui[TOUR_SEEN_STEPS_KEY];
  return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

/**
 * Whether the user dismissed or completed the tour (it must never re-show).
 * @param {{ ui?: { [key: string]: unknown } }} settings
 * @returns {boolean}
 */
export function isTourDismissed(settings = {}) {
  return Boolean(settings && settings.ui && settings.ui[TOUR_DISMISSED_KEY]);
}

/**
 * Auto-start only for a genuinely new user: an empty archive AND a tour that
 * was never dismissed/completed. This keeps it from fighting the empty-archive
 * usage checklist or nagging returning users.
 *
 * @param {{ itemCount?: number, settings?: object, steps?: Array }} input
 * @returns {boolean}
 */
export function shouldAutoStartTour({ itemCount = 0, settings = {}, steps = PRODUCT_TOUR } = {}) {
  if (isTourDismissed(settings)) return false;
  if (isTourComplete(getSeenSteps(settings), steps)) return false;
  const count = Number.isFinite(itemCount) && itemCount > 0 ? itemCount : 0;
  return count === 0;
}

/**
 * The step id the tour should open on: resume at the first unseen step, or the
 * first step when nothing is seen / all seen.
 *
 * @param {{ settings?: object, steps?: Array<{ id: string }> }} input
 * @returns {string}
 */
export function getInitialTourStepId({ settings = {}, steps = PRODUCT_TOUR } = {}) {
  if (!Array.isArray(steps) || steps.length === 0) return "";
  const seen = new Set(getSeenSteps(settings));
  const firstUnseen = steps.find((step) => step && !seen.has(step.id));
  return (firstUnseen || steps[0]).id;
}

/**
 * Patch that records a step as seen (deduped, immutable).
 * @param {string} stepId
 * @param {{ ui?: object }} settings
 * @returns {{ ui: { [key: string]: string[] } }}
 */
export function getMarkStepSeenPatch(stepId, settings = {}) {
  const id = String(stepId || "").trim();
  const current = getSeenSteps(settings);
  if (!id || current.includes(id)) {
    return { ui: { [TOUR_SEEN_STEPS_KEY]: current } };
  }
  return { ui: { [TOUR_SEEN_STEPS_KEY]: [...current, id] } };
}

/**
 * Patch that ends the tour: marks it dismissed and, when `complete`, records
 * every step as seen so `isTourComplete` is satisfied.
 *
 * @param {{ settings?: object, steps?: Array<{ id: string }>, complete?: boolean }} input
 * @returns {{ ui: { [key: string]: unknown } }}
 */
export function getEndTourPatch({ settings = {}, steps = PRODUCT_TOUR, complete = false } = {}) {
  const ui = { [TOUR_DISMISSED_KEY]: true };
  if (complete && Array.isArray(steps)) {
    const seen = new Set(getSeenSteps(settings));
    for (const step of steps) {
      if (step && step.id) seen.add(step.id);
    }
    ui[TOUR_SEEN_STEPS_KEY] = Array.from(seen);
  }
  return { ui };
}

/**
 * Patch that restarts the tour from scratch (clears dismissed + seen) so the
 * manual "ابدأ الجولة" entry point can replay it.
 * @returns {{ ui: { [key: string]: unknown } }}
 */
export function getRestartTourPatch() {
  return { ui: { [TOUR_DISMISSED_KEY]: false, [TOUR_SEEN_STEPS_KEY]: [] } };
}

/**
 * Resolve a step's index for the progress indicator, clamped to 0.
 * @param {Array<{ id: string }>} steps
 * @param {string} stepId
 * @returns {number}
 */
export function getProgressIndex(steps = PRODUCT_TOUR, stepId = "") {
  const index = getStepIndex(steps, stepId);
  return index < 0 ? 0 : index;
}
