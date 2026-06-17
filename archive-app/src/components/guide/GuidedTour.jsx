import {
  ArrowLeft,
  ArrowRight,
  Compass,
  X
} from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { jsx, jsxs } from "react/jsx-runtime";
import { useReducedMotion } from "framer-motion";

import { useAppStore } from "../../stores/index.js";
import {
  PRODUCT_TOUR,
  getStepIndex,
  nextStep,
  prevStep
} from "../../features/guide/tourModel.js";
import {
  getEndTourPatch,
  getInitialTourStepId,
  getMarkStepSeenPatch,
  shouldAutoStartTour
} from "../../features/guide/tourDriver.js";

/**
 * Interactive feature-discovery guided tour (§1152).
 *
 * Rendered as a centered step-by-step modal (title / body / "go to page")
 * rather than fragile element-anchored coachmarks, so it stays robust if the
 * DOM shifts. Each step can carry a `page`; "اذهب للصفحة" navigates there via
 * `setCurrentPage`. Progress, next/prev and skip are always available.
 *
 * Pure stepping + settings rules live in `features/guide/tourModel.js` and
 * `tourDriver.js` and are unit-tested there — this component is presentation +
 * wiring only. It is failure-safe: store actions are optional-chained and the
 * portal target falls back to `document.body`.
 */
const arabicNumber = new Intl.NumberFormat("ar");

export function GuidedTour({
  open,
  steps = PRODUCT_TOUR,
  currentStepId,
  onStepChange,
  onNavigate,
  onComplete,
  onSkip
}) {
  const prefersReducedMotion = useReducedMotion();

  if (!open || !Array.isArray(steps) || steps.length === 0) return null;

  const index = Math.max(0, getStepIndex(steps, currentStepId));
  const step = steps[index] || steps[0];
  const isLast = index >= steps.length - 1;
  const isFirst = index <= 0;

  const goNext = () => {
    const next = nextStep(steps, step.id);
    if (next) {
      onStepChange?.(next.id);
    } else {
      onComplete?.();
    }
  };

  const goPrev = () => {
    const previous = prevStep(steps, step.id);
    if (previous) onStepChange?.(previous.id);
  };

  const goToPage = () => {
    if (step.page) onNavigate?.(step.page);
  };

  const transitionClass = prefersReducedMotion ? "" : "transition-opacity duration-200";

  const overlay = jsx("div", {
    dir: "rtl",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "جولة الميزات التفاعلية",
    className: `fixed inset-0 z-[9991] flex items-end justify-center bg-black/55 p-4 text-right text-white backdrop-blur-sm sm:items-center ${transitionClass}`,
    children: jsxs("section", {
      className: "va-surface-muted w-full max-w-lg rounded-3xl border p-6 shadow-2xl",
      children: [
        jsxs("div", {
          className: "flex items-start justify-between gap-3",
          children: [
            jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                jsx("span", {
                  className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl theme-panel va-accent-text",
                  children: jsx(Compass, { className: "h-5 w-5" })
                }),
                jsx("p", {
                  className: "text-xs font-semibold va-accent-text",
                  "aria-live": "polite",
                  children: `جولة الميزات ${arabicNumber.format(index + 1)} / ${arabicNumber.format(steps.length)}`
                })
              ]
            }),
            jsx("button", {
              type: "button",
              onClick: () => onSkip?.(),
              className: "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white",
              "aria-label": "تخطي الجولة",
              children: jsx(X, { className: "h-4 w-4" })
            })
          ]
        }),
        jsx("h2", { className: "mt-4 text-2xl font-bold", children: step.title }),
        jsx("p", { className: "mt-3 text-sm leading-7 text-gray-300", children: step.body }),
        jsx("div", {
          className: "mt-5 h-1.5 overflow-hidden rounded-full bg-white/10",
          role: "progressbar",
          "aria-valuenow": index + 1,
          "aria-valuemin": 1,
          "aria-valuemax": steps.length,
          children: jsx("div", {
            className: "h-full rounded-full va-accent-bg transition-all duration-300",
            style: { width: `${((index + 1) / steps.length) * 100}%` }
          })
        }),
        jsxs("div", {
          className: "mt-6 flex flex-wrap items-center justify-between gap-3",
          children: [
            jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                jsx("button", {
                  type: "button",
                  onClick: () => onSkip?.(),
                  className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5",
                  children: "تخطي"
                }),
                step.page && jsx("button", {
                  type: "button",
                  onClick: goToPage,
                  className: "btn btn-ghost gap-1",
                  children: "اذهب للصفحة"
                })
              ]
            }),
            jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                !isFirst && jsxs("button", {
                  type: "button",
                  onClick: goPrev,
                  className: "inline-flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/5",
                  children: [jsx(ArrowRight, { className: "h-4 w-4" }), "السابق"]
                }),
                jsxs("button", {
                  type: "button",
                  onClick: goNext,
                  className: "btn btn-primary gap-1",
                  children: isLast ? ["إنهاء الجولة"] : ["التالي", jsx(ArrowLeft, { className: "h-4 w-4" })]
                })
              ]
            })
          ]
        })
      ]
    })
  });

  return createPortal(overlay, document.body);
}

GuidedTour.displayName = "GuidedTour";
GuidedTour.componentId = "guided-tour";
GuidedTour.migrationStatus = "native";

/**
 * Store-connected controller. Owns the open/current-step state, auto-starts for
 * a brand-new user (empty archive + tour never dismissed), persists seen steps
 * and the dismissed flag through `updateSettings`, and navigates via
 * `setCurrentPage`. It also opens on demand via a `videoarchive:start-guided-tour`
 * window event so HelpPage / the sidebar can offer a manual entry point without
 * prop drilling.
 */
export function GuidedTourController() {
  const {
    videoItems = [],
    settings = {},
    setCurrentPage,
    updateSettings
  } = useAppStore();

  const [open, setOpen] = React.useState(false);
  const [currentStepId, setCurrentStepId] = React.useState(() => getInitialTourStepId({ settings }));
  // Auto-start should fire once, after the store has settled — guard so a later
  // settings change (e.g. marking a step seen) never re-triggers it.
  const autoStartedRef = React.useRef(false);

  const itemCount = React.useMemo(
    () => videoItems.filter((item) => !item?.isDeleted).length,
    [videoItems]
  );

  const startTour = React.useCallback(() => {
    setCurrentStepId(getInitialTourStepId({ settings: useAppStore.getState().settings || {} }));
    setOpen(true);
  }, []);

  // Manual entry point (HelpPage button / sidebar) dispatches this event.
  React.useEffect(() => {
    const handleStart = () => startTour();
    window.addEventListener("videoarchive:start-guided-tour", handleStart);
    return () => window.removeEventListener("videoarchive:start-guided-tour", handleStart);
  }, [startTour]);

  // One-shot auto-start for a genuinely fresh user.
  React.useEffect(() => {
    if (autoStartedRef.current || open) return;
    if (shouldAutoStartTour({ itemCount, settings })) {
      autoStartedRef.current = true;
      setCurrentStepId(getInitialTourStepId({ settings }));
      setOpen(true);
    }
  }, [itemCount, open, settings]);

  const handleStepChange = React.useCallback((stepId) => {
    setCurrentStepId(stepId);
    updateSettings?.(getMarkStepSeenPatch(stepId, useAppStore.getState().settings || {}));
  }, [updateSettings]);

  const handleNavigate = React.useCallback((page) => {
    if (page) setCurrentPage?.(page);
  }, [setCurrentPage]);

  const endTour = React.useCallback((complete) => {
    setOpen(false);
    autoStartedRef.current = true;
    updateSettings?.(getEndTourPatch({ settings: useAppStore.getState().settings || {}, complete }));
  }, [updateSettings]);

  // Record the opening step as seen so a resume picks up correctly.
  React.useEffect(() => {
    if (!open || !currentStepId) return;
    updateSettings?.(getMarkStepSeenPatch(currentStepId, useAppStore.getState().settings || {}));
    // Only when the tour opens — subsequent steps are recorded in handleStepChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return jsx(GuidedTour, {
    open,
    currentStepId,
    onStepChange: handleStepChange,
    onNavigate: handleNavigate,
    onComplete: () => endTour(true),
    onSkip: () => endTour(false)
  });
}

GuidedTourController.displayName = "GuidedTourController";

export default GuidedTour;
