// V3-PERF-003: media review sessions, clips, transcript versions, and
// media-scoped review comments split out of the monolithic archive-api.ts
// client (V3-MEDIA-002/004/005, V3-PERF-005) -- same request/response shapes,
// same error handling, just grouped by the feature that owns them.
import type { components as GeneratedApiComponents } from "../generated/archive-api";
import type { ApiEnvelope, AuthRequestOptions } from "../archive-api";
import type { AppLocale } from "../i18n/types";

type GeneratedSchemas = GeneratedApiComponents["schemas"];

export type ReviewSessionState = GeneratedSchemas["ReviewSessionState"];
export type ReviewSession = GeneratedSchemas["ReviewSession"];
export type ReviewSessionCreatePayload = GeneratedSchemas["ReviewSessionCreateRequest"];
export type ReviewSessionTransitionPayload = GeneratedSchemas["ReviewSessionTransitionRequest"];

export type MediaClip = GeneratedSchemas["MediaClip"];
export type MediaClipCreatePayload = GeneratedSchemas["MediaClipCreateRequest"];
export type MediaClipUpdatePayload = GeneratedSchemas["MediaClipUpdateRequest"];

export type TranscriptCue = GeneratedSchemas["TranscriptCue"];
export type TranscriptVersion = GeneratedSchemas["TranscriptVersion"];
export type TranscriptCurrentState = GeneratedSchemas["TranscriptCurrentState"];
export type TranscriptVersionStorePayload = GeneratedSchemas["TranscriptVersionStoreRequest"];
export type TranscriptVersionRestorePayload = GeneratedSchemas["TranscriptVersionRestoreRequest"];

export type MediaReviewCommentType = GeneratedSchemas["MediaReviewCommentType"];
export type MediaReviewCommentState = GeneratedSchemas["MediaReviewCommentState"];
export type MediaReviewComment = GeneratedSchemas["MediaReviewComment"];
export type MediaReviewCommentCreatePayload = GeneratedSchemas["MediaReviewCommentCreateRequest"];
export type MediaReviewCommentUpdatePayload = GeneratedSchemas["MediaReviewCommentUpdateRequest"];

// ponytail: /media/jobs/queue-status has no request body and isn't modeled in
// the OpenAPI contract yet (poll-only diagnostic added with V3-PERF-005's
// queue backpressure work) -- add it to docs/api/archive-contract.openapi.json
// if it grows a second consumer worth generating types for.
export interface MediaQueueStatus {
  default: number;
  gpu: number;
  device: string;
  resourceFailure: string | null;
}

/** The subset of createArchiveApiClient's request machinery this slice needs. */
export interface MediaReviewRequestKit {
  get: <T extends object>(path: string, options?: AuthRequestOptions) => Promise<ApiEnvelope<T>>;
  post: <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) => Promise<ApiEnvelope<T>>;
  patch: <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) => Promise<ApiEnvelope<T>>;
  del: <T extends object>(path: string, body?: unknown, options?: AuthRequestOptions) => Promise<ApiEnvelope<T>>;
  fetchImpl: typeof fetch;
  baseUrl: string;
  currentLocale: () => AppLocale;
  getAccessToken: (options?: AuthRequestOptions) => string | undefined;
  clientUploadError: (locale: AppLocale, kind: "network" | "invalid-response" | "http" | "export", status?: number) => string;
}

export function createMediaReviewClient(kit: MediaReviewRequestKit) {
  const { get, post, patch, del, fetchImpl, baseUrl, currentLocale, getAccessToken, clientUploadError } = kit;

  return {
    mediaJobQueueStatus: (options?: AuthRequestOptions) => get<{ status: MediaQueueStatus }>("/media/jobs/queue-status", options),
    reviewSessions: (recordId: string, params?: { store?: string; attachmentId?: string }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.store) queryParams.set("store", params.store);
      if (params?.attachmentId) queryParams.set("attachmentId", params.attachmentId);
      const query = queryParams.toString();
      return get<{ sessions: ReviewSession[] }>(`/records/${encodeURIComponent(recordId)}/review-sessions${query ? `?${query}` : ""}`, options);
    },
    createReviewSession: (recordId: string, payload?: ReviewSessionCreatePayload, options?: AuthRequestOptions) =>
      post<{ session: ReviewSession }>(`/records/${encodeURIComponent(recordId)}/review-sessions`, payload ?? {}, options),
    transitionReviewSession: (
      id: string,
      action: "start" | "request-changes" | "approve" | "resume" | "close",
      payload?: ReviewSessionTransitionPayload,
      options?: AuthRequestOptions
    ) => post<{ session: ReviewSession }>(`/review-sessions/${encodeURIComponent(id)}/${action}`, payload ?? {}, options),
    mediaClips: (recordId: string, params?: { store?: string; attachmentId?: string }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.store) queryParams.set("store", params.store);
      if (params?.attachmentId) queryParams.set("attachmentId", params.attachmentId);
      const query = queryParams.toString();
      return get<{ clips: MediaClip[] }>(`/records/${encodeURIComponent(recordId)}/clips${query ? `?${query}` : ""}`, options);
    },
    createMediaClip: (recordId: string, payload: MediaClipCreatePayload, options?: AuthRequestOptions) =>
      post<{ clip: MediaClip }>(`/records/${encodeURIComponent(recordId)}/clips`, payload, options),
    updateMediaClip: (id: string, payload: MediaClipUpdatePayload, options?: AuthRequestOptions) =>
      patch<{ clip: MediaClip }>(`/clips/${encodeURIComponent(id)}`, payload, options),
    deleteMediaClip: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/clips/${encodeURIComponent(id)}`, undefined, options),
    downloadMediaClipsExport: async (
      recordId: string,
      format: "json" | "csv",
      params?: { store?: string; attachmentId?: string },
      options?: AuthRequestOptions
    ): Promise<ApiEnvelope<{ blob: Blob; filename: string }>> => {
      const queryParams = new URLSearchParams({ format });
      if (params?.store) queryParams.set("store", params.store);
      if (params?.attachmentId) queryParams.set("attachmentId", params.attachmentId);
      const headers = new Headers({ Accept: format === "csv" ? "text/csv" : "application/json" });
      const accessToken = getAccessToken(options);
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

      try {
        const response = await fetchImpl(`${baseUrl}/records/${encodeURIComponent(recordId)}/clips/export?${queryParams.toString()}`, {
          headers,
          credentials: "include"
        });
        if (!response.ok) {
          return { ok: false, error: clientUploadError(currentLocale(), "export", response.status) };
        }
        const contentDisposition = response.headers.get("content-disposition") || "";
        const disposedName = contentDisposition.match(/filename=([^;]+)/i)?.[1]?.replace(/^"|"$/g, "");
        const filename = disposedName || `clip-list-${recordId}.${format}`;
        return { ok: true, blob: await response.blob(), filename };
      } catch {
        return {
          ok: false,
          error: currentLocale() === "en"
            ? "Unable to connect to the server to export the clip list."
            : "تعذر الاتصال بالخادم لتصدير قائمة المقاطع."
        };
      }
    },
    transcriptVersions: (recordId: string, params?: { store?: string }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.store) queryParams.set("store", params.store);
      const query = queryParams.toString();
      return get<{ current: TranscriptCurrentState; versions: TranscriptVersion[] }>(
        `/records/${encodeURIComponent(recordId)}/transcript/versions${query ? `?${query}` : ""}`,
        options
      );
    },
    saveTranscriptVersion: (recordId: string, payload: TranscriptVersionStorePayload, options?: AuthRequestOptions) =>
      post<{ version: TranscriptVersion }>(`/records/${encodeURIComponent(recordId)}/transcript/versions`, payload, options),
    lockTranscriptVersion: (recordId: string, payload?: { store?: string }, options?: AuthRequestOptions) =>
      post<{ version: TranscriptVersion }>(`/records/${encodeURIComponent(recordId)}/transcript/lock`, payload ?? {}, options),
    restoreTranscriptVersion: (recordId: string, versionId: string, payload?: TranscriptVersionRestorePayload, options?: AuthRequestOptions) =>
      post<{ version: TranscriptVersion }>(
        `/records/${encodeURIComponent(recordId)}/transcript/versions/${encodeURIComponent(versionId)}/restore`,
        payload ?? {},
        options
      ),
    mediaReviewComments: (recordId: string, params?: { store?: string; attachmentId?: string; reviewSessionId?: string }, options?: AuthRequestOptions) => {
      const queryParams = new URLSearchParams();
      if (params?.store) queryParams.set("store", params.store);
      if (params?.attachmentId) queryParams.set("attachmentId", params.attachmentId);
      if (params?.reviewSessionId) queryParams.set("reviewSessionId", params.reviewSessionId);
      const query = queryParams.toString();
      return get<{ comments: MediaReviewComment[] }>(`/records/${encodeURIComponent(recordId)}/media-review-comments${query ? `?${query}` : ""}`, options);
    },
    createMediaReviewComment: (recordId: string, payload: MediaReviewCommentCreatePayload, options?: AuthRequestOptions) =>
      post<{ comment: MediaReviewComment }>(`/records/${encodeURIComponent(recordId)}/media-review-comments`, payload, options),
    updateMediaReviewComment: (id: string, payload: MediaReviewCommentUpdatePayload, options?: AuthRequestOptions) =>
      patch<{ comment: MediaReviewComment }>(`/media-review-comments/${encodeURIComponent(id)}`, payload, options),
    deleteMediaReviewComment: (id: string, options?: AuthRequestOptions) =>
      del<{ deleted: boolean }>(`/media-review-comments/${encodeURIComponent(id)}`, undefined, options),
    resolveMediaReviewComment: (id: string, options?: AuthRequestOptions) =>
      post<{ comment: MediaReviewComment }>(`/media-review-comments/${encodeURIComponent(id)}/resolve`, undefined, options),
    reopenMediaReviewComment: (id: string, options?: AuthRequestOptions) =>
      post<{ comment: MediaReviewComment }>(`/media-review-comments/${encodeURIComponent(id)}/reopen`, undefined, options)
  };
}
