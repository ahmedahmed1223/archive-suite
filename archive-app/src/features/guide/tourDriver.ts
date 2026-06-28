import { PRODUCT_TOUR, getStepIndex, isTourComplete } from "./tourModel.js";

export const TOUR_SEEN_STEPS_KEY = "tourSeenSteps";
export const TOUR_DISMISSED_KEY = "tourDismissed";

export function getSeenSteps(settings: any = {}): string[] {
  const value = settings && settings.ui && settings.ui[TOUR_SEEN_STEPS_KEY];
  return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

export function isTourDismissed(settings: any = {}): boolean {
  return Boolean(settings && settings.ui && settings.ui[TOUR_DISMISSED_KEY]);
}

export function shouldAutoStartTour({ itemCount = 0, settings = {}, steps = PRODUCT_TOUR }: any = {}): boolean {
  if (settings.ui?.tourAutoStartEnabled !== true) return false;
  if (isTourDismissed(settings)) return false;
  if (isTourComplete(getSeenSteps(settings), steps)) return false;
  const count = Number.isFinite(itemCount) && itemCount > 0 ? itemCount : 0;
  return count === 0;
}

export function getInitialTourStepId({ settings = {}, steps = PRODUCT_TOUR }: any = {}): string {
  if (!Array.isArray(steps) || steps.length === 0) return "";
  const seen = new Set(getSeenSteps(settings));
  const firstUnseen = steps.find((step: any) => step && !seen.has(step.id));
  return (firstUnseen || steps[0]).id;
}

export function getMarkStepSeenPatch(stepId: any, settings: any = {}): any {
  const id = String(stepId || "").trim();
  const current = getSeenSteps(settings);
  if (!id || current.includes(id)) {
    return { ui: { [TOUR_SEEN_STEPS_KEY]: current } };
  }
  return { ui: { [TOUR_SEEN_STEPS_KEY]: [...current, id] } };
}

export function getEndTourPatch({ settings = {}, steps = PRODUCT_TOUR, complete = false }: any = {}): any {
  const ui: any = { [TOUR_DISMISSED_KEY]: true };
  if (complete && Array.isArray(steps)) {
    const seen = new Set(getSeenSteps(settings));
    for (const step of steps) {
      if (step && step.id) seen.add(step.id);
    }
    ui[TOUR_SEEN_STEPS_KEY] = Array.from(seen);
  }
  return { ui };
}

export function getRestartTourPatch(): any {
  return { ui: { [TOUR_DISMISSED_KEY]: false, [TOUR_SEEN_STEPS_KEY]: [] } };
}

export function getProgressIndex(steps: readonly any[] = PRODUCT_TOUR, stepId = ""): number {
  const index = getStepIndex(steps, stepId);
  return index < 0 ? 0 : index;
}
