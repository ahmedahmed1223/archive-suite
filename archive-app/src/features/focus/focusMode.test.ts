// @ts-nocheck
import { describe, expect, it } from "vitest";

import {
  FOCUS_AUTO_HIDE_MS,
  POMODORO_BREAK_SECONDS,
  POMODORO_FOCUS_SECONDS,
  createPomodoroState,
  formatClock,
  isFocusRecommendedPage,
  resetPomodoro,
  tickPomodoro,
  togglePomodoro
} from "./focusMode.js";

describe("isFocusRecommendedPage", () => {
  it("recommends content consumption/creation pages", () => {
    expect(isFocusRecommendedPage("detail")).toBe(true);
    expect(isFocusRecommendedPage("add")).toBe(true);
  });

  it("does not recommend chrome-heavy pages", () => {
    expect(isFocusRecommendedPage("dashboard")).toBe(false);
    expect(isFocusRecommendedPage("")).toBe(false);
    expect(isFocusRecommendedPage(undefined)).toBe(false);
  });
});

describe("formatClock", () => {
  it("formats seconds as zero-padded MM:SS", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(POMODORO_FOCUS_SECONDS)).toBe("25:00");
  });

  it("clamps negatives and coerces junk to 00:00", () => {
    expect(formatClock(-30)).toBe("00:00");
    expect(formatClock(NaN)).toBe("00:00");
  });
});

describe("pomodoro state machine", () => {
  it("starts paused in the focus phase at full duration", () => {
    const state = createPomodoroState();
    expect(state).toEqual({
      phase: "focus",
      remaining: POMODORO_FOCUS_SECONDS,
      running: false,
      completedRounds: 0
    });
  });

  it("does not advance while paused", () => {
    const state = createPomodoroState();
    expect(tickPomodoro(state, 5)).toBe(state);
  });

  it("counts down while running without mutating the input", () => {
    const running = togglePomodoro(createPomodoroState());
    const next = tickPomodoro(running, 1);
    expect(next?.remaining).toBe(POMODORO_FOCUS_SECONDS - 1);
    expect(running.remaining).toBe(POMODORO_FOCUS_SECONDS);
  });

  it("flips focus to break and increments completed rounds at zero", () => {
    const almostDone = { phase: "focus", remaining: 1, running: true, completedRounds: 0 };
    const next = tickPomodoro(almostDone, 1);
    expect(next?.phase).toBe("break");
    expect(next?.remaining).toBe(POMODORO_BREAK_SECONDS);
    expect(next?.completedRounds).toBe(1);
  });

  it("flips break to focus without incrementing rounds", () => {
    const breakDone = { phase: "break", remaining: 1, running: true, completedRounds: 2 };
    const next = tickPomodoro(breakDone, 1);
    expect(next?.phase).toBe("focus");
    expect(next?.remaining).toBe(POMODORO_FOCUS_SECONDS);
    expect(next?.completedRounds).toBe(2);
  });

  it("toggles the running flag", () => {
    const state = createPomodoroState();
    expect(togglePomodoro(state).running).toBe(true);
    expect(togglePomodoro(togglePomodoro(state)).running).toBe(false);
  });

  it("reset stops the timer and reloads the current phase, preserving rounds", () => {
    const midBreak = { phase: "break", remaining: 12, running: true, completedRounds: 3 };
    expect(resetPomodoro(midBreak)).toEqual({
      phase: "break",
      remaining: POMODORO_BREAK_SECONDS,
      running: false,
      completedRounds: 3
    });
  });
});

describe("constants", () => {
  it("auto-hide interval is a sane positive value", () => {
    expect(FOCUS_AUTO_HIDE_MS).toBeGreaterThan(0);
  });
});
