/**
 * Pure logic for the empty-archive "first item" usage onboarding (§1483).
 *
 * After the technical setup wizard, a brand-new user lands on an empty
 * archive that does not explain WHAT to archive first or HOW to organize
 * folders and tags. This module computes the guided checklist shown in the
 * empty state: which steps are done, the overall progress, and whether the
 * onboarding should be shown at all.
 *
 * It is intentionally free of React / store / DOM dependencies so the rules
 * are unit-testable in isolation. The component layer wires the resulting
 * step descriptors to navigation actions and persists dismissal through the
 * settings store (`settings.ui.usageOnboardingDismissed`).
 */

// Stable ids so the component can attach the right navigation action and the
// settings layer can reason about completion without string drift.
export const USAGE_STEP_IDS = Object.freeze({
  ADD_ITEM: "add-item",
  CREATE_FOLDER: "create-folder",
  ADD_TAGS: "add-tags"
});

// Settings key (under `ui`) used to persist a manual dismissal. Kept here so
// the component and any future consumer share one source of truth.
export const USAGE_ONBOARDING_DISMISS_KEY = "usageOnboardingDismissed";

function toCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Build the ordered list of usage steps with their done/active state.
 *
 * A step is "done" once the corresponding count is non-zero. The first
 * not-done step is marked "active" so the UI can highlight the single next
 * action instead of overwhelming a new user with three equal calls-to-action.
 *
 * @param {{ itemCount?: number, folderCount?: number, tagCount?: number }} counts
 * @returns {Array<{ id: string, done: boolean, active: boolean,
 *   pageId: string, title: string, description: string, cta: string }>}
 */
export function computeUsageSteps({ itemCount = 0, folderCount = 0, tagCount = 0 } = {}) {
  const items = toCount(itemCount);
  const folders = toCount(folderCount);
  const tags = toCount(tagCount);

  const steps = [
    {
      id: USAGE_STEP_IDS.ADD_ITEM,
      done: items > 0,
      pageId: "add",
      title: "أضف أول عنصر",
      description: "احفظ أول فيديو أو ملف في الأرشيف لتبدأ — يمكنك دائماً تعديله لاحقاً.",
      cta: "إضافة عنصر"
    },
    {
      id: USAGE_STEP_IDS.CREATE_FOLDER,
      done: folders > 0,
      pageId: "collections",
      title: "أنشئ مجلداً للتنظيم",
      description: "المجلدات تجمع العناصر يدوياً، بينما المجموعات الذكية تُحدَّث تلقائياً حسب القواعد.",
      cta: "إنشاء مجلد"
    },
    {
      id: USAGE_STEP_IDS.ADD_TAGS,
      done: tags > 0,
      pageId: "htags",
      title: "أضف وسوماً للاستدعاء",
      description: "الوسوم تربط العناصر المتشابهة وتجعل البحث والاستدعاء عبر # أسرع.",
      cta: "إدارة الوسوم"
    }
  ];

  // Mark the first incomplete step as active — gives the user a single,
  // obvious next action.
  const firstPendingIndex = steps.findIndex((step) => !step.done);
  return steps.map((step, index) => ({
    ...step,
    active: index === firstPendingIndex
  }));
}

/**
 * Overall completion percentage (0–100, integer) of the usage steps.
 * @param {Array<{ done: boolean }>} steps
 * @returns {number}
 */
export function computeUsageProgress(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) return 0;
  const done = steps.filter((step) => step && step.done).length;
  return Math.round((done / steps.length) * 100);
}

/**
 * Whether all usage steps are complete.
 * @param {Array<{ done: boolean }>} steps
 * @returns {boolean}
 */
export function isUsageOnboardingComplete(steps = []) {
  return Array.isArray(steps) && steps.length > 0 && steps.every((step) => step && step.done);
}

/**
 * Decide whether to show the usage onboarding panel.
 *
 * Show it only for a genuinely fresh archive: zero items AND the user has not
 * dismissed it. Once the first item exists the empty state disappears anyway,
 * but guarding on itemCount keeps the rule explicit and lets callers reuse it.
 *
 * @param {{ itemCount?: number, dismissed?: boolean }} input
 * @returns {boolean}
 */
export function shouldShowUsageOnboarding({ itemCount = 0, dismissed = false, enabled = false } = {}) {
  if (!enabled) return false;
  if (dismissed) return false;
  return toCount(itemCount) === 0;
}

/**
 * Settings patch that persists a dismissal through `updateSettings`.
 * Returned immutably so callers never mutate shared settings state.
 * @returns {{ ui: { [key: string]: boolean } }}
 */
export function getUsageOnboardingDismissPatch() {
  return { ui: { [USAGE_ONBOARDING_DISMISS_KEY]: true } };
}

/**
 * Read the persisted dismissal flag from a settings object.
 * @param {{ ui?: { [key: string]: unknown } }} settings
 * @returns {boolean}
 */
export function isUsageOnboardingDismissed(settings = {}) {
  return Boolean(settings && settings.ui && settings.ui[USAGE_ONBOARDING_DISMISS_KEY]);
}
