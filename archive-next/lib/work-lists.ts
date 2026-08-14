import type { ArchiveRecord } from "@/lib/archive-api";
import type { AppLocale } from "@/lib/i18n/types";

/**
 * قوائم العمل الشخصية (V1-825): اختصارات جاهزة فوق فلاتر الأرشيف والحقوق
 * القائمة أصلاً، لا خدمة مهام مستقلة ولا تخزين جديد.
 */
export interface WorkList {
  id: string;
  label: string;
  description: string;
  href: string;
}

/** نافذة التحذير من انتهاء الحقوق، مطابقة لـ`WARNING_WINDOW_DAYS` في صفحة الحقوق. */
export const RIGHTS_WARNING_WINDOW_DAYS = 30;

/**
 * المادة ناقصة التوصيف عندما يقول الخادم إن اكتمال التوصيف ليس مكتملًا.
 * غياب الحقل يعني «لا حكم» فلا تُصنَّف ناقصة.
 */
export function isIncompleteRecord(record: ArchiveRecord): boolean {
  const completion = record.descriptorCompletion;
  if (!completion) return false;
  return completion.status !== "green";
}

export const WORK_LISTS: WorkList[] = [
  {
    id: "incomplete",
    label: "مواد ناقصة التوصيف",
    description: "مواد ينقصها العنوان أو الوصف أو النوع أو الوسوم.",
    href: "/archive?completion=incomplete"
  },
  {
    id: "drafts",
    label: "مسوداتي",
    description: "مواد ما زالت في حالة مسودة ولم تُدفع للمراجعة.",
    href: "/archive?status=draft"
  },
  {
    id: "awaiting-review",
    label: "بانتظار المراجعة",
    description: "مواد أُرسلت للمراجعة وتنتظر إجراءً.",
    href: "/archive?status=review"
  },
  {
    id: "expiring-rights",
    label: "حقوق تقترب من الانتهاء",
    description: `حقوق تنتهي خلال ${RIGHTS_WARNING_WINDOW_DAYS} يومًا أو أقل.`,
    href: "/rights"
  }
];

const ENGLISH_WORK_LISTS: WorkList[] = [
  {
    id: "incomplete",
    label: "Records needing description",
    description: "Records missing a title, description, type, or tags.",
    href: "/archive?completion=incomplete"
  },
  {
    id: "drafts",
    label: "My drafts",
    description: "Records still in draft and not yet sent for review.",
    href: "/archive?status=draft"
  },
  {
    id: "awaiting-review",
    label: "Awaiting review",
    description: "Records sent for review and awaiting action.",
    href: "/archive?status=review"
  },
  {
    id: "expiring-rights",
    label: "Rights nearing expiry",
    description: `Rights expiring in ${RIGHTS_WARNING_WINDOW_DAYS} days or less.`,
    href: "/rights"
  }
];

export function getWorkLists(locale: AppLocale = "ar"): WorkList[] {
  return locale === "en" ? ENGLISH_WORK_LISTS : WORK_LISTS;
}
