"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

const navLinks = [
  { href: "/", label: "الرئيسية" },
  { href: "/archive", label: "السجلات" },
  { href: "/reports", label: "التقارير" },
  { href: "/help", label: "المساعدة" },
  { href: "/media/jobs", label: "Media jobs" },
  { href: "/login", label: "تسجيل الدخول" }
] as const;

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
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>استعراض الملفات</span>
        </div>
        <nav className="route-links" aria-label="مسارات سريعة">
          {navLinks.map((link) => (
            <a key={link.href} className="badge" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="content" aria-label="استعراض الملفات والمشاركة">
        <div className="hero">
          <span className="badge">مستعرض ملفات Next.js</span>
          <h1>استعرض الملفات المحفوظة.</h1>
          <p>
            اختر ملفات من مساحة التخزين ثم أنشئ رابط مشاركة عام للوصول إلى
            العناصر المحددة مباشرة.
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
          <button type="submit" className="button button-primary">بحث</button>
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
              <p className="empty-state">لم يتم العثور على ملفات.</p>
            ) : (
              <>
                <div className="grid" aria-label="قائمة الملفات">
                  {state.files.map((file) => (
                    <article className="panel" key={file.key}>
                      <div className="toolbar-row" style={{ alignItems: "start" }}>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(file.key)}
                          onChange={() => handleToggleFile(file.key)}
                          aria-label={`تحديد ${file.name || file.key}`}
                        />
                        <div style={{ flex: 1, minInlineSize: 0 }}>
                          <h2>{file.name || file.key}</h2>
                          {file.key !== file.name && file.key ? (
                            <p className="field-note" style={{ overflowWrap: "anywhere" }}>
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
                    className="button button-primary"
                  >
                    {shareState.status === "creating" ? "جار الإنشاء..." : "إنشاء رابط مشاركة"}
                  </button>
                  {selectedKeys.size > 0 && (
                    <span className="badge">
                      {selectedKeys.size} ملف محدد
                    </span>
                  )}
                </div>

                {shareState.status === "success" && (
                  <div className="panel" style={{ marginTop: "0.25rem", borderColor: "color-mix(in oklch, var(--va-success) 26%, var(--va-border-soft))" }}>
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
                  <p className="form-status status-error" role="alert" style={{ marginTop: "1rem" }}>
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
