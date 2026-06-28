export interface StartupStepDefinition {
  id: string;
  label: string;
  hint: string;
  icon: string;
}

export const STARTUP_SEQUENCE_STEP_DEFINITIONS: readonly StartupStepDefinition[] = [
  { id: "environment", label: "فحص البيئة المحلية", hint: "نتأكد أن المتصفح يدعم التخزين والعمل المحلي.", icon: "cpu" },
  { id: "indexeddb", label: "تجهيز IndexedDB", hint: "فتح التخزين الأساسي الذي يحتفظ بالأرشيف.", icon: "database" },
  { id: "data", label: "تحميل بيانات الأرشيف", hint: "تشغيل الترحيلات وقراءة العناصر من IndexedDB.", icon: "drive" },
  { id: "admin", label: "تجهيز المدير الأول", hint: "تحديد هل نفتح معالج أول تشغيل أم جلسة يومية.", icon: "user" },
  { id: "filesystem", label: "تهيئة نظام الملفات", hint: "تجهيز حفظ أذونات المجلدات والفهارس المحلية.", icon: "folder" },
  { id: "session", label: "استعادة الجلسة والصلاحيات", hint: "قراءة جلسة المستخدم وتحميل الأدوار.", icon: "key" },
  { id: "route", label: "تطبيق الرابط الحالي", hint: "احترام الرابط المباشر قبل الجولة التعليمية.", icon: "link" },
  { id: "ready", label: "جاهز للاستخدام", hint: "فتح الواجهة اليومية بأمان.", icon: "check" }
] as const;
