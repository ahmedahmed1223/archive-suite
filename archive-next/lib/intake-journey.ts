export type IntakeStep = "files" | "metadata" | "review";
export type IntakeMode = "guided" | "quick";

export type IntakeDraft = {
  version: 1;
  step: IntakeStep;
  mode: IntakeMode;
  folder: string;
  titlePrefix: string;
  type: string;
  subtype: string;
  tags: string;
  summary: string;
  templateId: string;
  updatedAt: string;
};

export type IntakeFileProgress = {
  fileName: string;
  status: "pending" | "uploading" | "success" | "error";
  message?: string;
};

export const intakeStatusLabels = {
  pending: "بانتظار الرفع",
  uploading: "جار الرفع",
  success: "اكتمل",
  error: "تعذر الرفع",
} as const;

export function recoverIntakeDraft(value: string | null): IntakeDraft | null {
  if (!value) return null;
  try {
    const draft = JSON.parse(value) as Partial<IntakeDraft>;
    const steps: IntakeStep[] = ["files", "metadata", "review"];
    const modes: IntakeMode[] = ["guided", "quick"];
    if (
      draft.version !== 1 ||
      !steps.includes(draft.step as IntakeStep) ||
      !modes.includes(draft.mode as IntakeMode) ||
      typeof draft.updatedAt !== "string"
    ) return null;

    const fields: Array<keyof Pick<IntakeDraft, "folder" | "titlePrefix" | "type" | "subtype" | "tags" | "summary" | "templateId">> =
      ["folder", "titlePrefix", "type", "subtype", "tags", "summary", "templateId"];
    if (fields.some((field) => typeof draft[field] !== "string")) return null;
    return draft as IntakeDraft;
  } catch {
    return null;
  }
}

export function findDuplicateFiles(files: Array<{ name: string; size: number }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  files.forEach((file) => {
    const key = `${file.name}\u0000${file.size}`;
    if (seen.has(key)) duplicates.add(file.name);
    seen.add(key);
  });
  return [...duplicates];
}

export function summarizeFileProgress(files: IntakeFileProgress[]) {
  const retryable = files.filter((file) => file.status === "error").map((file) => file.fileName);
  return {
    total: files.length,
    succeeded: files.filter((file) => file.status === "success").length,
    failed: retryable.length,
    pending: files.filter((file) => file.status === "pending" || file.status === "uploading").length,
    retryable,
  };
}

export function deriveReviewReadiness(input: { fileCount: number; mode: IntakeMode; type: string }) {
  const missing: Array<"files" | "type"> = [];
  if (input.fileCount === 0) missing.push("files");
  if (input.mode === "guided" && !input.type.trim()) missing.push("type");
  return { ready: missing.length === 0, missing };
}

export function deriveIntakeNextAction(input: {
  fileCount: number;
  mode: IntakeMode;
  type: string;
  failedFiles: number;
  completed?: boolean;
}) {
  if (input.failedFiles > 0) return { key: "retry-failed", label: "إعادة محاولة الملفات المتعثرة" } as const;
  if (input.completed) return { key: "open-jobs", label: "متابعة مهام المعالجة", href: "/media/jobs" } as const;
  const readiness = deriveReviewReadiness(input);
  if (readiness.missing.includes("files")) return { key: "select-files", label: "اختيار الملفات" } as const;
  if (readiness.missing.includes("type")) return { key: "complete-metadata", label: "استكمال بيانات الأرشفة" } as const;
  return { key: "review", label: "مراجعة الإضافة" } as const;
}
