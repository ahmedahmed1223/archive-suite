export const ONBOARDING_STORAGE_KEY = "masar:first-run:v1";
export const ONBOARDING_PROMPT_DISMISSED_KEY = "masar:first-run:prompt-dismissed:v1";
export const ONBOARDING_PRESET_STORAGE_KEY = "masar:first-run:preset";

export type OnboardingPreset = "quick" | "advanced";
export type OnboardingLocale = "ar" | "en";

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

const onboardingPresetsEn: Record<OnboardingPreset, typeof onboardingPresets[OnboardingPreset]> = {
  quick: {
    label: "Quick setup",
    summary: "The recommended path for a new machine: checks the environment, creates secrets, starts Docker, and verifies service health.",
    command: "setup quick",
    steps: [
      { id: "doctor", title: "Check requirements", description: "Control Center verifies Node.js, pnpm, Docker, and the environment file before setup begins.", command: "setup doctor" },
      { id: "quick", title: "Run quick setup", description: "Creates the required secrets, starts Laravel and Next.js, then runs a health check.", command: "setup quick" },
      { id: "login", title: "First sign-in", description: "Use the email address and password shown by Control Center when they are generated for the first time.", href: "/login", actionLabel: "Open sign-in" },
      { id: "status", title: "Confirm system health", description: "Review the API and data-engine connection before daily work begins.", href: "/status", actionLabel: "Open status" }
    ]
  },
  advanced: {
    label: "Advanced setup",
    summary: "For a server or staging environment: inspect, configure the URL and secrets, start services, apply migrations, then check health.",
    command: "setup first-run",
    steps: [
      { id: "doctor", title: "Inspect the environment", description: "Start with a non-destructive report that identifies missing requirements before any service is started.", command: "setup doctor" },
      { id: "deploy", title: "Provision the stack", description: "Creates .env from the example, generates missing secrets, and starts the complete stack.", command: "setup deploy" },
      { id: "configure", title: "Review general settings", description: "Confirm the public URL, port, email, and file provider before opening the system to the team.", command: "setup config" },
      { id: "migrations", title: "Migrations and health", description: "Check the database status, then run the health check from Next to Laravel.", command: "setup migrate-status && setup health" },
      { id: "settings", title: "Finish system administration", description: "Open Settings after sign-in to manage identity, users, security, and ODBC.", href: "/settings", actionLabel: "Open settings" }
    ]
  }
};

const onboardingChecklistEn = [
  "Store the administrator password shown by Control Center the first time in a secure secret store.",
  "Do not share the .env file or screenshots that contain secrets or tokens.",
  "Run setup doctor before redeploying on a new device or server.",
  "After sign-in, open /status and /system/control to confirm that services and permissions match your expectations."
] as const;

export function getOnboardingPresets(locale: OnboardingLocale) {
  return locale === "en" ? onboardingPresetsEn : onboardingPresets;
}

export function getOnboardingChecklist(locale: OnboardingLocale) {
  return locale === "en" ? onboardingChecklistEn : onboardingChecklist;
}
