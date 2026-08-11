"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileArchive, FileQuestion, Files, FolderOpen, HardDrive, Play, RefreshCw, ScanSearch, Share2, UploadCloud } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useCapability } from "@/components/RoleGate";
import DataTable from "@/components/ui/DataTable";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveFile, type FileBrowserEntry, type StorageWorkspaceOperation, type StorageWorkspaceProvider } from "@/lib/archive-api";
import { addMintedLink } from "@/lib/minted-shares";
import { defaultShareExpiryLocalValue, validateShareExpiry } from "@/lib/share-checklist";
import { MOBILE_VIEWPORT_QUERY, matchesMediaQuery } from "@/lib/use-media-query";
import { Skeleton } from "@/components/ui/Skeleton";
import StorageBrowser, { type StorageCapability, type StorageEntry, type StorageProvider } from "@/components/StorageBrowser";
import StorageOperationPanel, { type StorageOperationView } from "@/components/StorageOperationPanel";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type FileState =
  | { status: "loading" }
  | { status: "ready"; files: ArchiveFile[] }
  | { status: "error"; message: string };

type BrowserState =
  | { status: "loading" }
  | { status: "ready"; path: string; entries: FileBrowserEntry[] }
  | { status: "error"; message: string };

type ShareState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "success"; token: string; url?: string }
  | { status: "error"; message: string };

/** V1-836: a lightweight pre-share checklist - final decision stays with the user, this only prompts them to confirm. */
type ShareChecklistState = {
  open: boolean;
  expiryLocalValue: string;
  rightsConfirmed: boolean;
  sensitiveDataConfirmed: boolean;
  expiryError: string;
};

const CLOSED_SHARE_CHECKLIST: ShareChecklistState = {
  open: false,
  expiryLocalValue: "",
  rightsConfirmed: false,
  sensitiveDataConfirmed: false,
  expiryError: ""
};

type ScanState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; ingested: number; skipped: number }
  | { status: "error"; message: string };

type FileViewMode = "table" | "cards" | "browser";
type FileKind = "all" | "media" | "image" | "document" | "other";

const PLAYABLE_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "opus",
  "weba",
  "mp4",
  "m4v",
  "mov",
  "webm",
  "ogv"
]);

const capabilityMap: Record<string, StorageCapability> = { create_folder: "create-folder", browse: "browse", download: "download", upload: "upload", move: "move", copy: "copy", rename: "rename", delete: "delete" };
function mapProvider(provider: StorageWorkspaceProvider): StorageProvider { return { ...provider, status: provider.status === "available" ? "ready" : "offline", capabilities: provider.capabilities.map((item) => capabilityMap[item]).filter((item): item is StorageCapability => Boolean(item)) }; }
function mapOperation(operation: StorageWorkspaceOperation): StorageOperationView { const completed = operation.items.filter((item) => item.status === "completed" || item.status === "skipped").length; return { id: operation.id, type: operation.action, status: operation.status === "queued" || operation.status === "paused" ? "running" : operation.status, completedItems: completed, totalItems: operation.items.length, message: operation.items.find((item) => item.errorCode) ?.errorCode ?? undefined, retryable: operation.status === "failed" }; }

// V2-605: ArchiveFile and FileBrowserEntry are two separate interfaces that
// both happen to carry `key` plus a `[key: string]: unknown` catch-all --
// structurally incompatible for direct assignment (an index signature typed
// `unknown` doesn't satisfy an explicit `mimeType?: string`), which is why
// call sites reached for `as unknown as ArchiveFile`. These helpers only
// ever read `key`/`mimeType`/`store`, defensively type-narrowed already, so
// they accept the common shape both real types satisfy without any cast.
interface FileLike extends Record<string, unknown> {
  key: string;
}

function getFileExtension(file: FileLike) {
  return file.key.split(".").pop()?.toLowerCase() ?? "";
}

function isPlayableFile(file: FileLike): boolean {
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return true;
  }

  return PLAYABLE_EXTENSIONS.has(getFileExtension(file));
}

function getFileKind(file: FileLike): Exclude<FileKind, "all"> {
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
  const ext = getFileExtension(file);

  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/") || PLAYABLE_EXTENSIONS.has(ext)) return "media";
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "tiff", "svg"].includes(ext)) return "image";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"].includes(ext)) return "document";
  return "other";
}

function mediaPlayHref(file: FileLike): string {
  const params = new URLSearchParams({ path: file.key });

  if (typeof file.store === "string" && file.store) {
    params.set("disk", file.store);
  }

  return `/media/play?${params.toString()}`;
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "-";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function formatDate(value: string | undefined, locale: "ar" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "en" ? "en-US" : "ar-SA");
}

function getUniqueStores(files: ArchiveFile[]) {
  return Array.from(new Set(files.map((file) => file.store).filter((store): store is string => Boolean(store)))).sort((a, b) =>
    a.localeCompare(b, "ar")
  );
}

function getFileName(file: ArchiveFile) {
  return file.name || file.key.split(/[\\/]/).pop() || file.key;
}

function getInitialFileViewMode(): FileViewMode {
  if (matchesMediaQuery(MOBILE_VIEWPORT_QUERY)) {
    return "cards";
  }

  return "table";
}

export default function FilesPage() {
  const { t, locale } = useLocale();
  const copy = t.pages.files;
  const fileViewOptions: DataViewOption<FileViewMode>[] = [{ value: "table", label: copy.table }, { value: "cards", label: copy.cards }, { value: "browser", label: copy.folders }];
  const kindLabel = (kind: FileKind) => ({ all: copy.all, media: copy.media, image: copy.image, document: copy.document, other: copy.other })[kind];
  const api = useMemo(() => createArchiveApiClient(), []);
  const canIngest = useCapability("ingest.manage");
  const canShare = useCapability("shares.manage");
  const [state, setState] = useState<FileState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<FileKind>("all");
  const [viewMode, setViewMode] = useState<FileViewMode>(() => getInitialFileViewMode());
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [shareState, setShareState] = useState<ShareState>({ status: "idle" });
  const [shareChecklist, setShareChecklist] = useState<ShareChecklistState>(CLOSED_SHARE_CHECKLIST);
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [browserPath, setBrowserPath] = useState("");
  const [browserState, setBrowserState] = useState<BrowserState>({ status: "loading" });
  const [workspaceProviderId, setWorkspaceProviderId] = useState("local");
  const [workspaceProviders, setWorkspaceProviders] = useState<StorageProvider[]>([]);
  const [workspaceOperation, setWorkspaceOperation] = useState<StorageOperationView | undefined>();

  const loadFiles = useCallback(async (q: string) => {
    setState({ status: "loading" });
    const response = await api.files(q ? { q } : undefined);

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({
      status: "ready",
      files: response.files
    });
  }, [api]);

  useEffect(() => {
    void loadFiles("");
  }, [loadFiles]);

  const loadWorkspace = useCallback(async () => {
    const response = await api.storageWorkspace();
    if (response.ok) {
      const providers = response.storages.map(mapProvider);
      setWorkspaceProviders(providers);
      setWorkspaceProviderId((current) => providers.some((provider) => provider.id === current) ? current : (providers[0]?.id ?? ""));
    }
  }, [api]);
  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);
  const loadBrowser = useCallback(async (path: string) => {
    setBrowserState({ status: "loading" });
    try {
      const response = await api.browseStorageWorkspace(workspaceProviderId, path ? { path } : undefined);
      if (response.ok) {
        setBrowserState({ status: "ready", path: response.path, entries: response.items.map((item) => ({ key: item.id, name: item.name, path: item.path, kind: item.kind, size: item.size ?? undefined, modifiedAt: item.modifiedAt ?? undefined })) });
      } else {
        setBrowserState({ status: "error", message: response.error || copy.browseFailed });
      }
    } catch (error) {
      setBrowserState({ status: "error", message: error instanceof Error ? error.message : copy.browseFailed });
    }
  }, [api, workspaceProviderId, copy.browseFailed]);

  useEffect(() => {
    if (viewMode === "browser") {
      void loadBrowser(browserPath);
    }
  }, [viewMode, browserPath, workspaceProviderId, loadBrowser]);

  const files = useMemo(() => (state.status === "ready" ? state.files : []), [state]);
  const stores = useMemo(() => getUniqueStores(files), [files]);
  const browserEntries = useMemo(
    () =>
      browserState.status === "ready"
        ? [...browserState.entries].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, locale === "en" ? "en" : "ar") : a.kind === "folder" ? -1 : 1))
        : [],
    [browserState, locale]
  );
  const storageEntries = useMemo<StorageEntry[]>(() => browserEntries.map((entry) => ({
    id: entry.key,
    name: entry.name,
    path: entry.path || (browserPath ? `${browserPath}/${entry.name}` : entry.name),
    kind: entry.kind,
    size: entry.size,
    modifiedAt: entry.modifiedAt
  })), [browserEntries, browserPath]);

  const startWorkspacePreview = async (action: StorageCapability) => {
    const apiAction = action === "create-folder" ? "create_folder" : action;
    const response = await api.previewStorageOperation({ action: apiAction, sourceProviderId: workspaceProviderId, items: (selectedKeys.length ? selectedKeys : [browserPath]).map((sourcePath) => ({ sourcePath })) });
    if (!response.ok) { setWorkspaceOperation({ id: "preview", type: apiAction, status: "failed", completedItems: 0, totalItems: selectedKeys.length || 1, message: response.error, retryable: true }); return; }
    setWorkspaceOperation({ id: response.preview.previewToken, type: apiAction, status: "preview", completedItems: 0, totalItems: response.preview.items.length, message: copy.reviewOperation });
  };
  const confirmWorkspaceOperation = async () => {
    if (!workspaceOperation) return;
    const response = await api.startStorageOperation({ previewToken: workspaceOperation.id, idempotencyKey: crypto.randomUUID() });
    if (response.ok) setWorkspaceOperation(mapOperation(response.operation)); else setWorkspaceOperation((current) => current ? { ...current, status: "failed", message: response.error, retryable: true } : current);
  };
  const cancelWorkspaceOperation = async () => {
    if (!workspaceOperation || workspaceOperation.status === "preview") { setWorkspaceOperation(undefined); return; }
    const response = await api.cancelStorageOperation(workspaceOperation.id);
    if (response.ok) setWorkspaceOperation(mapOperation(response.operation));
  };
  const visibleFiles = useMemo(() => {
    return files.filter((file) => {
      if (storeFilter !== "all" && file.store !== storeFilter) return false;
      if (kindFilter !== "all" && getFileKind(file) !== kindFilter) return false;
      return true;
    });
  }, [files, kindFilter, storeFilter]);
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const previewFile = useMemo(() => {
    if (previewKey) return visibleFiles.find((file) => file.key === previewKey) || visibleFiles[0] || null;
    return visibleFiles.find((file) => selectedKeySet.has(file.key)) || visibleFiles[0] || null;
  }, [previewKey, selectedKeySet, visibleFiles]);
  const mediaCount = files.filter((file) => getFileKind(file) === "media").length;
  const imageCount = files.filter((file) => getFileKind(file) === "image").length;
  const documentCount = files.filter((file) => getFileKind(file) === "document").length;
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadFiles(query);
  };

  const handleToggleFile = (fileKey: string) => {
    setSelectedKeys((current) =>
      current.includes(fileKey)
        ? current.filter((key) => key !== fileKey)
        : [...current, fileKey]
    );
  };

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedKeys((current) => {
      const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every((file) => current.includes(file.key));
      return allVisibleSelected ? [] : visibleFiles.map((file) => file.key);
    });
  }, [visibleFiles]);

  const handleOpenShareChecklist = () => {
    if (selectedKeys.length === 0) return;
    setShareChecklist({
      open: true,
      expiryLocalValue: defaultShareExpiryLocalValue(new Date()),
      rightsConfirmed: false,
      sensitiveDataConfirmed: false,
      expiryError: ""
    });
  };

  const handleCancelShareChecklist = () => {
    setShareChecklist(CLOSED_SHARE_CHECKLIST);
  };

  const handleConfirmShare = async () => {
    if (selectedKeys.length === 0) return;
    const validation = validateShareExpiry(shareChecklist.expiryLocalValue, new Date());
    if (!validation.valid) {
      setShareChecklist((current) => ({ ...current, expiryError: validation.message }));
      return;
    }
    if (!shareChecklist.rightsConfirmed || !shareChecklist.sensitiveDataConfirmed) return;

    setShareState({ status: "creating" });
    const response = await api.createShare({
      itemIds: selectedKeys,
      expiresAt: validation.iso
    });

    if (!response.ok) {
      setShareState({ status: "error", message: response.error });
      return;
    }

    addMintedLink({
      token: response.token,
      url: response.url || "",
      itemLabel: copy.selectedItems.replace("{count}", String(selectedKeys.length)),
      createdAt: new Date().toISOString()
    });

    setShareState({
      status: "success",
      token: response.token,
      url: response.url
    });
    setShareChecklist(CLOSED_SHARE_CHECKLIST);
  };

  const handleScan = async () => {
    setScanState({ status: "running" });
    const response = await api.ingestScan();

    if (!response.ok) {
      setScanState({ status: "error", message: response.error });
      return;
    }

    setScanState({
      status: "success",
      ingested: response.ingested.length,
      skipped: response.skipped
    });
    await loadFiles(query);
  };

  const renderFileActions = (file: ArchiveFile) => (
    <div className="button-row">
      {isPlayableFile(file) ? (
        <a href={mediaPlayHref(file)} className="button button-secondary button-sm">
          <Play size={16} aria-hidden="true" />
          {copy.play}
        </a>
      ) : null}
      <button type="button" className="button button-secondary button-sm" onClick={() => setPreviewKey(file.key)}>
        <Eye size={16} aria-hidden="true" />
        {copy.preview}
      </button>
    </div>
  );
  const browserColumns = useMemo<Array<ColumnDef<FileBrowserEntry, unknown>>>(
    () => [
      {
        accessorKey: "name",
        header: copy.name,
        cell: ({ row }) => {
          const entry = row.original;
          const entryPath = entry.path || (browserPath ? `${browserPath}/${entry.name}` : entry.name);

          return (
            <span className="wrap-anywhere">
              {entry.kind === "folder" ? (
                <button type="button" className="text-accent" onClick={() => setBrowserPath(entryPath)}>
                  {entry.name}
                </button>
              ) : (
                <strong>{entry.name}</strong>
              )}
            </span>
          );
        }
      },
      {
        accessorKey: "kind",
        header: copy.kind,
        cell: ({ row }) => row.original.kind === "folder" ? copy.folder : kindLabel(getFileKind(row.original))
      },
      {
        accessorKey: "size",
        header: copy.size,
        cell: ({ row }) => <span className="mono-text text-sm">{row.original.kind === "folder" ? "-" : formatBytes(row.original.size)}</span>
      },
      {
        accessorKey: "modifiedAt",
        header: copy.date,
        cell: ({ row }) => <span className="mono-text text-sm">{formatDate(row.original.modifiedAt, locale)}</span>
      },
      {
        id: "actions",
        header: copy.actions,
        cell: ({ row }) => {
          const entry = row.original;
          const entryPath = entry.path || (browserPath ? `${browserPath}/${entry.name}` : entry.name);

          if (entry.kind === "folder") {
            return (
              <button type="button" className="button button-secondary button-sm" onClick={() => setBrowserPath(entryPath)}>
                {copy.open}
              </button>
            );
          }

          return isPlayableFile(entry) ? (
            <a href={mediaPlayHref(entry)} className="button button-secondary button-sm">{copy.play}</a>
          ) : null;
        },
        enableSorting: false
      }
    ],
    [browserPath, copy, locale]
  );
  const fileColumns = useMemo<Array<ColumnDef<ArchiveFile, unknown>>>(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={visibleFiles.length > 0 && visibleFiles.every((file) => selectedKeySet.has(file.key))}
            onChange={toggleSelectAllVisible}
            aria-label={copy.selectAll}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedKeySet.has(row.original.key)}
            onChange={() => handleToggleFile(row.original.key)}
            aria-label={copy.select.replace("{name}", getFileName(row.original))}
          />
        ),
        enableSorting: false
      },
      {
        accessorKey: "name",
        header: copy.name,
        cell: ({ row }) => (
          <span className="wrap-anywhere" onMouseEnter={() => setPreviewKey(row.original.key)}>
            <strong>{getFileName(row.original)}</strong>
            {row.original.key !== row.original.name && row.original.key ? (
              <span className="field-note text-xs">{row.original.key}</span>
            ) : null}
          </span>
        )
      },
      {
        id: "kind",
        header: copy.kind,
        accessorFn: (file) => getFileKind(file),
        cell: ({ row }) => kindLabel(getFileKind(row.original))
      },
      {
        accessorKey: "size",
        header: copy.size,
        cell: ({ row }) => <span className="mono-text text-sm">{formatBytes(row.original.size)}</span>
      },
      {
        accessorKey: "store",
        header: copy.store,
        cell: ({ row }) => <span className="text-sm">{row.original.store || "-"}</span>
      },
      {
        accessorKey: "modifiedAt",
        header: copy.date,
        cell: ({ row }) => <span className="mono-text text-sm">{formatDate(row.original.modifiedAt, locale)}</span>
      },
      {
        id: "actions",
        header: copy.actions,
        cell: ({ row }) => renderFileActions(row.original),
        enableSorting: false
      }
    ],
    [selectedKeySet, visibleFiles, toggleSelectAllVisible, copy, locale]
  );

  return (
    <AppShell subtitle={t.pageTitles.fileBrowser} contentClassName="files-content" tipsPage="files">
      <PageToolbar
        icon={<Files size={24} />}
        eyebrow={<span className="badge">{copy.eyebrow}</span>} title={copy.title} description={copy.description}
        meta={(
          <>
            <span className="badge">{copy.fileCount.replace("{count}", String(files.length))}</span><span className="badge">{copy.mediaCount.replace("{count}", String(mediaCount))}</span>
            <span className="badge">{formatBytes(totalSize)}</span>
            <span className="badge">{copy.selectedCount.replace("{count}", String(selectedKeys.length))}</span>
          </>
        )}
        actions={(
          <>
            <a className="button button-primary" href="/uploads">
              <UploadCloud size={16} aria-hidden="true" />
              {copy.upload}
            </a>
            {canIngest && (
              <button type="button" className="button button-primary" onClick={() => void handleScan()} disabled={scanState.status === "running"}>
                <ScanSearch size={16} aria-hidden="true" />
                {scanState.status === "running" ? copy.scanning : copy.scanStorage}
              </button>
            )}
            <a className="button button-secondary" href="/media/jobs">
              <Play size={16} aria-hidden="true" />
              {copy.mediaJobs}
            </a>
          </>
        )}
      >
        <form className="archive-toolbar-grid" onSubmit={handleSearch}>
          <label>
            <span>{copy.search}</span>
            <input
              type="search"
              placeholder={copy.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
          </label>
          <label>
            <span>{copy.store}</span>
            <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
              <option value="all">{copy.allStores}</option>
              {stores.map((store) => <option key={store} value={store}>{store}</option>)}
            </select>
          </label>
          <label>
            <span>{copy.kind}</span>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as FileKind)}>
              {(["all", "media", "image", "document", "other"] as FileKind[]).map((kind) => (
                <option key={kind} value={kind}>{kindLabel(kind)}</option>
              ))}
            </select>
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary">
              <RefreshCw size={16} aria-hidden="true" />
              {copy.refresh}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setQuery("");
                setStoreFilter("all");
                setKindFilter("all");
                void loadFiles("");
              }}
            >
              {copy.reset}
            </button>
          </div>
        </form>
        <div className="archive-toolbar-row">
          <DataViewSwitcher value={viewMode} options={fileViewOptions} onChange={setViewMode} label={copy.viewMode} />
        </div>
      </PageToolbar>

      <MetricStrip
        ariaLabel={copy.filesSummary}
        items={[
          {
            label: copy.totalFiles,
            value: files.length,
            description: copy.availableStores.replace("{count}", String(stores.length || 1)),
            icon: <HardDrive size={20} />,
            tone: "accent"
          },
          {
            label: copy.playableMedia,
            value: mediaCount,
            description: copy.audioVideo,
            icon: <Play size={20} />,
            tone: "info"
          },
          {
            label: copy.imagesDocuments,
            value: imageCount + documentCount,
            description: copy.imagesDocumentsCount.replace("{images}", String(imageCount)).replace("{documents}", String(documentCount)),
            icon: <FileArchive size={20} />,
            tone: "success"
          },
          {
            label: copy.totalSize,
            value: formatBytes(totalSize),
            description: copy.selectedItems.replace("{count}", String(selectedKeys.length)),
            icon: <Share2 size={20} />,
            tone: selectedKeys.length > 0 ? "warning" : "default"
          }
        ]}
      />

      {scanState.status === "success" ? (
        <div className="state-banner state-banner-success">
          <strong>{copy.scanComplete}</strong><span className="helper-text">{copy.scanResult.replace("{ingested}", String(scanState.ingested)).replace("{skipped}", String(scanState.skipped))}</span>
        </div>
      ) : null}

      {scanState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.scanFailed}</strong>
          <span className="helper-text">{scanState.message}</span>
        </div>
      ) : null}

      {selectedKeys.length > 0 ? (
        <div className="bulk-action-bar" role="status">
          <strong>{copy.selectedFiles.replace("{count}", String(selectedKeys.length))}</strong><span className="helper-text">{copy.selectionSafety}</span>
          <div className="button-row">
            {canShare && (
              <button
                onClick={handleOpenShareChecklist}
                disabled={shareState.status === "creating"}
                className="button button-primary"
              >
                <Share2 size={16} aria-hidden="true" />
                {shareState.status === "creating" ? copy.creating : copy.createShare}
              </button>
            )}
            <button type="button" className="button button-secondary" onClick={toggleSelectAllVisible}>{copy.selectVisible}</button><button type="button" className="button button-secondary" onClick={() => setSelectedKeys([])}>{copy.clearSelection}</button>
          </div>
        </div>
      ) : null}

      {shareChecklist.open ? (
        <div className="panel" role="dialog" aria-label={copy.preShare}>
          <div className="panel-section-header">
            <h2>{copy.preShare}</h2><p className="helper-text">{copy.preShareDescription}</p>
          </div>
          <label>
            {copy.shareExpiry}
            <input
              type="datetime-local"
              value={shareChecklist.expiryLocalValue}
              onChange={(event) =>
                setShareChecklist((current) => ({ ...current, expiryLocalValue: event.target.value, expiryError: "" }))
              }
            />
          </label>
          {shareChecklist.expiryError ? <p className="form-status">{shareChecklist.expiryError}</p> : null}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={shareChecklist.rightsConfirmed}
              onChange={(event) =>
                setShareChecklist((current) => ({ ...current, rightsConfirmed: event.target.checked }))
              }
            />
            {copy.rightsConfirmed}
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={shareChecklist.sensitiveDataConfirmed}
              onChange={(event) =>
                setShareChecklist((current) => ({ ...current, sensitiveDataConfirmed: event.target.checked }))
              }
            />
            {copy.sensitiveConfirmed}
          </label>
          <div className="button-row">
            <button
              type="button"
              className="button button-primary"
              disabled={
                !shareChecklist.rightsConfirmed ||
                !shareChecklist.sensitiveDataConfirmed ||
                shareState.status === "creating"
              }
              onClick={() => void handleConfirmShare()}
            >
              {shareState.status === "creating" ? copy.creating : copy.confirmShare}
            </button>
            <button type="button" className="button button-secondary" onClick={handleCancelShareChecklist}>
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {shareState.status === "success" ? (
        <div className="state-banner state-banner-success">
          <strong>{copy.shareCreated}</strong>
          <span className="helper-text">
            <a className="text-accent" href={`/share/${encodeURIComponent(shareState.token)}`}>
              {copy.openShare}
            </a>
            {shareState.url ? ` | ${shareState.url}` : ""}
          </span>
        </div>
      ) : null}

      {shareState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.shareError}</strong>
          <span className="helper-text">{shareState.message}</span>
        </div>
      ) : null}

      {viewMode === "browser" ? (
        <section className="workspace-panel" aria-label={copy.folderBrowser}>
          <div className="workspace-panel__header">
            <div>
              <h2>{copy.folderBrowser}</h2><p>{copy.folderBrowserDescription}</p>
            </div>
            <button type="button" className="button button-secondary button-sm" onClick={() => void loadBrowser(browserPath)}>
              <RefreshCw size={16} aria-hidden="true" />
              {copy.refreshFolder}
            </button>
          </div>

          <nav className="record-meta" aria-label={copy.currentPath}>
            <button type="button" className="badge" onClick={() => setBrowserPath("")} disabled={!browserPath}>
              {copy.root}
            </button>
            {browserPath.split("/").filter(Boolean).map((segment, index, segments) => {
              const segmentPath = segments.slice(0, index + 1).join("/");
              return (
                <button
                  key={segmentPath}
                  type="button"
                  className="badge"
                  onClick={() => setBrowserPath(segmentPath)}
                  aria-current={index === segments.length - 1 ? "location" : undefined}
                  dir="ltr"
                >
                  {segment}
                </button>
              );
            })}
          </nav>

          <StorageBrowser
            providers={workspaceProviders}
            providerId={workspaceProviderId}
            path={browserPath}
            entries={storageEntries}
            isLoading={browserState.status === "loading"}
            error={browserState.status === "error" ? browserState.message : undefined}
            onProviderChange={(providerId) => {
              setWorkspaceProviderId(providerId);
              setBrowserPath("");
            }}
            onNavigate={setBrowserPath}
            onDownload={(entry) => setPreviewKey(entry.path)}
            onAction={(action) => void startWorkspacePreview(action)}
          />
          <StorageOperationPanel
            operation={workspaceOperation}
            onConfirm={() => void confirmWorkspaceOperation()}
            onCancel={() => void cancelWorkspaceOperation()}
            onRetry={() => void startWorkspacePreview("move")}
          />

          {browserState.status === "loading" ? (
            <Skeleton label={copy.loadingFolder} />
          ) : null}

          {browserState.status === "error" ? (
            <div className="state-banner state-banner-error" role="alert">
              <strong>{copy.browseFailed}</strong>
              <span className="helper-text">{browserState.message}</span>
            </div>
          ) : null}

          {browserState.status === "ready" ? (
            browserState.entries.length === 0 ? (
              <EmptyState icon={<FolderOpen size={22} />} title={copy.emptyFolder} description={copy.emptyFolderDescription} />
            ) : (
              <DataTable
                ariaLabel={copy.folderContents}
                columns={browserColumns}
                data={browserEntries}
                emptyMessage={copy.emptyFolderDescription}
                getRowId={(entry) => entry.key}
                virtualized={browserEntries.length > 80}
              />
            )
          ) : null}
        </section>
      ) : null}

      {viewMode !== "browser" && state.status === "loading" ? (
        <div className="panel panel-compact">
          <Skeleton label={copy.loadingFiles} />
        </div>
      ) : null}

      {viewMode !== "browser" && state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadFilesFailed}</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {viewMode !== "browser" && state.status === "ready" ? (
        visibleFiles.length === 0 ? (
          <EmptyState
            icon={<FileQuestion size={22} />}
            title={copy.noFiles} description={copy.noFilesDescription}
            actions={canIngest ? (
              <button type="button" className="button button-secondary" onClick={() => void handleScan()}>
                <ScanSearch size={16} aria-hidden="true" />
                {copy.scanStorage}
              </button>
            ) : undefined}
          />
        ) : (
          <section className="files-workspace" aria-label={copy.filesWorkspace}>
            <div className="files-surface" data-view={viewMode}>
              {viewMode === "table" ? (
                <DataTable
                  ariaLabel={copy.fileList}
                  columns={fileColumns}
                  data={visibleFiles}
                  emptyMessage={copy.noMatches}
                  getRowId={(file) => file.key}
                  virtualized={visibleFiles.length > 80}
                />
              ) : (
                visibleFiles.map((file) => (
                  <article className="file-card" key={file.key} data-selected={selectedKeySet.has(file.key) ? "true" : "false"}>
                    <input
                      type="checkbox"
                      checked={selectedKeySet.has(file.key)}
                      onChange={() => handleToggleFile(file.key)}
                      aria-label={copy.select.replace("{name}", getFileName(file))}
                    />
                    <div className="file-card__body">
                      <div className="panel-title-row">
                        <h2>{getFileName(file)}</h2>
                        <span className="badge">{kindLabel(getFileKind(file))}</span>
                      </div>
                      <p className="helper-text wrap-anywhere">{file.key}</p>
                      <div className="record-meta">
                        <span className="badge">{formatBytes(file.size)}</span>
                        <span className="badge">{file.store || "default"}</span>
                        <span className="badge">{formatDate(file.modifiedAt, locale)}</span>
                      </div>
                      {renderFileActions(file)}
                    </div>
                  </article>
                ))
              )}
            </div>

            <aside className="record-preview-rail" aria-label={copy.filePreview}>
              {previewFile ? (
                <>
                  <div className="panel-section-header">
                    <span className="badge">{copy.preview}</span>
                    <h2>{getFileName(previewFile)}</h2>
                  </div>
                  <p className="wrap-anywhere">{previewFile.key}</p>
                  <div className="kv-grid">
                    <div className="kv-item">
                      <strong>{copy.kind}</strong>
                      <span>{kindLabel(getFileKind(previewFile))}</span>
                    </div>
                    <div className="kv-item">
                      <strong>{copy.size}</strong>
                      <span>{formatBytes(previewFile.size)}</span>
                    </div>
                    <div className="kv-item">
                      <strong>{copy.store}</strong>
                      <span>{previewFile.store || "-"}</span>
                    </div>
                    <div className="kv-item">
                      <strong>{copy.date}</strong>
                      <span>{formatDate(previewFile.modifiedAt, locale)}</span>
                    </div>
                  </div>
                  <div className="button-row">
                    {isPlayableFile(previewFile) ? (
                      <a className="button button-primary" href={mediaPlayHref(previewFile)}>
                        <Play size={16} aria-hidden="true" />
                        {copy.playFile}
                      </a>
                    ) : null}
                    <button type="button" className="button button-secondary" onClick={() => handleToggleFile(previewFile.key)}>
                      <Share2 size={16} aria-hidden="true" />
                      {selectedKeySet.has(previewFile.key) ? copy.removeSelection : copy.selectFile}
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState icon={<Eye size={22} />} title={copy.noPreview} description={copy.noPreviewDescription} />
              )}
            </aside>
          </section>
        )
      ) : null}
    </AppShell>
  );
}
