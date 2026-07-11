export type ChangeImpactAction = "delete" | "merge" | "move" | "schema" | "update";

export type ChangeImpact = {
  tone: "danger" | "warning" | "safe";
  summary: string;
  detail: string;
  undoLabel?: "تراجع";
};

export function countAffectedRecords<T>(records: T[], matches: (record: T) => boolean) {
  return records.filter(matches).length;
}

export function buildChangeImpact({
  action,
  entity,
  affectedCount,
  reversible = false
}: {
  action: ChangeImpactAction;
  entity: string;
  affectedCount: number;
  reversible?: boolean;
}): ChangeImpact {
  if (affectedCount === 0) {
    return {
      tone: "safe",
      summary: `تحديث ${entity}`,
      detail: "لن يتأثر أي سجل بهذا التغيير."
    };
  }

  const actionLabel = action === "merge" ? "دمج" : action === "delete" ? "حذف" : action === "schema" ? "تعديل مخطط" : action === "move" ? "نقل" : "تحديث";
  const countDetail = `سيؤثر على ${affectedCount} سجل${affectedCount === 1 ? "" : "ات"}.`;

  if (reversible) {
    return {
      tone: "warning",
      summary: `${actionLabel} ${entity}`,
      detail: `${countDetail} يمكن التراجع بعد التنفيذ.`,
      undoLabel: "تراجع"
    };
  }

  return {
    tone: action === "update" ? "warning" : "danger",
    summary: `${actionLabel} ${entity}`,
    detail: `${countDetail} لا يمكن التراجع بعد التنفيذ.`
  };
}
