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
            شغّل الوسائط القابلة للعرض مباشرة، اختر ملفات متعددة، أو أنشئ روابط
            مشاركة عامة للوصول الفوري إلى العناصر المحددة.
          </p>
          <div className="hero-actions">
            <span className="badge">مستعرض الملفات</span>
            {selectedKeys.size > 0 && (
              <span className="badge">{selectedKeys.size} محدد</span>
            )}
          </div>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="ابحث عن اسم الملف أو المسار..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
            autoFocus
          />
          <button type="submit" className="button button-primary">بحث</button>
        </form>

        {state.status === "loading" && (
          <div className="panel panel-compact" role="status" aria-live="polite">
            <p className="form-status">جار تحميل قائمة الملفات...</p>
          </div>
        )}

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
                <p className="helper-text">جرّب بحثاً أوسع أو غيّر المعايير.</p>
              </div>
            ) : (
              <>
                <div className="toolbar-row">
                  <span className="helper-text">
                    {state.files.length} ملف
                    {selectedKeys.size > 0 && ` · ${selectedKeys.size} محدد`}
                  </span>
                  {selectedKeys.size > 0 && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => setSelectedKeys(new Set())}
                    >
                      مسح التحديد
                    </button>
                  )}
                </div>

                <div className="data-table scroll-x">
                  <table role="grid" aria-label="قائمة الملفات">
                    <thead>
                      <tr>
                        <th style={{ width: "3rem" }}>
                          <input
                            type="checkbox"
                            checked={selectedKeys.size === state.files.length && state.files.length > 0}
                            onChange={() => {
                              if (selectedKeys.size === state.files.length) {
                                setSelectedKeys(new Set());
                              } else {
                                setSelectedKeys(new Set(state.files.map((f) => f.key)));
                              }
                            }}
                            aria-label="تحديد الكل"
                          />
                        </th>
                        <th>الاسم</th>
                        <th style={{ width: "8rem" }}>الحجم</th>
                        <th style={{ width: "10rem" }}>المخزن</th>
                        <th style={{ width: "8rem" }}>التاريخ</th>
                        <th style={{ width: "6rem" }}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.files.map((file) => (
                        <tr key={file.key}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(file.key)}
                              onChange={() => handleToggleFile(file.key)}
                              aria-label={`تحديد ${file.name || file.key}`}
                            />
                          </td>
                          <td className="wrap-anywhere">
                            <strong>{file.name || file.key}</strong>
                            {file.key !== file.name && file.key ? (
                              <div className="field-note text-xs">{file.key}</div>
                            ) : null}
                          </td>
                          <td className="mono-text text-sm">
                            {file.size !== undefined ? formatBytes(file.size) : "—"}
                          </td>
                          <td className="text-sm">{file.store || "—"}</td>
                          <td className="mono-text text-sm">
                            {file.modifiedAt
                              ? new Date(file.modifiedAt).toLocaleDateString("ar-SA")
                              : "—"}
                          </td>
                          <td>
                            {isPlayableFile(file) ? (
                              <a
                                href={mediaPlayHref(file)}
                                className="button button-secondary"
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                              >
                                تشغيل
                              </a>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedKeys.size > 0 && (
                  <div className="state-banner state-banner-success">
                    <div className="toolbar-row">
                      <strong>{selectedKeys.size} ملف محدد</strong>
                      <button
                        onClick={handleCreateShare}
                        disabled={shareState.status === "creating"}
                        className="button button-primary"
                      >
                        {shareState.status === "creating"
                          ? "جار الإنشاء..."
                          : "إنشاء رابط مشاركة"}
                      </button>
                    </div>
                  </div>
                )}

                {shareState.status === "success" && (
                  <div className="state-banner state-banner-success">
                    <strong>تم إنشاء الرابط بنجاح</strong>
                    <span className="helper-text">
                      <a href={`/share/${encodeURIComponent(shareState.token)}`}>
                        فتح المشاركة →
                      </a>
                      {shareState.url ? ` | ${shareState.url}` : ""}
                    </span>
                  </div>
                )}

                {shareState.status === "error" && (
                  <div className="state-banner state-banner-error" role="alert">
                    <strong>خطأ في المشاركة</strong>
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
