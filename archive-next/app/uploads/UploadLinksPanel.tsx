"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type UploadLink } from "@/lib/archive-api";

export function UploadLinksPanel() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [links, setLinks] = useState<UploadLink[]>([]);
  const [label, setLabel] = useState("");
  const [folder, setFolder] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(48);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const response = await api.uploadLinks();
    if (response.ok) setLinks(response.links);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await api.createUploadLink({
      label: label || undefined,
      folder: folder || undefined,
      expiresInHours
    });

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setLabel("");
    setFolder("");
    await refresh();
  }

  async function handleRevoke(id: string) {
    const response = await api.revokeUploadLink(id);
    if (response.ok) await refresh();
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
        <button type="submit" className="button button-primary">إنشاء رابط</button>
        {error ? (
          <p className="form-status" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {links.length === 0 ? (
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
                <button type="button" className="button button-secondary button-sm" onClick={() => void handleRevoke(link.id)}>
                  إلغاء
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
