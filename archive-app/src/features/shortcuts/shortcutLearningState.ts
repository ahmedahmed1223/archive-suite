// @ts-nocheck
// shortcutLearningState.js — tracks which keyboard shortcut hints the user
// has seen so they auto-dismiss after MAX_SHOWS views (progressive discovery).

const STORAGE_KEY = "va:shortcut:learned";
const MAX_SHOWS = 3;

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function write(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage unavailable */ }
}

/** Returns true if the hint for this action should still be shown. */
export function shouldShowHint(actionId) {
  if (!actionId) return false;
  const state = read();
  return (state[actionId] ?? 0) < MAX_SHOWS;
}

/** Call after showing the hint once. */
export function markHintShown(actionId) {
  if (!actionId) return;
  const state = read();
  state[actionId] = (state[actionId] ?? 0) + 1;
  write(state);
}

/** Call when the user performs the action via keyboard — stops the hint permanently. */
export function markLearned(actionId) {
  if (!actionId) return;
  const state = read();
  state[actionId] = MAX_SHOWS;
  write(state);
}

/** Reset all learning state (for testing / user preference reset). */
export function resetLearningState() {
  write({});
}

