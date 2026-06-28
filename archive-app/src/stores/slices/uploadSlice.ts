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

export function selectUploadProgress(uploads: any[]) {
  const active = uploads.filter((u) => u.status !== "done" && u.status !== "duplicate");
  if (active.length === 0) return 100;
  const sum = active.reduce((acc, u) => acc + (u.progress || 0), 0);
  return Math.round(sum / active.length);
}

export function createUploadActions({ set, get }: { set: any; get: () => any }) {
  return {
    enqueueUploads: (files: ArrayLike<any> = [], context: Record<string, any> = {}) => {
      const list = Array.from(files || []);
      const entries = list.map((file: any) => ({
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
        set((state: any) => ({ uploads: [...state.uploads, ...entries] }));
      }
      return entries;
    },

    updateUpload: (id: string, patch: Record<string, any> = {}) =>
      set((state: any) => ({
        uploads: state.uploads.map((u: any) => (u.id === id ? { ...u, ...patch } : u))
      })),

    removeUpload: (id: string) =>
      set((state: any) => ({ uploads: state.uploads.filter((u: any) => u.id !== id) })),

    retryUpload: (id: string) => {
      set((state: any) => ({
        uploads: state.uploads.map((u: any) =>
          u.id === id ? { ...u, status: "queued", progress: 0, error: null } : u
        )
      }));
      return get().uploads.find((u: any) => u.id === id) || null;
    },

    clearFinishedUploads: () =>
      set((state: any) => ({
        uploads: state.uploads.filter((u: any) => u.status !== "done" && u.status !== "duplicate")
      }))
  };
}
