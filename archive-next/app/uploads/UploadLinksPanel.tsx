"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type UploadLink } from "@/lib/archive-api";

type UploadLinksState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function UploadLinksPanel() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [links, setLinks] = useState<UploadLink[]>([]);
  const [linksState, setLinksState] = useState<UploadLinksState>({ status: "loading" });
  const [label, setLabel] = useState("");
  const [folder, setFolder] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(48);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function refresh() {
    setLinksState({ status: "loading" });
    const response = await api.uploadLinks();
    if (response.ok) {
      setLinks(response.links);
      setLinksState({ status: "ready" });
    } else {
      setLinksState({ status: "error", message: response.error || "تعذر تحميل روابط الرفع." });
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreating(true);
    const response = await api.createUploadLink({
      label: label || undefined,
      folder: folder || undefined,
      expiresInHours
    });

    if (!response.ok) {
      setError(response.error);
      setIsCreating(false);
      return;
    }

    setLabel("");
    setFolder("");
    await refresh();
    setIsCreating(false);
  }

  async function handleRevoke(id: string) {
    setError(null);
    setRevokingId(id);
    const response = await api.revokeUploadLink(id);
    if (response.ok) await refresh();
    else setError(response.error || "تعذر إلغاء الرابط.");
    setRevokingId(null);
  }

  return (
    <article className="panel">
      <div className="toolbar-row">
        <div>
          <h2>روابط رفع خارجية</h2>
          <p className="field-note">أنشئ رابطًا مؤقتًا لطرف خارجي لرفع الملفات إلى مجلد محدد دون منحه صلاحية كاملة.</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <label>
          تسمية الرابط (اختياري)
          <input type="text" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="فريق الميدان" />
        </label>
        <label>
          مجلّد الوجهة (اختياري)
          <input type="text" value={folder} onChange={(event) => setFolder(event.target.value)} dir="ltr" placeholder="incoming/field" />
        </label>
        <label>
          صلاحية الرابط (ساعات)
          <input
            type="number"
            min={1}
            max={720}
            value={expiresInHours}
            onChange={(event) => setExpiresInHours(Number(event.target.value) || 1)}
          />
        </label>
        <button type="submit" className="button button-primary" disabled={isCreating}>{isCreating ? "جار الإنشاء..." : "إنشاء رابط"}</button>
        {error ? (
          <p className="form-status" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {linksState.status === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite"><p className="form-status">جار تحميل روابط الرفع...</p></div>
      ) : linksState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل روابط الرفع</strong>
          <span className="helper-text">{linksState.message}</span>
          <div><button type="button" className="button button-secondary button-sm" onClick={() => void refresh()}>إعادة المحاولة</button></div>
        </div>
      ) : links.length === 0 ? (
        <p className="helper-text">لا توجد روابط رفع بعد.</p>
      ) : (
        <ul className="stack">
          {links.map((link) => (
            <li key={link.id} className="record-meta">
              <span className="badge">{link.label || "بدون تسمية"}</span>
              {link.folder ? <span className="badge">{link.folder}</span> : null}
              <span className="badge">{link.revoked ? "ملغى" : "فعّال"}</span>
              <span className="badge">{link.uploadCount} ملف مرفوع</span>
              {!link.revoked ? (
                <button type="button" className="button button-secondary button-sm" disabled={revokingId === link.id} onClick={() => void handleRevoke(link.id)}>
                  {revokingId === link.id ? "جار الإلغاء..." : "إلغاء"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
