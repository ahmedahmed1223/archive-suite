export const ONBOARDING_STORAGE_KEY = "masar:first-run:v1";
export const ONBOARDING_PROMPT_DISMISSED_KEY = "masar:first-run:prompt-dismissed:v1";
export const ONBOARDING_PRESET_STORAGE_KEY = "masar:first-run:preset";

export type OnboardingPreset = "quick" | "advanced";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  command?: string;
  href?: string;
  actionLabel?: string;
}

export const onboardingPresets: Record<OnboardingPreset, {
  label: string;
  summary: string;
  command: string;
  steps: OnboardingStep[];
}> = {
  quick: {
    label: "تهيئة سريعة",
    summary: "أفضل مسار لجهاز جديد: يفحص البيئة، ينشئ الأسرار، يشغل Docker، ثم يراجع الصحة.",
    command: "setup quick",
    steps: [
      {
        id: "doctor",
        title: "فحص المتطلبات",
        description: "يتحقق Control Center من Node.js وpnpm وDocker وملف البيئة قبل البدء.",
        command: "setup doctor"
      },
      {
        id: "quick",
        title: "تشغيل المسار السريع",
        description: "ينشئ الأسرار المطلوبة ويشغل Laravel + Next.js ثم ينفذ فحص الصحة.",
        command: "setup quick"
      },
      {
        id: "login",
        title: "الدخول الأول",
        description: "استخدم البريد وكلمة المرور التي يعرضها Control Center عند توليدها لأول مرة.",
        href: "/login",
        actionLabel: "فتح تسجيل الدخول"
      },
      {
        id: "status",
        title: "تأكيد صحة النظام",
        description: "راجع اتصال API ومحرك البيانات قبل بدء العمل اليومي.",
        href: "/status",
        actionLabel: "فتح الحالة"
      }
    ]
  },
  advanced: {
    label: "تهيئة متقدمة",
    summary: "مناسبة للخادم أو staging: فحص، ضبط URL/الأسرار، تشغيل، هجرات، ثم فحص صحة.",
    command: "setup first-run",
    steps: [
      {
        id: "doctor",
        title: "فحص البيئة",
        description: "ابدأ بتقرير غير تخريبي يوضح النواقص قبل أي تشغيل.",
        command: "setup doctor"
      },
      {
        id: "deploy",
        title: "Provision مضبوط",
        description: "ينشئ .env من المثال ويولّد الأسرار الناقصة ويشغل stack كامل.",
        command: "setup deploy"
      },
      {
        id: "configure",
        title: "مراجعة الإعدادات العامة",
        description: "راجع الرابط العام والمنفذ والبريد ومزود الملفات قبل فتح النظام للفريق.",
        command: "setup config"
      },
      {
        id: "migrations",
        title: "الهجرات والصحة",
        description: "تحقق من حالة قاعدة البيانات، ثم نفذ فحص صحة عبر Next إلى Laravel.",
        command: "setup migrate-status && setup health"
      },
      {
        id: "settings",
        title: "استكمال إدارة النظام",
        description: "افتح الإعدادات لإدارة الهوية، المستخدمين، الأمان، وODBC بعد الدخول.",
        href: "/settings",
        actionLabel: "فتح الإعدادات"
      }
    ]
  }
};

export const onboardingChecklist = [
  "احتفظ بكلمة مرور المدير التي تظهر أول مرة من Control Center في مخزن أسرار آمن.",
  "لا تشارك ملف .env أو لقطات شاشة تحتوي secrets أو tokens.",
  "استخدم setup doctor قبل إعادة النشر عندما تنتقل إلى جهاز أو خادم جديد.",
  "افتح /status و/system/control بعد الدخول للتأكد من أن التشغيل والصلاحيات كما تتوقع."
] as const;
