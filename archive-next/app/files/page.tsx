"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { createArchiveApiClient, type ArchiveFile } from "@/lib/archive-api";

type FileState =
  | { status: "loading" }
  | { status: "ready"; files: ArchiveFile[] }
  | { status: "error"; message: string };

type ShareState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "success"; token: string; url?: string }
  | { status: "error"; message: string };

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

function isPlayableFile(file: ArchiveFile): boolean {
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return true;
  }

  const ext = file.key.split(".").pop()?.toLowerCase() ?? "";

  return PLAYABLE_EXTENSIONS.has(ext);
}

function mediaPlayHref(file: ArchiveFile): string {
  const params = new URLSearchParams({ path: file.key });

  if (file.store) {
    params.set("disk", file.store);
  }

  return `/media/play?${params.toString()}`;
}

export default function FilesPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<FileState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [shareState, setShareState] = useState<ShareState>({ status: "idle" });

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

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadFiles(query);
  };

  const handleToggleFile = (fileKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(fileKey)) {
        next.delete(fileKey);
      } else {
        next.add(fileKey);
      }
      return next;
    });
  };

  const handleCreateShare = async () => {
    if (selectedKeys.size === 0) return;

    setShareState({ status: "creating" });
    const response = await api.createShare({
      itemIds: Array.from(selectedKeys)
    });

    if (!response.ok) {
      setShareState({ status: "error", message: response.error });
      return;
    }

    setShareState({
      status: "success",
      token: response.token,
      url: response.url
    });
  };

  return (
    <main className="shell">
      <AppHeader subtitle="استعراض الملفات" />

      <section className="content" aria-label="استعراض الملفات والمشاركة">
        <div className="hero">
          <h1>استعرض الملفات المحفوظة.</h1>
          <p>
            اختر ملفات من مساحة التخزين، شغّل الوسائط القابلة للعرض، أو أنشئ
            رابط مشاركة عام للوصول إلى العناصر المحددة مباشرة.
          </p>
          <div className="hero-actions">
            <span className="badge">مستعرض الملفات</span>
            <span className="badge">
              {selectedKeys.size > 0 ? `${selectedKeys.size} محدد` : "اختيار متعدد"}
            </span>
          </div>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="ابحث عن الملفات..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="button button-primary">بحث</button>
        </form>

        {state.status === "loading" && <p className="form-status" aria-live="polite">جار تحميل الملفات...</p>}

        {state.status === "error" && (
          <div className="state-banner state-banner-error" role="alert">
            <strong>تعذر تحميل الملفات</strong>
            <span className="helper-text">{state.message}</span>
          </div>
        )}

        {state.status === "ready" && (
          <>
            {state.files.length === 0 ? (
              <div className="empty-state">
                <strong>لم يتم العثور على ملفات.</strong>
                <p className="helper-text">جرّب توسيع البحث أو إعادة تعيين الاستعلام.</p>
              </div>
            ) : (
              <>
                <div className="grid" aria-label="قائمة الملفات">
                  {state.files.map((file) => (
                    <article className="panel panel-compact" key={file.key}>
                      <div className="panel-title-row">
                        <label className="file-select-row">
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(file.key)}
                            onChange={() => handleToggleFile(file.key)}
                            aria-label={`تحديد ${file.name || file.key}`}
                          />
                          <span className="file-name-stack">
                            <strong className="wrap-anywhere">{file.name || file.key}</strong>
                            {file.key !== file.name && file.key ? (
                              <span className="field-note wrap-anywhere">
                                {file.key}
                              </span>
                            ) : null}
                          </span>
                        </label>
                        {file.modifiedAt ? (
                          <time className="created-at">
                            {new Date(file.modifiedAt).toLocaleDateString("ar-SA")}
                          </time>
                        ) : null}
                      </div>
                      <div className="record-meta">
                        {file.size !== undefined ? (
                          <span className="badge">{formatBytes(file.size)}</span>
                        ) : null}
                        {file.store ? (
                          <span className="badge">{file.store}</span>
                        ) : null}
                        {isPlayableFile(file) ? (
                          <a className="badge" href={mediaPlayHref(file)}>
                            تشغيل
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="state-banner">
                  <div className="helper-row">
                    <strong>إجراءات الملفات المحددة</strong>
                    {selectedKeys.size > 0 && <span className="badge">{selectedKeys.size} ملف محدد</span>}
                  </div>
                  <button
                    onClick={handleCreateShare}
                    disabled={selectedKeys.size === 0 || shareState.status === "creating"}
                    className="button button-primary"
                  >
                    {shareState.status === "creating" ? "جار الإنشاء..." : "إنشاء رابط مشاركة"}
                  </button>
                </div>

                {shareState.status === "success" && (
                  <div className="state-banner state-banner-success">
                    <strong>تم إنشاء رابط المشاركة بنجاح.</strong>
                    <span className="helper-text">
                      <a href={`/share/${encodeURIComponent(shareState.token)}`}>اذهب إلى المشاركة</a>
                      {shareState.url ? ` · ${shareState.url}` : ""}
                    </span>
                  </div>
                )}

                {shareState.status === "error" && (
                  <div className="state-banner state-banner-error" role="alert">
                    <strong>خطأ في إنشاء الرابط</strong>
                    <span className="helper-text">{shareState.message}</span>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
