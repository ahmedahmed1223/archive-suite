"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type ReviewLinkDetails } from "@/lib/archive-api";
import { buildShareExpiry, redactAdminSecrets } from "@/lib/admin-action-summary";

type ReviewLinkState =
  | { status: "loading" }
  | { status: "ready"; data: ReviewLinkDetails }
  | { status: "error"; message: string };

export function ReviewLinkViewer({ token }: { token: string }) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<ReviewLinkState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    api.reviewLink(token).then((response) => {
      if (!active) return;

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setState({ status: "ready", data: response });
    });

    return () => {
      active = false;
    };
  }, [api, token]);

  if (state.status === "loading") {
    return (
      <div className="state-banner" role="status">
        <strong>جار تحميل رابط المراجعة</strong>
        <p className="helper-text">يتم جلب التعليقات والبيانات المسموحة لهذا الرابط.</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="state-banner state-banner-error" role="alert">
        <strong>تعذر تحميل رابط المراجعة</strong>
        <p className="helper-text">{redactAdminSecrets(state.message)}</p>
      </div>
    );
  }

  const { data } = state;
  const expiry = buildShareExpiry(data.review.expiresAt);

  return (
    <main className="share-list" aria-label="محتوى رابط المراجعة">
      <p className="helper-text">رابط مراجعة عام؛ لا يتيح إدارة الأصل أو تغيير صلاحياته.</p>
      <div className="kv-grid">
        <div className="kv-item">
          <strong>المادة</strong>
          <span className="wrap-anywhere">{data.mediaUid}</span>
        </div>
        <div className="kv-item">
          <strong>الصلاحية</strong>
          <span>{data.review.permission}</span>
        </div>
        {data.review.expiresAt ? (
          <div className="kv-item">
            <strong>ينتهي</strong>
            <time>{new Date(data.review.expiresAt).toLocaleString("ar-SA")}</time>
          </div>
        ) : null}
        <div className="kv-item"><strong>تقدير الصلاحية</strong><span className={`badge badge-${expiry.tone}`}>{expiry.label}</span><small className="helper-text">تقدير محلي حسب التاريخ المعلن؛ الإنفاذ بالخادم.</small></div>
      </div>
      {data.comments.length === 0 ? (
        <div className="empty-state">لا توجد تعليقات متاحة لهذا الرابط.</div>
      ) : (
        data.comments.map((comment) => (
          <article className="panel" key={comment.id}>
            <div className="panel-title-row">
              <h2>{comment.author}</h2>
              <span className="badge">{Math.floor(comment.timecodeSeconds / 60)}:{Math.floor(comment.timecodeSeconds % 60).toString().padStart(2, "0")}</span>
            </div>
            <p>{redactAdminSecrets(comment.body)}</p>
          </article>
        ))
      )}
    </main>
  );
}
