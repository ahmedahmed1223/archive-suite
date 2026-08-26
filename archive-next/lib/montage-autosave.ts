/**
 * V1.5 Task 4: autosave coordinator.
 * Debounces idle saves, aborts superseded requests, and never discards local
 * edits when the server answers 409 — the caller receives an explicit
 * conflict state with the server's current revision.
 */

export type AutosaveResult =
  | { status: "saved"; revisionNumber: number }
  | { status: "conflict"; currentRevision: number }
  | { status: "error"; message: string };

export type SavePayload = {
  expectedRevision: number;
  tracks: unknown[];
  clips: unknown[];
};

export type ApiClient = {
  saveRevision: (
    projectId: string,
    payload: SavePayload,
    signal: AbortSignal,
  ) => Promise<
    | { ok: true; revisionNumber: number }
    | { ok: false; status: number; currentRevision?: number; error?: string }
  >;
};

export function createAutosaveCoordinator(api: ApiClient, projectId: string) {
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestPayload: SavePayload | null = null;

  async function flush(): Promise<AutosaveResult> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const payload = latestPayload;
    if (!payload) return { status: "error", message: "nothing to save" };

    // Abort any superseded in-flight request; only the newest edit survives.
    controller?.abort();
    controller = new AbortController();

    const response = await api.saveRevision(projectId, payload, controller.signal);
    if (response.ok) {
      return { status: "saved", revisionNumber: response.revisionNumber };
    }
    if (response.status === 409) {
      // Keep local edits intact — the caller decides how to resolve.
      return { status: "conflict", currentRevision: response.currentRevision ?? -1 };
    }
    return { status: "error", message: response.error ?? "save failed" };
  }

  function schedule(payload: SavePayload, debounceMs = 1200): void {
    latestPayload = payload;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, debounceMs);
  }

  function dispose(): void {
    if (timer) clearTimeout(timer);
    controller?.abort();
  }

  return { schedule, flush, dispose };
}
