"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createArchiveApiClient, type ArchiveRecord, type RightsRecord } from "@/lib/archive-api";
import { isFavorited, toggleFavorite } from "@/lib/favorites";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; record: ArchiveRecord; rights: RightsRecord | null }
  | { status: "error"; message: string };

export default function ArchiveDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [isFav, setIsFav] = useState(false);

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
      setIsFav(isFavorited(id));
    };

    loadDetail();
    return () => {
      active = false;
    };
  }, [id, api]);

  return (
    <main className="shell">
      <AppHeader subtitle="تفاصيل السجل" />

      <section className="content" aria-label="تفاصيل السجل">
        {state.status === "loading" && (
          <div className="panel panel-compact" role="status" aria-live="polite">
            <p className="form-status">جار تحميل السجل...</p>
          </div>
        )}

        {state.status === "error" && (
          <div className="state-banner state-banner-error" role="alert">
            <strong>خطأ في تحميل السجل</strong>
            <span className="helper-text">{state.message}</span>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <div className="hero">
              <span className="badge">تفاصيل السجل</span>
              <h1>{state.record.title || "بدون عنوان"}</h1>
              {state.record.description && (
                <p>{state.record.description}</p>
              )}
              <div className="hero-actions">
                <a href="/archive" className="badge">← العودة</a>
                <button
                  type="button"
                  onClick={() => {
                    const newFav = toggleFavorite(id, state.record.title);
                    setIsFav(newFav);
                  }}
                  className="badge"
                  aria-pressed={isFav}
                  title={isFav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
                >
                  {isFav ? "★ مفضل" : "☆ إضافة"}
                </button>
                {state.record.store && (
                  <span className="badge">{state.record.store}</span>
                )}
                {state.record.type && (
                  <span className="badge">{state.record.type}</span>
                )}
              </div>
            </div>

            <div className="split-layout">
              <div className="page-section">
                <article className="panel">
                  <div className="panel-section-header">
                    <h2>معلومات السجل</h2>
                  </div>
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
                        <strong>الإنشاء</strong>
                        <time className="mono-text">
                          {new Date(state.record.createdAt).toLocaleDateString("ar-SA")}
                        </time>
                      </div>
                    )}

                    {state.record.updatedAt && (
                      <div className="kv-item">
                        <strong>آخر تحديث</strong>
                        <time className="mono-text">
                          {new Date(state.record.updatedAt).toLocaleDateString("ar-SA")}
                        </time>
                      </div>
                    )}
                  </div>

                  {state.record.tags && state.record.tags.length > 0 && (
                    <div className="section-divider">
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
              </div>

              <div className="page-section">
                <article className="panel">
                  <div className="panel-section-header">
                    <h2>حقوق الاستخدام</h2>
                  </div>

                  {state.rights ? (
                    <>
                      <div className="kv-grid">
                        {state.rights.rightsHolder && (
                          <div className="kv-item">
                            <strong>صاحب الحقوق</strong>
                            <span>{state.rights.rightsHolder}</span>
                          </div>
                        )}

                        {state.rights.licenseType && (
                          <div className="kv-item">
                            <strong>الترخيص</strong>
                            <span className="badge">{state.rights.licenseType}</span>
                          </div>
                        )}

                        {state.rights.embargoStart && (
                          <div className="kv-item">
                            <strong>حظر من</strong>
                            <time className="mono-text">
                              {new Date(state.rights.embargoStart).toLocaleDateString("ar-SA")}
                            </time>
                          </div>
                        )}

                        {state.rights.embargoEnd && (
                          <div className="kv-item">
                            <strong>حظر إلى</strong>
                            <time className="mono-text">
                              {new Date(state.rights.embargoEnd).toLocaleDateString("ar-SA")}
                            </time>
                          </div>
                        )}

                        {state.rights.expiresAt && (
                          <div className="kv-item">
                            <strong>ينتهي في</strong>
                            <time className="mono-text">
                              {new Date(state.rights.expiresAt).toLocaleDateString("ar-SA")}
                            </time>
                          </div>
                        )}
                      </div>

                      {state.rights.notes && (
                        <div className="section-divider">
                          <strong>ملاحظات</strong>
                          <p className="text-sm">{state.rights.notes}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-state">
                      <p>لا توجد بيانات حقوق مسجلة لهذا السجل.</p>
                    </div>
                  )}
                </article>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
