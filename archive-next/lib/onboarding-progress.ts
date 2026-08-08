import type { OnboardingProgress, OnboardingStageId } from "@/lib/archive-api";
import type { OnboardingLocale } from "@/lib/onboarding";

export interface OnboardingProgressStep {
  id: OnboardingStageId;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  completed: boolean;
}

const stepDetails: Record<OnboardingStageId, Omit<OnboardingProgressStep, "id" | "completed">> = {
  organization: {
    title: "إعداد المؤسسة",
    description: "راجع اسم المؤسسة وإعداداتها الأساسية قبل دعوة الفريق.",
    href: "/settings",
    actionLabel: "فتح الإعدادات"
  },
  storage: {
    title: "تأكيد التخزين",
    description: "اضبط التخزين وتحقق من اتصاله قبل رفع المواد.",
    href: "/settings",
    actionLabel: "فتح الإعدادات"
  },
  invitation: {
    title: "دعوة الفريق",
    description: "أضف مستخدمًا واحدًا على الأقل بالدور المناسب.",
    href: "/settings/users",
    actionLabel: "إدارة المستخدمين"
  },
  first_record: {
    title: "إضافة أول مادة",
    description: "ارفع مادة أولى ثم أكمل بياناتها الأساسية.",
    href: "/uploads",
    actionLabel: "رفع مادة"
  },
  first_search: {
    title: "إجراء أول بحث",
    description: "ابحث عن مادة للتأكد من جاهزية الفهرس وسير العمل.",
    href: "/search",
    actionLabel: "فتح البحث"
  }
};

const stageOrder: OnboardingStageId[] = ["organization", "storage", "invitation", "first_record", "first_search"];

const stepDetailsEn: Record<OnboardingStageId, Omit<OnboardingProgressStep, "id" | "completed">> = {
  organization: { title: "Set up the organization", description: "Review the organization name and essential settings before inviting the team.", href: "/settings", actionLabel: "Open settings" },
  storage: { title: "Confirm storage", description: "Configure storage and verify its connection before uploading material.", href: "/settings", actionLabel: "Open settings" },
  invitation: { title: "Invite the team", description: "Add at least one user with the appropriate role.", href: "/settings/users", actionLabel: "Manage users" },
  first_record: { title: "Add the first record", description: "Upload an initial item, then complete its core metadata.", href: "/uploads", actionLabel: "Upload item" },
  first_search: { title: "Run the first search", description: "Search for a record to confirm that the index and workflow are ready.", href: "/search", actionLabel: "Open search" }
};

export function toOnboardingProgressSteps(progress: OnboardingProgress, locale: OnboardingLocale = "ar"): OnboardingProgressStep[] {
  const stages = new Map(progress.stages.map((stage) => [stage.id, stage]));
  const details = locale === "en" ? stepDetailsEn : stepDetails;

  return stageOrder.map((id) => ({
    id,
    ...details[id],
    completed: stages.get(id)?.status === "completed"
  }));
}
