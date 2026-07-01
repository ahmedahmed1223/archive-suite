"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";

type ShareState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[]; permission?: string }
  | { status: "error"; message: string };

export function ShareViewer({ token }: { token: string }) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ShareState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    api.share(token).then((response) => {
      if (!active) return;

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setState({
        status: "ready",
        records: response.records,
        permission: typeof response.permission === "string" ? response.permission : undefined
      });
    });

    return () => {
      active = false;
    };
  }, [api, token]);

  if (state.status === "loading") {
    return (
      <div className="state-banner" role="status">
        <strong>جار تحميل المشاركة</strong>
        <p className="helper-text">يتم جلب السجلات المسموحة لهذا الرابط.</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="state-banner state-banner-error" role="alert">
        <strong>تعذر تحميل المشاركة</strong>
        <p className="helper-text">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="share-list" aria-label="محتوى المشاركة">
      <div className="kv-grid">
        <div className="kv-item">
          <strong>الصلاحية</strong>
          <span>{state.permission ?? "view"}</span>
        </div>
        <div className="kv-item">
          <strong>عدد السجلات</strong>
          <span>{state.records.length}</span>
        </div>
      </div>
      {state.records.length === 0 ? (
        <div className="empty-state">لا توجد سجلات في هذه المشاركة.</div>
      ) : (
        state.records.map((record) => (
          <article className="panel" key={record.uid ?? record.id}>
            <h2>{record.title}</h2>
            {record.description ? <p>{record.description}</p> : null}
            <div className="record-meta">
              <span className="badge">{record.type ?? "record"}</span>
              <span className="badge wrap-anywhere">{record.uid ?? record.id}</span>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
