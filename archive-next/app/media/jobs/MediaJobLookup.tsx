"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createArchiveApiClient, type MediaJob } from "@/lib/archive-api";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; job: MediaJob }
  | { status: "error"; message: string };

export function MediaJobLookup() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<LookupState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const jobId = String(data.get("jobId") ?? "").trim();
    const accessToken = String(data.get("accessToken") ?? "").trim();

    if (!jobId) {
      setState({ status: "error", message: "أدخل معرّف job قبل الفحص." });
      return;
    }

    setState({ status: "loading" });
    const response = await api.mediaJob(jobId, accessToken ? { accessToken } : undefined);

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({ status: "ready", job: response.job });
  }

  return (
    <form className="panel auth-form" onSubmit={handleSubmit} aria-label="فحص media jobs">
      <label>
        معرّف job
        <input name="jobId" type="text" placeholder="media-job-id" autoComplete="off" />
      </label>

      <label>
        Access token
        <input name="accessToken" type="password" placeholder="Bearer token اختياري للفحص المحلي" autoComplete="off" />
      </label>

      <button type="submit" disabled={state.status === "loading"}>
        {state.status === "loading" ? "جار الفحص..." : "فحص حالة job"}
      </button>

      <p className="form-status" role={state.status === "error" ? "alert" : "status"}>
        {state.status === "ready"
          ? `الحالة: ${state.job.status} / العملية: ${state.job.operation}`
          : state.status === "error"
            ? state.message
            : "يطلب هذا النموذج /api/v1/media/jobs/:id من Laravel عبر rewrite الخاص بـ Next.js."}
      </p>
    </form>
  );
}
