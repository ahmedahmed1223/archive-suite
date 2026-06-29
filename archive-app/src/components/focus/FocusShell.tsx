/**
 * FocusShell (§17.7) — the floating control cluster for Focus Mode.
 *
 * Focus Mode itself is just a boolean in the UI store (`focusMode`). The actual
 * chrome hiding is done in CSS via the `va-focus-active` body class (see
 * `styles/tailwind.css`); this component:
 *   - toggles that body class while active,
 *   - renders an auto-hiding control bar (exit / do-not-disturb / Pomodoro),
 *   - exits on Escape,
 *   - drives an optional Pomodoro timer.
 *
 * Rendered once, unconditionally, from AppNotifications; returns null when
 * Focus Mode is off.
 */
import { Coffee, Eye, Pause, Play, RotateCcw, Timer, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { createPortal } from "react-dom";

import { useAppStore } from "../../stores/index.js";
import {
  FOCUS_AUTO_HIDE_MS,
  FOCUS_BODY_CLASS,
  createPomodoroState,
  formatClock,
  resetPomodoro,
  tickPomodoro,
  togglePomodoro
} from "../../features/focus/focusMode.js";

export function FocusShell() {
  const focusMode = useAppStore((s: any) => s.focusMode);
  const doNotDisturb = useAppStore((s: any) => s.focusDoNotDisturb);
  const setFocusMode = useAppStore((s: any) => s.setFocusMode);
  const setDoNotDisturb = useAppStore((s: any) => s.setFocusDoNotDisturb);
  const reducedMotion = useReducedMotion();

  const [controlsVisible, setControlsVisible] = React.useState(true);
  const [pomodoro, setPomodoro] = React.useState(createPomodoroState);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggle the body class so the stylesheet can hide chrome + lock scroll.
  React.useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const { body } = document;
    if (focusMode) {
      body.classList.add(FOCUS_BODY_CLASS);
    } else {
      body.classList.remove(FOCUS_BODY_CLASS);
    }
    return () => body.classList.remove(FOCUS_BODY_CLASS);
  }, [focusMode]);

  // Auto-hide the control bar after a period of pointer inactivity.
  React.useEffect(() => {
    if (!focusMode) return undefined;

    const scheduleHide = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), FOCUS_AUTO_HIDE_MS);
    };
    const reveal = () => {
      setControlsVisible(true);
      scheduleHide();
    };

    window.addEventListener("mousemove", reveal);
    window.addEventListener("touchstart", reveal, { passive: true });
    window.addEventListener("keydown", reveal);
    scheduleHide();

    return () => {
      window.removeEventListener("mousemove", reveal);
      window.removeEventListener("touchstart", reveal);
      window.removeEventListener("keydown", reveal);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [focusMode]);

  // Escape exits Focus Mode (handled here so it works even when the global
  // shortcut maps Escape to "goBack" navigation).
  React.useEffect(() => {
    if (!focusMode) return undefined;
    const onKey = (event: any) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [focusMode, setFocusMode]);

  // Pomodoro tick — only runs while the timer is active.
  React.useEffect(() => {
    if (!focusMode || !pomodoro.running) return undefined;
    const id = setInterval(() => setPomodoro((prev: any) => tickPomodoro(prev, 1) ?? prev), 1000);
    return () => clearInterval(id);
  }, [focusMode, pomodoro.running]);

  // Reset transient timer/visibility state whenever Focus Mode is left.
  React.useEffect(() => {
    if (focusMode) return;
    setControlsVisible(true);
    setPomodoro((prev: any) => (prev.running ? resetPomodoro(prev) : prev));
  }, [focusMode]);

  if (!focusMode || typeof document === "undefined") return null;

  const isBreak = pomodoro.phase === "break";
  const cluster = (
    <AnimatePresence>
      {controlsVisible && (
        <motion.div
          dir="rtl"
          role="toolbar"
          aria-label="أدوات وضع التركيز"
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="va-focus-controls fixed bottom-6 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-gray-950/90 px-3 py-2 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-md"
        >
          <span className="flex items-center gap-1.5 px-2 font-mono tabular-nums" aria-live="polite">
            {isBreak ? <Coffee className="h-4 w-4 text-amber-300" aria-hidden="true" /> : <Timer className="h-4 w-4 text-teal-300" aria-hidden="true" />}
            <span aria-label={isBreak ? "وقت الاستراحة" : "وقت التركيز"}>{formatClock(pomodoro.remaining)}</span>
          </span>

          <button
            type="button"
            onClick={() => setPomodoro((prev: any) => togglePomodoro(prev))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/15"
            aria-label={pomodoro.running ? "إيقاف مؤقّت بومودورو" : "تشغيل مؤقّت بومودورو"}
            aria-pressed={pomodoro.running}
          >
            {pomodoro.running ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setPomodoro((prev: any) => resetPomodoro(prev))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-white/15"
            aria-label="إعادة ضبط المؤقّت"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>

          <span className="mx-1 h-6 w-px bg-white/10" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setDoNotDisturb(!doNotDisturb)}
            className={`flex h-9 items-center gap-1.5 rounded-full px-3 transition-colors ${
              doNotDisturb ? "bg-teal-500/25 text-teal-200" : "bg-white/5 hover:bg-white/15"
            }`}
            aria-pressed={doNotDisturb}
            aria-label="عدم الإزعاج"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">عدم الإزعاج</span>
          </button>

          <button
            type="button"
            onClick={() => setFocusMode(false)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-white/5 px-3 transition-colors hover:bg-red-500/25"
            aria-label="خروج من وضع التركيز (Esc)"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(cluster, document.body);
}

export default FocusShell;
