"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { SearchCheck } from "lucide-react";
import { z } from "zod";
import { FieldError } from "@/components/ui/Form";
import { createArchiveApiClient, type MediaJob } from "@/lib/archive-api";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; job: MediaJob }
  | { status: "error"; message: string };

const lookupSchema = z.object({
  jobId: z.string().trim().min(1, "أدخل معرّف job قبل الفحص."),
  accessToken: z.string().trim().optional().transform((value) => value || undefined)
});

type LookupFormValues = z.input<typeof lookupSchema>;

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
    <form className="workspace-panel auth-form" onSubmit={handleSubmit} aria-label="فحص media jobs">
      <div className="workspace-panel__header">
        <div>
          <h2>فحص job منفرد</h2>
          <p>تحقق سريع من حالة مهمة محددة عبر Laravel API.</p>
        </div>
        <span className="badge">lookup</span>
      </div>

      <label>
        معرّف job
        <input type="text" placeholder="media-job-id" autoComplete="off" {...form.register("jobId")} />
        <FieldError>{errors.jobId?.message}</FieldError>
      </label>

      <label>
        Access token
        <input type="password" placeholder="Bearer token اختياري للفحص المحلي" autoComplete="off" {...form.register("accessToken")} />
        <FieldError>{errors.accessToken?.message}</FieldError>
      </label>

      <button type="submit" className="button button-primary" disabled={state.status === "loading"}>
        <SearchCheck size={16} aria-hidden="true" />
        {state.status === "loading" ? "جار الفحص..." : "فحص حالة job"}
      </button>

      <p className="form-status" role={state.status === "error" ? "alert" : "status"}>
        {state.status === "ready"
          ? `الحالة: ${state.job.status} / العملية: ${state.job.operation}`
          : state.status === "error"
            ? state.message
            : "يفحص هذا النموذج حالة المهمة من واجهة Laravel API."}
      </p>
    </form>
  );
}
