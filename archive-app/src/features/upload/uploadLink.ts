import {
  createVideoLocalFilePatch,
  normalizeLocalFileValue
} from "../videos/viewModel.js";

interface UploadRecord {
  id?: string;
  status?: string;
  key?: string;
  storageKey?: string;
  fileKey?: string;
  fileHash?: string;
  url?: string;
}

interface LocalFileValue {
  uploadId?: string;
  uploadStatus?: string;
  storageKey?: string;
  fileKey?: string;
  fileHash?: string;
  url?: string;
  [key: string]: unknown;
}

interface VideoMetadata {
  localFile?: LocalFileValue | string | null;
  storageKey?: string;
  fileKey?: string;
  fileHash?: string;
  checksum?: string;
  media?: Record<string, unknown>;
  [key: string]: unknown;
}

interface VideoItem {
  metadata?: VideoMetadata;
  [key: string]: unknown;
}

interface UploadFileInput {
  name?: string;
  size?: number;
  type?: string;
  webkitRelativePath?: string;
  [key: string]: unknown;
}

interface UploadLinkedPatchOptions {
  upload?: UploadRecord | null;
  currentTitle?: string;
}

function uploadStatus(upload: UploadRecord = {}): string {
  return upload.status || "queued";
}

function uploadKey(upload: UploadRecord = {}): string {
  return upload.key || upload.storageKey || upload.fileKey || upload.fileHash || "";
}

function findMatchingUpload(localFile: LocalFileValue = {}, uploads: UploadRecord[] = []): UploadRecord | null {
  const uploadId = localFile?.uploadId;
  if (!uploadId) return null;
  return (uploads || []).find((upload) => upload?.id === uploadId) || null;
}

function mergeLocalFileUpload(localFile: LocalFileValue = {}, upload: UploadRecord | null = {}): LocalFileValue {
  const hasUpload = Boolean(upload && Object.keys(upload).length);
  const key = uploadKey(upload || {});
  return {
    ...(localFile || {}),
    ...(upload?.id ? { uploadId: upload.id } : {}),
    ...(hasUpload ? { uploadStatus: uploadStatus(upload || {}) } : {}),
    ...(key ? {
      storageKey: key,
      fileKey: key,
      fileHash: key
    } : {}),
    ...(upload?.url ? { url: upload.url } : {})
  };
}

export function createUploadLinkedLocalFilePatch(
  file: UploadFileInput,
  { upload, currentTitle = "" }: UploadLinkedPatchOptions = {}
) {
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

export function mergeUploadIntoMetadata(
  metadata: VideoMetadata = {},
  uploadsOrUpload: UploadRecord[] | UploadRecord = []
): VideoMetadata {
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

export function mergeUploadIntoVideoItem<TVideoItem extends VideoItem>(
  item: TVideoItem = {} as TVideoItem,
  upload: UploadRecord = {}
): TVideoItem & { metadata: VideoMetadata } {
  return {
    ...(item || {}),
    metadata: mergeUploadIntoMetadata(item?.metadata || {}, upload)
  };
}
