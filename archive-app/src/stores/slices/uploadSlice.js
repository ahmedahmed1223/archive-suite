/**
 * Upload queue slice — in-memory background queue for real file uploads (§753).
 *
 * Holds one entry per file the user dropped/picked. The actual transfer is run
 * by the `useChunkedUpload` hook (hash → PUT /api/files with progress); this
 * slice owns the queue state so the user can keep working while uploads run and
 * the UploadQueue UI can render live per-file + overall progress.
 *
 * Entry status: queued → hashing → uploading → done | error | paused | duplicate
 */

let uploadSeq = 0;
function nextUploadId() {
  uploadSeq += 1;
  return `up_${Date.now().toString(36)}_${uploadSeq}`;
}

export const uploadInitialState = {
  uploads: []
};

export const uploadActionKeys = [
  "enqueueUploads",
  "updateUpload",
  "removeUpload",
  "retryUpload",
  "clearFinishedUploads"
];

/** Derived: overall progress (0..100) across active/queued entries. */
export function selectUploadProgress(uploads) {
  const active = uploads.filter((u) => u.status !== "done" && u.status !== "duplicate");
  if (active.length === 0) return 100;
  const sum = active.reduce((acc, u) => acc + (u.progress || 0), 0);
  return Math.round(sum / active.length);
}

export function createUploadActions({ set, get }) {
  return {
    /**
     * Add files to the queue. Returns the created entries (with ids) so the
     * caller can immediately drive them through the upload hook.
     * @param {File[]|FileList} files
     * @param {object} context optional linkage metadata (source, linkedItemId, fieldKey)
     */
    enqueueUploads: (files = [], context = {}) => {
      const list = Array.from(files || []);
      const entries = list.map((file) => ({
        id: nextUploadId(),
        file,
        name: file.name || "ملف",
        size: file.size || 0,
        type: file.type || "",
        status: "queued",
        progress: 0,
        key: null,
        url: null,
        error: null,
        createdAt: Date.now(),
        ...(context && typeof context === "object" ? context : {})
      }));
      if (entries.length) {
        set((state) => ({ uploads: [...state.uploads, ...entries] }));
      }
      return entries;
    },

    updateUpload: (id, patch = {}) =>
      set((state) => ({
        uploads: state.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u))
      })),

    removeUpload: (id) =>
      set((state) => ({ uploads: state.uploads.filter((u) => u.id !== id) })),

    /** Reset a failed/paused entry back to queued so the caller can restart it. */
    retryUpload: (id) => {
      set((state) => ({
        uploads: state.uploads.map((u) =>
          u.id === id ? { ...u, status: "queued", progress: 0, error: null } : u
        )
      }));
      return get().uploads.find((u) => u.id === id) || null;
    },

    clearFinishedUploads: () =>
      set((state) => ({
        uploads: state.uploads.filter(
          (u) => u.status !== "done" && u.status !== "duplicate"
        )
      }))
  };
}
