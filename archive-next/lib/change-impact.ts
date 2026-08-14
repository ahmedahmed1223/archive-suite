export type ChangeImpactAction = "delete" | "merge" | "move" | "schema" | "update";

export type ChangeImpact = {
  tone: "danger" | "warning" | "safe";
  summary: string;
  detail: string;
  undoLabel?: string;
};

export function countAffectedRecords<T>(records: T[], matches: (record: T) => boolean) {
  return records.filter(matches).length;
}

export function buildChangeImpact({
  action,
  entity,
  affectedCount,
  reversible = false,
  locale = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ar"
}: {
  action: ChangeImpactAction;
  entity: string;
  affectedCount: number;
  reversible?: boolean;
  locale?: AppLocale;
}): ChangeImpact {
  if (affectedCount === 0) {
    return {
      tone: "safe",
      summary: locale === "ar" ? `تحديث ${entity}` : `Update ${entity}`,
      detail: locale === "ar" ? "لن يتأثر أي سجل بهذا التغيير." : "No records will be affected by this change."
    };
  }

  const actionLabel = locale === "ar"
    ? action === "merge" ? "دمج" : action === "delete" ? "حذف" : action === "schema" ? "تعديل مخطط" : action === "move" ? "نقل" : "تحديث"
    : action === "merge" ? "Merge" : action === "delete" ? "Delete" : action === "schema" ? "Edit schema" : action === "move" ? "Move" : "Update";
  const countDetail = locale === "ar"
    ? `سيؤثر على ${affectedCount} سجل${affectedCount === 1 ? "" : "ات"}.`
    : `This will affect ${affectedCount} record${affectedCount === 1 ? "" : "s"}.`;

  if (reversible) {
    return {
      tone: "warning",
      summary: `${actionLabel} ${entity}`,
      detail: locale === "ar" ? `${countDetail} يمكن التراجع بعد التنفيذ.` : `${countDetail} This can be undone after execution.`,
      undoLabel: locale === "ar" ? "تراجع" : "Undo"
    };
  }

  return {
    tone: action === "update" ? "warning" : "danger",
    summary: `${actionLabel} ${entity}`,
    detail: locale === "ar" ? `${countDetail} لا يمكن التراجع بعد التنفيذ.` : `${countDetail} This cannot be undone after execution.`
  };
}
import type { AppLocale } from "@/lib/i18n/types";
