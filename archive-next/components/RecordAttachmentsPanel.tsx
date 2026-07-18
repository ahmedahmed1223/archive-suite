"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { createArchiveApiClient, type RecordAttachment } from "@/lib/archive-api";

const api = createArchiveApiClient();
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function RecordAttachmentsPanel({ recordId, store = "archive-items" }: Readonly<{ recordId: string; store?: string }>) {
  const [items, setItems] = useState<RecordAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("جارٍ تحميل المرفقات…");

  useEffect(() => {
    let active = true;
    api.recordAttachments(recordId, store).then((response) => {
      if (!active) return;
      if (response.ok) { setItems(response.attachments); setStatus(""); }
      else setStatus(response.error);
    });
    return () => { active = false; };
  }, [recordId, store]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setBusy(true); setStatus("جارٍ رفع المرفقات…");
    const response = await api.uploadRecordAttachments(recordId, files, store);
    setBusy(false); event.target.value = "";
    if (!response.ok) { setStatus(response.error); return; }
    setItems((current) => [...current, ...response.attachments]); setStatus("تم رفع المرفقات.");
  }

  async function remove(item: RecordAttachment) {
    if (busy || !window.confirm(`حذف المرفق «${item.originalName}»؟`)) return;
    setBusy(true); setStatus("جارٍ الحذف…");
    const response = await api.deleteRecordAttachment(recordId, item.id, store);
    setBusy(false);
    if (!response.ok) { setStatus(response.error); return; }
    setItems((current) => current.filter(({ id }) => id !== item.id)); setStatus("تم حذف المرفق.");
  }

  return (
    <article className="panel">
      <div className="panel-title-row"><div><h2>المرفقات</h2><p className="helper-text">ملفات متعددة مرتبطة بهذا السجل الوصفي.</p></div><span className="badge">{items.length}</span></div>
      {items.length ? <ul className="graph-relation-list">{items.map((item) => <li key={item.id}><span><b>{item.originalName}</b><small>{formatSize(item.sizeBytes)} · {item.processingStatus}{item.isPrimary ? " · أساسي" : ""}</small></span><button type="button" className="button button-secondary" disabled={busy} onClick={() => remove(item)}>حذف</button></li>)}</ul> : <p className="helper-text">لا توجد ملفات بعد؛ السجل صالح كسجل وصفي مستقل.</p>}
      <label className="button button-primary"><input type="file" multiple hidden disabled={busy} onChange={upload} />{busy ? "جارٍ التنفيذ…" : "إضافة مرفقات"}</label>
      {status ? <p className="form-status" role="status">{status}</p> : null}
    </article>
  );
}
