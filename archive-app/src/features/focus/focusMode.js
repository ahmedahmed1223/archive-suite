/**
 * Focus Mode (§17.7) — pure logic, no React, fully unit-testable.
 *
 * Focus Mode strips the surrounding chrome (sidebar / context bar / bottom
 * tabs) so the user can concentrate on a single piece of content — a video
 * player, a document reader, or the add form. The UI lives in
 * `components/focus/FocusShell.jsx`; this module owns the timing constants,
 * the page-eligibility rule, and the optional Pomodoro timer state machine.
 */

/** Floating controls auto-hide after this idle interval (ms). */
export const FOCUS_AUTO_HIDE_MS = 3000;

/** CSS class toggled on <body> so chrome can be hidden via stylesheet. */
export const FOCUS_BODY_CLASS = "va-focus-active";

/**
 * Pages where Focus Mode delivers the most value (content consumption /
 * creation). Focus Mode can still be toggled anywhere — this only drives the
 * "recommended" hint and analytics.
 */
export const FOCUS_RECOMMENDED_PAGES = ["detail", "add", "search", "reader"];

/**
 * @param {string} page
 * @returns {boolean}
 */
export function isFocusRecommendedPage(page) {
  return FOCUS_RECOMMENDED_PAGES.includes(String(page || ""));
}

// ─── Pomodoro timer ──────────────────────────────────────────────────────────

export const POMODORO_FOCUS_SECONDS = 25 * 60;
export const POMODORO_BREAK_SECONDS = 5 * 60;

/**
 * @typedef {Object} PomodoroState
 * @property {"focus"|"break"} phase
 * @property {number} remaining   seconds left in the current phase
 * @property {boolean} running
 * @property {number} completedRounds  number of finished focus rounds
 */

/** @returns {PomodoroState} */
export function createPomodoroState() {
  return {
    phase: "focus",
    remaining: POMODORO_FOCUS_SECONDS,
    running: false,
    completedRounds: 0
  };
}

/**
 * Advance the timer by `elapsedSeconds`. When a phase reaches zero it flips
 * focus⇄break and reloads the appropriate duration. Returns a new object
 * (never mutates) so it is safe in React state.
 *
 * @param {PomodoroState} state
 * @param {number} [elapsedSeconds]
 * @returns {PomodoroState}
 */
export function tickPomodoro(state, elapsedSeconds = 1) {
  if (!state || !state.running) return state;
  const remaining = state.remaining - Math.max(0, elapsedSeconds);
  if (remaining > 0) return { ...state, remaining };

  const wasFocus = state.phase === "focus";
  const nextPhase = wasFocus ? "break" : "focus";
  const nextRemaining = nextPhase === "focus" ? POMODORO_FOCUS_SECONDS : POMODORO_BREAK_SECONDS;
  return {
    ...state,
    phase: nextPhase,
    remaining: nextRemaining,
    completedRounds: wasFocus ? state.completedRounds + 1 : state.completedRounds
  };
}

/**
 * @param {PomodoroState} state
 * @returns {PomodoroState}
 */
export function togglePomodoro(state) {
  return { ...state, running: !state.running };
}

/**
 * Stop the timer and reload the current phase to its full duration.
 * @param {PomodoroState} state
 * @returns {PomodoroState}
 */
export function resetPomodoro(state) {
  const phase = state?.phase === "break" ? "break" : "focus";
  return {
    phase,
    remaining: phase === "focus" ? POMODORO_FOCUS_SECONDS : POMODORO_BREAK_SECONDS,
    running: false,
    completedRounds: state?.completedRounds || 0
  };
}

/**
 * Format seconds as MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
