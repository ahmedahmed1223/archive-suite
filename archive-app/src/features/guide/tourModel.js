/**
 * Pure model for the interactive feature-discovery guided tour (§1152).
 *
 * This is complementary to two existing onboarding surfaces:
 *   - `features/onboarding/V1OnboardingWizard.jsx` — the technical setup wizard
 *     (security, storage, theme) shown before the app opens.
 *   - `features/onboarding/usageOnboarding.js` — the empty-archive "add your
 *     first item" checklist.
 *
 * The product tour here points a brand-new user at the *features that stay
 * undiscovered* — hierarchical tags, advanced search, collections — by walking
 * them through real pages step by step. The model is intentionally free of
 * React / store / DOM dependencies so the stepping rules are unit-testable in
 * isolation. The component layer (`components/guide/GuidedTour.jsx`) wires the
 * `page` of each step to `setCurrentPage` and persists progress through
 * `settings.ui.tourSeenSteps` / `settings.ui.tourDismissed`.
 *
 * `target` is an optional CSS selector for element-anchored coachmarks. When a
 * target cannot be resolved the component falls back to a centered modal step,
 * so steps stay robust even if the DOM shifts.
 */

/**
 * Build one immutable tour step descriptor.
 *
 * @param {{ id: string, target?: string|null, title: string, body: string,
 *   page?: string|null }} input
 * @returns {{ id: string, target: string|null, title: string, body: string,
 *   page: string|null }}
 */
export function createTourStep({ id, target = null, title = "", body = "", page = null } = {}) {
  return {
    id: String(id || "").trim(),
    target: target ? String(target) : null,
    title: String(title || ""),
    body: String(body || ""),
    page: page ? String(page) : null
  };
}

/**
 * The default product tour. Each step points at a real feature/page so the
 * user discovers the high-value surfaces (search, hierarchical tags,
 * collections, automation) rather than reading a marketing blurb.
 */
export const PRODUCT_TOUR = Object.freeze([
  createTourStep({
    id: "welcome",
    target: null,
    page: "dashboard",
    title: "جولة سريعة في الميزات",
    body: "تعرّف خلال دقيقة على أقوى ميزات الأرشيف: الأرشفة، البحث المتقدم، الوسوم الهرمية، والمجموعات. يمكنك التخطي في أي وقت."
  }),
  createTourStep({
    id: "archive",
    target: "[data-tour='archive']",
    page: "archive",
    title: "مساحة العمل: الأرشيف",
    body: "من هنا تتصفّح وتفلتر وتعاين عناصرك، وتضيف فيديو جديداً من نفس المسار دون فقد سياق التصفح."
  }),
  createTourStep({
    id: "search",
    target: "[data-tour='search']",
    page: "search",
    title: "البحث المتقدم",
    body: "ابحث بالعنوان أو الوسوم أو الملاحظات أو الحقول المخصصة، واحفظ الفلاتر في الرابط للرجوع إليها لاحقاً."
  }),
  createTourStep({
    id: "htags",
    target: "[data-tour='htags']",
    page: "htags",
    title: "الوسوم الهرمية",
    body: "نظّم التصنيف في بنية شجرية: وسوم جذرية وفرعية تُستدعى عبر # بمسارها الكامل لمنع اختلاف الكتابة."
  }),
  createTourStep({
    id: "collections",
    target: "[data-tour='collections']",
    page: "collections",
    title: "المجموعات",
    body: "اجمع العناصر المرتبطة يدوياً، أو ابنِ مجموعات ذكية تُحدَّث تلقائياً حسب القواعد التي تختارها."
  }),
  createTourStep({
    id: "help",
    target: null,
    page: "help",
    title: "مركز المساعدة",
    body: "كل ما سبق موثّق ومتاح للبحث في صفحة المساعدة. يمكنك إعادة تشغيل هذه الجولة من هناك متى شئت."
  })
]);

/**
 * Index of a step id within a steps array, or -1 when not found.
 * @param {Array<{ id: string }>} steps
 * @param {string} currentId
 * @returns {number}
 */
export function getStepIndex(steps = [], currentId = "") {
  if (!Array.isArray(steps)) return -1;
  return steps.findIndex((step) => step && step.id === currentId);
}

/**
 * The step after `currentId`, or null when at the end / not found.
 * @param {Array<{ id: string }>} steps
 * @param {string} currentId
 * @returns {object|null}
 */
export function nextStep(steps = [], currentId = "") {
  const index = getStepIndex(steps, currentId);
  if (index < 0 || index >= steps.length - 1) return null;
  return steps[index + 1];
}

/**
 * The step before `currentId`, or null when at the start / not found.
 * @param {Array<{ id: string }>} steps
 * @param {string} currentId
 * @returns {object|null}
 */
export function prevStep(steps = [], currentId = "") {
  const index = getStepIndex(steps, currentId);
  if (index <= 0) return null;
  return steps[index - 1];
}

/**
 * Whether every step in `steps` has been seen.
 *
 * Empty/invalid inputs are treated as "not complete" so callers never auto-hide
 * a tour they have not actually shown.
 *
 * @param {string[]|Set<string>} seenIds
 * @param {Array<{ id: string }>} steps
 * @returns {boolean}
 */
export function isTourComplete(seenIds = [], steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) return false;
  const seen = seenIds instanceof Set ? seenIds : new Set(Array.isArray(seenIds) ? seenIds : []);
  return steps.every((step) => step && seen.has(step.id));
}
