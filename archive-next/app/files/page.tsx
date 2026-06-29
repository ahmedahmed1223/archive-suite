"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
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

export default function FilesPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<FileState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [shareState, setShareState] = useState<ShareState>({ status: "idle" });

  // Load initial files on mount
  const loadFiles = async (q: string) => {
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
  };

  // Initialize on mount
  useEffect(() => {
    let active = true;
    loadFiles("").then(() => {
      if (!active) return;
    });
    return () => {
      active = false;
    };
  }, []);

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
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>استعراض الملفات</span>
        </div>
        <a className="badge" href="/">حالة الترحيل</a>
      </header>

      <section className="content" aria-label="استعراض الملفات والمشاركة">
        <div className="hero">
          <span className="badge">Next.js file browser</span>
          <h1>استعرض الملفات المحفوظة.</h1>
          <p>
            اختر ملفات من مساحة التخزين ثم أنشئ رابط مشاركة عام.
            ستتمكن من مشاركة الرابط مع الآخرين للوصول إلى الملفات المختارة.
          </p>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="ابحث عن الملفات..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="badge">بحث</button>
        </form>

        {state.status === "loading" && (
          <p className="form-status">جار تحميل الملفات...</p>
        )}

        {state.status === "error" && (
          <p className="form-status" role="alert">{state.message}</p>
        )}

        {state.status === "ready" && (
          <>
            {state.files.length === 0 ? (
              <p className="form-status">لم يتم العثور على ملفات.</p>
            ) : (
              <>
                <div className="grid" aria-label="قائمة الملفات">
                  {state.files.map((file) => (
                    <article className="panel" key={file.key}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(file.key)}
                          onChange={() => handleToggleFile(file.key)}
                          aria-label={`تحديد ${file.name || file.key}`}
                        />
                        <div style={{ flex: 1 }}>
                          <h2>{file.name || file.key}</h2>
                          {file.key !== file.name && file.key ? (
                            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary, #666)" }}>
                              {file.key}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="record-meta">
                        {file.size !== undefined ? (
                          <span className="badge">{formatBytes(file.size)}</span>
                        ) : null}
                        {file.store ? (
                          <span className="badge">{file.store}</span>
                        ) : null}
                      </div>
                      {file.modifiedAt ? (
                        <time className="created-at">
                          {new Date(file.modifiedAt).toLocaleDateString("ar-SA")}
                        </time>
                      ) : null}
                    </article>
                  ))}
                </div>

                <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", alignItems: "center" }}>
                  <button
                    onClick={handleCreateShare}
                    disabled={selectedKeys.size === 0 || shareState.status === "creating"}
                    className="badge"
                  >
                    {shareState.status === "creating" ? "جار الإنشاء..." : "إنشاء رابط مشاركة"}
                  </button>
                  {selectedKeys.size > 0 && (
                    <span style={{ fontSize: "0.875rem", color: "var(--text-secondary, #666)" }}>
                      {selectedKeys.size} ملف محدد
                    </span>
                  )}
                </div>

                {shareState.status === "success" && (
                  <div
                    className="form-status"
                    style={{ backgroundColor: "var(--color-success, #e8f5e9)", padding: "1rem", borderRadius: "0.25rem", marginTop: "1rem" }}
                  >
                    <p>
                      تم إنشاء رابط المشاركة بنجاح!{" "}
                      <a href={`/share/${encodeURIComponent(shareState.token)}`}>
                        اذهب إلى المشاركة
                      </a>
                    </p>
                    {shareState.url && (
                      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
                        الرابط: {shareState.url}
                      </p>
                    )}
                  </div>
                )}

                {shareState.status === "error" && (
                  <p className="form-status" role="alert" style={{ marginTop: "1rem" }}>
                    خطأ: {shareState.message}
                  </p>
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
