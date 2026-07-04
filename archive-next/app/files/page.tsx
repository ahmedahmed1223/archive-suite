"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileArchive, FileQuestion, Files, FolderOpen, HardDrive, Play, RefreshCw, ScanSearch, Share2, UploadCloud } from "lucide-react";
import AppShell from "@/components/AppShell";
import DataTable from "@/components/ui/DataTable";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveFile, type FileBrowserEntry } from "@/lib/archive-api";
import { addMintedLink } from "@/lib/minted-shares";

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

type ScanState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; ingested: number; skipped: number }
  | { status: "error"; message: string };

type FileViewMode = "table" | "cards" | "browser";
type FileKind = "all" | "media" | "image" | "document" | "other";

const fileViewOptions: DataViewOption<FileViewMode>[] = [
  { value: "table", label: "جدول" },
  { value: "cards", label: "بطاقات" },
  { value: "browser", label: "مجلدات" }
];

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

function getFileExtension(file: ArchiveFile) {
  return file.key.split(".").pop()?.toLowerCase() ?? "";
}

function isPlayableFile(file: ArchiveFile): boolean {
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return true;
  }

  return PLAYABLE_EXTENSIONS.has(getFileExtension(file));
}

function getFileKind(file: ArchiveFile): Exclude<FileKind, "all"> {
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
  const ext = getFileExtension(file);

  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/") || PLAYABLE_EXTENSIONS.has(ext)) return "media";
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "tiff", "svg"].includes(ext)) return "image";
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"].includes(ext)) return "document";
  return "other";
}

function kindLabel(kind: FileKind) {
  const labels: Record<FileKind, string> = {
    all: "كل الملفات",
    media: "وسائط",
    image: "صور",
    document: "مستندات",
    other: "أخرى"
  };

  return labels[kind];
}

function mediaPlayHref(file: ArchiveFile): string {
  const params = new URLSearchParams({ path: file.key });

  if (file.store) {
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

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
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
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches) {
    return "cards";
  }

  return "table";
}

export default function FilesPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<FileState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<FileKind>("all");
  const [viewMode, setViewMode] = useState<FileViewMode>(() => getInitialFileViewMode());
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [shareState, setShareState] = useState<ShareState>({ status: "idle" });
  const [scanState, setScanState] = useState<ScanState>({ status: "idle" });
  const [browserPath, setBrowserPath] = useState("");
  const [browserState, setBrowserState] = useState<BrowserState>({ status: "loading" });

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

  const loadBrowser = useCallback(async (path: string) => {
    setBrowserState({ status: "loading" });
    try {
      const response = await api.browseFiles(path ? { path } : undefined);
      if (response.ok) {
        setBrowserState({ status: "ready", path: response.path, entries: response.entries });
      } else {
        setBrowserState({ status: "error", message: response.error || "تعذر تصفح المجلد." });
      }
    } catch (error) {
      setBrowserState({ status: "error", message: error instanceof Error ? error.message : "تعذر تصفح المجلد." });
    }
  }, [api]);

  useEffect(() => {
    if (viewMode === "browser") {
      void loadBrowser(browserPath);
    }
  }, [viewMode, browserPath, loadBrowser]);

  const files = state.status === "ready" ? state.files : [];
  const stores = useMemo(() => getUniqueStores(files), [files]);
  const browserEntries = useMemo(
    () =>
      browserState.status === "ready"
        ? [...browserState.entries].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "ar") : a.kind === "folder" ? -1 : 1))
        : [],
    [browserState]
  );
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

  const toggleSelectAllVisible = () => {
    setSelectedKeys((current) => {
      const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every((file) => current.includes(file.key));
      return allVisibleSelected ? [] : visibleFiles.map((file) => file.key);
    });
  };

  const handleCreateShare = async () => {
    if (selectedKeys.length === 0) return;

    setShareState({ status: "creating" });
    const response = await api.createShare({
      itemIds: selectedKeys
    });

    if (!response.ok) {
      setShareState({ status: "error", message: response.error });
      return;
    }

    addMintedLink({
      token: response.token,
      url: response.url || "",
      itemLabel: `${selectedKeys.length} عنصر`,
      createdAt: new Date().toISOString()
    });

    setShareState({
      status: "success",
      token: response.token,
      url: response.url
    });
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
          تشغيل
        </a>
      ) : null}
      <button type="button" className="button button-secondary button-sm" onClick={() => setPreviewKey(file.key)}>
        <Eye size={16} aria-hidden="true" />
        معاينة
      </button>
    </div>
  );
  const browserColumns = useMemo<Array<ColumnDef<FileBrowserEntry, unknown>>>(
    () => [
      {
        accessorKey: "name",
        header: "الاسم",
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
        header: "النوع",
        cell: ({ row }) => row.original.kind === "folder" ? "مجلد" : kindLabel(getFileKind(row.original as unknown as ArchiveFile))
      },
      {
        accessorKey: "size",
        header: "الحجم",
        cell: ({ row }) => <span className="mono-text text-sm">{row.original.kind === "folder" ? "-" : formatBytes(row.original.size)}</span>
      },
      {
        accessorKey: "modifiedAt",
        header: "التاريخ",
        cell: ({ row }) => <span className="mono-text text-sm">{formatDate(row.original.modifiedAt)}</span>
      },
      {
        id: "actions",
        header: "الإجراءات",
        cell: ({ row }) => {
          const entry = row.original;
          const entryPath = entry.path || (browserPath ? `${browserPath}/${entry.name}` : entry.name);

          if (entry.kind === "folder") {
            return (
              <button type="button" className="button button-secondary button-sm" onClick={() => setBrowserPath(entryPath)}>
                فتح
              </button>
            );
          }

          return isPlayableFile(entry as unknown as ArchiveFile) ? (
            <a href={mediaPlayHref(entry as unknown as ArchiveFile)} className="button button-secondary button-sm">تشغيل</a>
          ) : null;
        },
        enableSorting: false
      }
    ],
    [browserPath]
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
            aria-label="تحديد الكل"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedKeySet.has(row.original.key)}
            onChange={() => handleToggleFile(row.original.key)}
            aria-label={`تحديد ${getFileName(row.original)}`}
          />
        ),
        enableSorting: false
      },
      {
        accessorKey: "name",
        header: "الاسم",
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
        header: "النوع",
        accessorFn: (file) => getFileKind(file),
        cell: ({ row }) => kindLabel(getFileKind(row.original))
      },
      {
        accessorKey: "size",
        header: "الحجم",
        cell: ({ row }) => <span className="mono-text text-sm">{formatBytes(row.original.size)}</span>
      },
      {
        accessorKey: "store",
        header: "المخزن",
        cell: ({ row }) => <span className="text-sm">{row.original.store || "-"}</span>
      },
      {
        accessorKey: "modifiedAt",
        header: "التاريخ",
        cell: ({ row }) => <span className="mono-text text-sm">{formatDate(row.original.modifiedAt)}</span>
      },
      {
        id: "actions",
        header: "الإجراءات",
        cell: ({ row }) => renderFileActions(row.original),
        enableSorting: false
      }
    ],
    [selectedKeySet, visibleFiles]
  );

  return (
    <AppShell subtitle="مستعرض الملفات" contentClassName="files-content">
      <PageToolbar
        icon={<Files size={24} />}
        eyebrow={<span className="badge">File Operations</span>}
        title="الملفات"
        description="استعرض ملفات التخزين، شغّل الوسائط، اختر عناصر للمشاركة، أو أطلق فحص ingest من واجهة واحدة."
        meta={(
          <>
            <span className="badge">{files.length} ملف</span>
            <span className="badge">{mediaCount} وسائط</span>
            <span className="badge">{formatBytes(totalSize)}</span>
            <span className="badge">{selectedKeys.length} محدد</span>
          </>
        )}
        actions={(
          <>
            <a className="button button-primary" href="/uploads">
              <UploadCloud size={16} aria-hidden="true" />
              رفع ملف
            </a>
            <button type="button" className="button button-primary" onClick={() => void handleScan()} disabled={scanState.status === "running"}>
              <ScanSearch size={16} aria-hidden="true" />
              {scanState.status === "running" ? "جار الفحص" : "فحص التخزين"}
            </button>
            <a className="button button-secondary" href="/media/jobs">
              <Play size={16} aria-hidden="true" />
              مهام الوسائط
            </a>
          </>
        )}
      >
        <form className="archive-toolbar-grid" onSubmit={handleSearch}>
          <label>
            <span>بحث</span>
            <input
              type="search"
              placeholder="اسم الملف أو المسار..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
          </label>
          <label>
            <span>المخزن</span>
            <select value={storeFilter} onChange={(event) => setStoreFilter(event.target.value)}>
              <option value="all">كل المخازن</option>
              {stores.map((store) => <option key={store} value={store}>{store}</option>)}
            </select>
          </label>
          <label>
            <span>النوع</span>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as FileKind)}>
              {(["all", "media", "image", "document", "other"] as FileKind[]).map((kind) => (
                <option key={kind} value={kind}>{kindLabel(kind)}</option>
              ))}
            </select>
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary">
              <RefreshCw size={16} aria-hidden="true" />
              تحديث
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
              تصفير
            </button>
          </div>
        </form>
        <div className="archive-toolbar-row">
          <DataViewSwitcher value={viewMode} options={fileViewOptions} onChange={setViewMode} label="طريقة عرض الملفات" />
        </div>
      </PageToolbar>

      <MetricStrip
        ariaLabel="ملخص الملفات"
        items={[
          {
            label: "إجمالي الملفات",
            value: files.length,
            description: `${stores.length || 1} مخزن متاح`,
            icon: <HardDrive size={20} />,
            tone: "accent"
          },
          {
            label: "وسائط قابلة للتشغيل",
            value: mediaCount,
            description: "صوت وفيديو",
            icon: <Play size={20} />,
            tone: "info"
          },
          {
            label: "صور ومستندات",
            value: imageCount + documentCount,
            description: `${imageCount} صور، ${documentCount} مستندات`,
            icon: <FileArchive size={20} />,
            tone: "success"
          },
          {
            label: "الحجم الكلي",
            value: formatBytes(totalSize),
            description: `${selectedKeys.length} عنصر محدد`,
            icon: <Share2 size={20} />,
            tone: selectedKeys.length > 0 ? "warning" : "default"
          }
        ]}
      />

      {scanState.status === "success" ? (
        <div className="state-banner state-banner-success">
          <strong>انتهى فحص التخزين</strong>
          <span className="helper-text">تم إدخال {scanState.ingested} وتجاوز {scanState.skipped}.</span>
        </div>
      ) : null}

      {scanState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر فحص التخزين</strong>
          <span className="helper-text">{scanState.message}</span>
        </div>
      ) : null}

      {selectedKeys.length > 0 ? (
        <div className="bulk-action-bar" role="status">
          <strong>{selectedKeys.length} ملف محدد</strong>
          <div className="button-row">
            <button
              onClick={handleCreateShare}
              disabled={shareState.status === "creating"}
              className="button button-primary"
            >
              <Share2 size={16} aria-hidden="true" />
              {shareState.status === "creating" ? "جار الإنشاء..." : "إنشاء رابط مشاركة"}
            </button>
            <button type="button" className="button button-secondary" onClick={toggleSelectAllVisible}>تحديد الظاهر</button>
            <button type="button" className="button button-secondary" onClick={() => setSelectedKeys([])}>مسح التحديد</button>
          </div>
        </div>
      ) : null}

      {shareState.status === "success" ? (
        <div className="state-banner state-banner-success">
          <strong>تم إنشاء الرابط بنجاح</strong>
          <span className="helper-text">
            <a className="text-accent" href={`/share/${encodeURIComponent(shareState.token)}`}>
              فتح المشاركة
            </a>
            {shareState.url ? ` | ${shareState.url}` : ""}
          </span>
        </div>
      ) : null}

      {shareState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>خطأ في المشاركة</strong>
          <span className="helper-text">{shareState.message}</span>
        </div>
      ) : null}

      {viewMode === "browser" ? (
        <section className="workspace-panel" aria-label="متصفح المجلدات">
          <div className="workspace-panel__header">
            <div>
              <h2>متصفح المجلدات</h2>
              <p>تنقل داخل شجرة مخزن الملفات عبر المجلدات ومسار التنقل.</p>
            </div>
            <button type="button" className="button button-secondary button-sm" onClick={() => void loadBrowser(browserPath)}>
              <RefreshCw size={16} aria-hidden="true" />
              تحديث المجلد
            </button>
          </div>

          <nav className="record-meta" aria-label="مسار المجلد الحالي">
            <button type="button" className="badge" onClick={() => setBrowserPath("")} disabled={!browserPath}>
              الجذر
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

          {browserState.status === "loading" ? (
            <p className="form-status" role="status" aria-live="polite">جار تحميل محتوى المجلد...</p>
          ) : null}

          {browserState.status === "error" ? (
            <div className="state-banner state-banner-error" role="alert">
              <strong>تعذر تصفح المجلد</strong>
              <span className="helper-text">{browserState.message}</span>
            </div>
          ) : null}

          {browserState.status === "ready" ? (
            browserState.entries.length === 0 ? (
              <EmptyState icon={<FolderOpen size={22} />} title="مجلد فارغ." description="لا توجد ملفات أو مجلدات فرعية في هذا المسار." />
            ) : (
              <DataTable
                ariaLabel="محتوى المجلد"
                columns={browserColumns}
                data={browserEntries}
                emptyMessage="لا توجد ملفات أو مجلدات فرعية."
                getRowId={(entry) => entry.key}
                virtualized={browserEntries.length > 80}
              />
            )
          ) : null}
        </section>
      ) : null}

      {viewMode !== "browser" && state.status === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جار تحميل قائمة الملفات...</p>
        </div>
      ) : null}

      {viewMode !== "browser" && state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل الملفات</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {viewMode !== "browser" && state.status === "ready" ? (
        visibleFiles.length === 0 ? (
          <EmptyState
            icon={<FileQuestion size={22} />}
            title="لم يتم العثور على ملفات."
            description="جرّب بحثاً أوسع أو غيّر الفلاتر، ثم أعد فحص التخزين عند الحاجة."
            actions={(
              <button type="button" className="button button-secondary" onClick={() => void handleScan()}>
                <ScanSearch size={16} aria-hidden="true" />
                فحص التخزين
              </button>
            )}
          />
        ) : (
          <section className="files-workspace" aria-label="واجهة الملفات">
            <div className="files-surface" data-view={viewMode}>
              {viewMode === "table" ? (
                <DataTable
                  ariaLabel="قائمة الملفات"
                  columns={fileColumns}
                  data={visibleFiles}
                  emptyMessage="لا توجد ملفات مطابقة."
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
                      aria-label={`تحديد ${getFileName(file)}`}
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
                        <span className="badge">{formatDate(file.modifiedAt)}</span>
                      </div>
                      {renderFileActions(file)}
                    </div>
                  </article>
                ))
              )}
            </div>

            <aside className="record-preview-rail" aria-label="معاينة الملف">
              {previewFile ? (
                <>
                  <div className="panel-section-header">
                    <span className="badge">معاينة</span>
                    <h2>{getFileName(previewFile)}</h2>
                  </div>
                  <p className="wrap-anywhere">{previewFile.key}</p>
                  <div className="kv-grid">
                    <div className="kv-item">
                      <strong>النوع</strong>
                      <span>{kindLabel(getFileKind(previewFile))}</span>
                    </div>
                    <div className="kv-item">
                      <strong>الحجم</strong>
                      <span>{formatBytes(previewFile.size)}</span>
                    </div>
                    <div className="kv-item">
                      <strong>المخزن</strong>
                      <span>{previewFile.store || "-"}</span>
                    </div>
                    <div className="kv-item">
                      <strong>التاريخ</strong>
                      <span>{formatDate(previewFile.modifiedAt)}</span>
                    </div>
                  </div>
                  <div className="button-row">
                    {isPlayableFile(previewFile) ? (
                      <a className="button button-primary" href={mediaPlayHref(previewFile)}>
                        <Play size={16} aria-hidden="true" />
                        تشغيل الملف
                      </a>
                    ) : null}
                    <button type="button" className="button button-secondary" onClick={() => handleToggleFile(previewFile.key)}>
                      <Share2 size={16} aria-hidden="true" />
                      {selectedKeySet.has(previewFile.key) ? "إزالة من التحديد" : "تحديد الملف"}
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState icon={<Eye size={22} />} title="لا توجد معاينة." description="مرر فوق ملف أو حدده لعرض تفاصيله هنا." />
              )}
            </aside>
          </section>
        )
      ) : null}
    </AppShell>
  );
}
