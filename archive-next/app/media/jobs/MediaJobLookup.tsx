"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { KeyRound, SearchCheck } from "lucide-react";
import { z } from "zod";
import { FieldError } from "@/components/ui/Form";
import { createArchiveApiClient, type MediaJob, type MediaJobStatus, type MediaOperation } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; job: MediaJob }
  | { status: "error"; message: string };

type LookupFormValues = { jobId: string; accessToken?: string };

function labelFor(labels: object, value: string): string {
  const label = (labels as Record<string, unknown>)[value];
  return typeof label === "string" ? label : value;
}

export function MediaJobLookup() {
  const { t } = useLocale();
  const copy = t.pages.mediaJobLookup;
  const api = useMemo(() => createArchiveApiClient(), []);
  const lookupSchema = useMemo(() => z.object({
    jobId: z.string().trim().min(1, copy.validation.jobIdRequired),
    accessToken: z.string().trim().optional().transform((value) => value || undefined)
  }), [copy.validation.jobIdRequired]);
  const operationLabel = (operation: MediaOperation) => labelFor(copy.operations, operation);
  const statusLabel = (status: MediaJobStatus) => labelFor(copy.statuses, status);
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
      setState({ status: "error", message: parsed.error.issues[0]?.message || copy.validation.reviewData });
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
    <form className="workspace-panel auth-form" onSubmit={handleSubmit} aria-label={copy.form.ariaLabel}>
      <div className="workspace-panel__header">
        <div>
          <h2>{copy.form.title}</h2>
          <p>{copy.form.description}</p>
        </div>
        <span className="badge">{copy.form.directCheck}</span>
      </div>

      <label>
        {copy.form.jobId}
        <input type="text" placeholder={copy.form.jobIdPlaceholder} autoComplete="off" {...form.register("jobId")} />
        <FieldError>{errors.jobId?.message}</FieldError>
      </label>

      <details className="section-divider">
        <summary className="field-note">
          <KeyRound size={15} aria-hidden="true" />
          {copy.form.advancedOptions}
        </summary>
        <p className="field-note">{copy.form.accessTokenDescription}</p>
        <label>
          {copy.form.accessToken}
          <input type="password" placeholder={copy.form.accessTokenPlaceholder} autoComplete="off" {...form.register("accessToken")} />
          <FieldError>{errors.accessToken?.message}</FieldError>
        </label>
      </details>

      <button type="submit" className="button button-primary" disabled={state.status === "loading"}>
        <SearchCheck size={16} aria-hidden="true" />
        {state.status === "loading" ? copy.form.checking : copy.form.submit}
      </button>

      <p className="form-status" role={state.status === "error" ? "alert" : "status"}>
        {state.status === "ready"
          ? copy.form.found.replace("{status}", statusLabel(state.job.status)).replace("{operation}", operationLabel(state.job.operation))
          : state.status === "error"
            ? state.message
            : copy.form.idle}
      </p>
    </form>
  );
}
