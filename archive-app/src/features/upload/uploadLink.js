import {
  createVideoLocalFilePatch,
  normalizeLocalFileValue
} from "../videos/viewModel.js";

function uploadStatus(upload = {}) {
  return upload.status || "queued";
}

function uploadKey(upload = {}) {
  return upload.key || upload.storageKey || upload.fileKey || upload.fileHash || "";
}

function findMatchingUpload(localFile = {}, uploads = []) {
  const uploadId = localFile?.uploadId;
  if (!uploadId) return null;
  return (uploads || []).find((upload) => upload?.id === uploadId) || null;
}

function mergeLocalFileUpload(localFile = {}, upload = {}) {
  const hasUpload = Boolean(upload && Object.keys(upload).length);
  const key = uploadKey(upload);
  return {
    ...(localFile || {}),
    ...(upload?.id ? { uploadId: upload.id } : {}),
    ...(hasUpload ? { uploadStatus: uploadStatus(upload) } : {}),
    ...(key ? {
      storageKey: key,
      fileKey: key,
      fileHash: key
    } : {}),
    ...(upload?.url ? { url: upload.url } : {})
  };
}

export function createUploadLinkedLocalFilePatch(file, { upload, currentTitle = "" } = {}) {
  const patch = createVideoLocalFilePatch(file, { currentTitle });
  if (!patch) return null;
  return {
    ...patch,
    metadata: {
      ...patch.metadata,
      localFile: mergeLocalFileUpload(patch.metadata?.localFile, upload)
    }
  };
}

export function mergeUploadIntoMetadata(metadata = {}, uploadsOrUpload = []) {
  const localFile = metadata?.localFile && typeof metadata.localFile === "object"
    ? metadata.localFile
    : normalizeLocalFileValue(metadata?.localFile);
  if (!localFile) return metadata || {};

  const upload = Array.isArray(uploadsOrUpload)
    ? findMatchingUpload(localFile, uploadsOrUpload)
    : uploadsOrUpload;
  if (!upload) return metadata || {};

  const nextLocalFile = mergeLocalFileUpload(localFile, upload);
  const key = uploadKey(upload) || nextLocalFile.storageKey || "";
  return {
    ...(metadata || {}),
    localFile: nextLocalFile,
    ...(key ? {
      storageKey: key,
      fileKey: key,
      fileHash: key,
      checksum: key,
      media: {
        ...(metadata?.media || {}),
        sourceKey: key
      }
    } : {})
  };
}

export function mergeUploadIntoVideoItem(item = {}, upload = {}) {
  return {
    ...(item || {}),
    metadata: mergeUploadIntoMetadata(item?.metadata || {}, upload)
  };
}
