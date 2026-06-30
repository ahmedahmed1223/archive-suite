"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createArchiveApiClient, type ArchiveRecord, type RightsRecord } from "@/lib/archive-api";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; record: ArchiveRecord; rights: RightsRecord | null }
  | { status: "error"; message: string };

export default function ArchiveDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const navLinks = [
    { href: "/", label: "الرئيسية" },
    { href: "/archive", label: "السجلات" },
    { href: "/files", label: "الملفات" },
    { href: "/reports", label: "التقارير" },
    { href: "/help", label: "المساعدة" },
    { href: "/media/jobs", label: "Media jobs" }
  ] as const;

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (!id) {
        setState({ status: "error", message: "معرف السجل غير صحيح" });
        return;
      }

      setState({ status: "loading" });

      // Fetch record
      const recordResponse = await api.record(id);
      if (!recordResponse.ok) {
        setState({ status: "error", message: recordResponse.error });
        return;
      }

      // Fetch rights (not required to error if missing)
      const rightsResponse = await api.rights(id);
      const rights = rightsResponse.ok ? rightsResponse.record : null;

      if (!active) return;

      setState({
        status: "ready",
        record: recordResponse.record,
        rights
      });
    };

    loadDetail();
    return () => {
      active = false;
    };
  }, [id, api]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>تفاصيل السجل</span>
        </div>
        <nav className="route-links" aria-label="مسارات سريعة">
          {navLinks.map((link) => (
            <a key={link.href} className="badge" href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="content" aria-label="تفاصيل السجل">
        {state.status === "loading" && (
          <p className="form-status">جار تحميل السجل...</p>
        )}

        {state.status === "error" && (
          <p className="form-status" role="alert">{state.message}</p>
        )}

        {state.status === "ready" && (
          <>
            <div className="hero">
              <span className="badge">تفاصيل السجل المحفوظ</span>
              <h1>{state.record.title}</h1>
              {state.record.description && <p>{state.record.description}</p>}
              <div className="record-meta">
                {state.record.store && <span className="badge">{state.record.store}</span>}
                {state.record.type && <span className="badge">{state.record.type}</span>}
                {state.record.updatedAt && (
                  <span className="badge">
                    {new Date(state.record.updatedAt).toLocaleDateString("ar-SA")}
                  </span>
                )}
              </div>
            </div>

            <div className="grid">
              <article className="panel">
                <h2>معلومات السجل</h2>
                <div className="kv-grid">
                  {state.record.store && (
                    <div className="kv-item">
                      <strong>المخزن</strong>
                      <span>{state.record.store}</span>
                    </div>
                  )}

                  {state.record.type && (
                    <div className="kv-item">
                      <strong>النوع</strong>
                      <span>{state.record.type}</span>
                    </div>
                  )}

                  {state.record.createdAt && (
                    <div className="kv-item">
                      <strong>تاريخ الإنشاء</strong>
                      <time>{new Date(state.record.createdAt).toLocaleDateString("ar-SA")}</time>
                    </div>
                  )}

                  {state.record.updatedAt && (
                    <div className="kv-item">
                      <strong>آخر تحديث</strong>
                      <time>{new Date(state.record.updatedAt).toLocaleDateString("ar-SA")}</time>
                    </div>
                  )}
                </div>

                {state.record.tags && state.record.tags.length > 0 && (
                  <div className="stack">
                    <strong>الوسوم</strong>
                    <div className="tags">
                      {state.record.tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </article>

              <article className="panel">
                <h2>بيانات الحقوق</h2>

                {state.rights ? (
                  <>
                    <div className="kv-grid">
                      <div className="kv-item">
                        <strong>صاحب الحقوق</strong>
                        <span>{state.rights.rightsHolder}</span>
                      </div>

                      <div className="kv-item">
                        <strong>نوع الترخيص</strong>
                        <span className="badge">{state.rights.licenseType}</span>
                      </div>

                      {state.rights.embargoStart && (
                        <div className="kv-item">
                          <strong>بداية الحظر</strong>
                          <time>{new Date(state.rights.embargoStart).toLocaleDateString("ar-SA")}</time>
                        </div>
                      )}

                      {state.rights.embargoEnd && (
                        <div className="kv-item">
                          <strong>نهاية الحظر</strong>
                          <time>{new Date(state.rights.embargoEnd).toLocaleDateString("ar-SA")}</time>
                        </div>
                      )}

                      {state.rights.expiresAt && (
                        <div className="kv-item">
                          <strong>تاريخ الانتهاء</strong>
                          <time>{new Date(state.rights.expiresAt).toLocaleDateString("ar-SA")}</time>
                        </div>
                      )}
                    </div>

                    {state.rights.notes && (
                      <div className="stack">
                        <strong>ملاحظات</strong>
                        <p>{state.rights.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="empty-state">لا توجد بيانات حقوق</p>
                )}
              </article>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <a href="/archive" className="button button-secondary">العودة إلى القائمة</a>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
