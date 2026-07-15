import type { OnboardingProgress, OnboardingStageId } from "@/lib/archive-api";

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

export function toOnboardingProgressSteps(progress: OnboardingProgress): OnboardingProgressStep[] {
  const stages = new Map(progress.stages.map((stage) => [stage.id, stage]));

  return stageOrder.map((id) => ({
    id,
    ...stepDetails[id],
    completed: stages.get(id)?.status === "completed"
  }));
}
