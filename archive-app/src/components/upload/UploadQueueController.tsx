import * as React from "react";

import { getCloudToken } from "../../bootstrap/cloudSession.js";
import { resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { useChunkedUpload } from "../../hooks/useChunkedUpload.js";
import { useAppStore } from "../../stores/appStore.js";
import { mergeUploadIntoVideoItem } from "../../features/upload/uploadLink.js";
import { getStorageProvider } from "@archive/core";
import { queueUploadedFile } from "../../features/file-manager/ingestQueue.js";

function completedUploadSnapshot(entry: any = {}, result: any = {}) {
  const duplicate = result?.duplicate || entry.status === "duplicate";
  return {
    ...(entry || {}),
    ...(result || {}),
    status: duplicate ? "duplicate" : "done",
    progress: 100
  };
}

async function patchLinkedItem(upload: any) {
  const linkedItemId = upload?.linkedItemId;
  const key = upload?.key || upload?.storageKey || upload?.fileKey || upload?.fileHash;
  if (!linkedItemId || !key) return;

  const state = useAppStore.getState();
  const item = state.videoItems?.find((candidate: any) => candidate.id === linkedItemId);
  if (!item) return;

  const patched = mergeUploadIntoVideoItem(item, upload);
  await state.updateVideoItem?.(
    {
      ...patched,
      version: (item.version || 1) + 1
    },
    { skipUndo: true, skipActivityLog: true }
  );
  state.showNotification?.("اكتمل رفع الملف وربطه بالمادة.", {
    type: "success",
    category: "upload",
    title: "اكتمل الرفع",
    targetLabel: item.title || upload.name || "ملف"
  });
}

/**
 * Persistent upload runner. Pages enqueue files, this root-level component owns
 * the actual transfer so navigation does not abort background uploads.
 */
export function UploadQueueController({ onStored }: any = {}) {
  const uploads = useAppStore((state: any) => state.uploads);
  const updateUpload = useAppStore((state: any) => state.updateUpload);
  const autoQueueUploads = useAppStore((state: any) => state.settings?.fileManager?.autoQueueUploads !== false);
  const backendChoice = React.useMemo(() => resolveBackendChoice(), []);
  const runningIds = React.useRef(new Set());

  const uploader = useChunkedUpload({
    baseUrl: backendChoice.url || "",
    getToken: getCloudToken,
    onUpdate: updateUpload,
    isDuplicate: (key: any) => {
      if (!key) return false;
      return useAppStore.getState().uploads?.some((item: any) =>
        item.key === key && (item.status === "done" || item.status === "duplicate")
      );
    }
  });

  React.useEffect(() => {
    for (const upload of uploads || []) {
      if (upload.status !== "queued" || !upload.file || runningIds.current.has(upload.id)) continue;
      runningIds.current.add(upload.id);
      void uploader.start(upload).then(async (result: any) => {
        runningIds.current.delete(upload.id);
        if (!result || result.error || result.aborted) return;

        const latest = useAppStore.getState().uploads?.find((item: any) => item.id === upload.id) || upload;
        const completed = completedUploadSnapshot(latest, result);
        useAppStore.getState().updateUpload?.(upload.id, completed);
        await patchLinkedItem(completed);
        await onStored?.(completed, upload.file);
        if (!completed.linkedItemId) {
          let storage = null;
          try { storage = getStorageProvider(); } catch { /* startup may still be wiring providers */ }
          await queueUploadedFile({
            key: completed.key || completed.storageKey || completed.fileKey,
            name: upload.file?.name || completed.name,
            size: upload.file?.size || completed.size,
            mimeType: upload.file?.type || completed.mimeType
          }, {
            globalDefault: autoQueueUploads,
            uploadOverride: upload.queueForArchive,
            storage: storage as any
          }).catch(() => null);
        }
      });
    }
  }, [autoQueueUploads, onStored, uploads, uploader]);

  return null;
}

export default UploadQueueController;
