"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { KeyRound, SearchCheck } from "lucide-react";
import { z } from "zod";
import { FieldError } from "@/components/ui/Form";
import { createArchiveApiClient, type MediaJob, type MediaJobStatus, type MediaOperation } from "@/lib/archive-api";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; job: MediaJob }
  | { status: "error"; message: string };

const lookupSchema = z.object({
  jobId: z.string().trim().min(1, "أدخل معرّف المهمة قبل الفحص."),
  accessToken: z.string().trim().optional().transform((value) => value || undefined)
});

type LookupFormValues = z.input<typeof lookupSchema>;

function operationLabel(operation: MediaOperation) {
  const labels: Record<MediaOperation, string> = {
    thumbnail: "صورة مصغرة",
    transcode: "تحويل صيغة",
    transcription: "تفريغ نصي",
    ocr: "استخراج نص OCR",
    montage_export: "تصدير مونتاج"
  };

  return labels[operation] || operation;
}

function statusLabel(status: MediaJobStatus) {
  const labels: Record<MediaJobStatus, string> = {
    queued: "قيد الانتظار",
    processing: "قيد المعالجة",
    completed: "مكتمل",
    failed: "فشل",
    canceled: "ملغى"
  };

  return labels[status] || status;
}

export function MediaJobLookup() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const form = useForm<LookupFormValues>({
    defaultValues: {
      jobId: "",
      accessToken: ""
    }
  });
  const errors = form.formState.errors;

  const handleSubmit = form.handleSubmit(async (values) => {
    form.clearErrors();
    const parsed = lookupSchema.safeParse(values);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field && typeof field === "string") {
          form.setError(field as keyof LookupFormValues, { type: "zod", message: issue.message });
        }
      });
      setState({ status: "error", message: parsed.error.issues[0]?.message || "راجع بيانات الفحص." });
      return;
    }

    setState({ status: "loading" });
    const response = await api.mediaJob(parsed.data.jobId, parsed.data.accessToken ? { accessToken: parsed.data.accessToken } : undefined);

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({ status: "ready", job: response.job });
  });

  return (
    <form className="workspace-panel auth-form" onSubmit={handleSubmit} aria-label="فحص مهمة وسائط">
      <div className="workspace-panel__header">
        <div>
          <h2>فحص مهمة محددة</h2>
          <p>تحقق بسرعة من حالة مهمة الوسائط ونتيجتها من الخادم.</p>
        </div>
        <span className="badge">فحص مباشر</span>
      </div>

      <label>
        معرّف المهمة
        <input type="text" placeholder="معرّف مهمة الوسائط" autoComplete="off" {...form.register("jobId")} />
        <FieldError>{errors.jobId?.message}</FieldError>
      </label>

      <details className="section-divider">
        <summary className="field-note">
          <KeyRound size={15} aria-hidden="true" />
          خيارات متقدمة للمسؤول
        </summary>
        <p className="field-note">استخدم رمز وصول بديلًا فقط عند فحص مهمة ضمن جلسة أو بيئة مختلفة.</p>
        <label>
          رمز الوصول
          <input type="password" placeholder="رمز Bearer اختياري" autoComplete="off" {...form.register("accessToken")} />
          <FieldError>{errors.accessToken?.message}</FieldError>
        </label>
      </details>

      <button type="submit" className="button button-primary" disabled={state.status === "loading"}>
        <SearchCheck size={16} aria-hidden="true" />
        {state.status === "loading" ? "جار الفحص..." : "فحص حالة المهمة"}
      </button>

      <p className="form-status" role={state.status === "error" ? "alert" : "status"}>
        {state.status === "ready"
          ? `تم العثور على المهمة. الحالة الحالية: ${statusLabel(state.job.status)}، ونوع العملية: ${operationLabel(state.job.operation)}.`
          : state.status === "error"
            ? state.message
            : "أدخل معرّف المهمة لعرض حالتها من الخادم."}
      </p>
    </form>
  );
}
