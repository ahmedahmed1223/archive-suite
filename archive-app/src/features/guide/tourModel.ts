export function createTourStep({ id, target = null, title = "", body = "", page = null }: any = {}): any {
  return {
    id: String(id || "").trim(),
    target: target ? String(target) : null,
    title: String(title || ""),
    body: String(body || ""),
    page: page ? String(page) : null
  };
}

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

export function getStepIndex(steps: readonly any[] = [], currentId = ""): number {
  if (!Array.isArray(steps)) return -1;
  return steps.findIndex((step) => step && step.id === currentId);
}

export function nextStep(steps: readonly any[] = [], currentId = ""): any {
  const index = getStepIndex(steps, currentId);
  if (index < 0 || index >= steps.length - 1) return null;
  return steps[index + 1];
}

export function prevStep(steps: readonly any[] = [], currentId = ""): any {
  const index = getStepIndex(steps, currentId);
  if (index <= 0) return null;
  return steps[index - 1];
}

export function isTourComplete(seenIds: any = [], steps: readonly any[] = []): boolean {
  if (!Array.isArray(steps) || steps.length === 0) return false;
  const seen = seenIds instanceof Set ? seenIds : new Set(Array.isArray(seenIds) ? seenIds : []);
  return steps.every((step) => step && seen.has(step.id));
}
