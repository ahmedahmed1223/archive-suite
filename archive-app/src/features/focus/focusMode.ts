export const FOCUS_AUTO_HIDE_MS = 3000;
export const FOCUS_BODY_CLASS = "va-focus-active";
export const FOCUS_RECOMMENDED_PAGES = ["detail", "add", "search", "reader"];

export function isFocusRecommendedPage(page: any = ""): boolean {
  return FOCUS_RECOMMENDED_PAGES.includes(String(page || ""));
}

export const POMODORO_FOCUS_SECONDS = 25 * 60;
export const POMODORO_BREAK_SECONDS = 5 * 60;

export type PomodoroPhase = "focus" | "break";
export interface PomodoroState {
  phase: PomodoroPhase;
  remaining: number;
  running: boolean;
  completedRounds: number;
}

export function createPomodoroState(): PomodoroState {
  return {
    phase: "focus",
    remaining: POMODORO_FOCUS_SECONDS,
    running: false,
    completedRounds: 0
  };
}

export function tickPomodoro(state: PomodoroState | null | undefined, elapsedSeconds = 1): PomodoroState | null | undefined {
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

export function togglePomodoro(state: PomodoroState): PomodoroState {
  return { ...state, running: !state.running };
}

export function resetPomodoro(state: Partial<PomodoroState> | null | undefined): PomodoroState {
  const phase: PomodoroPhase = state?.phase === "break" ? "break" : "focus";
  return {
    phase,
    remaining: phase === "focus" ? POMODORO_FOCUS_SECONDS : POMODORO_BREAK_SECONDS,
    running: false,
    completedRounds: state?.completedRounds || 0
  };
}

export function formatClock(totalSeconds: any): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
