"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
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

  const detailDescription =
    state.status === "ready"
      ? state.record.description || "تفاصيل السجل وحقوقه في عرض تشغيلي مركز."
      : state.status === "error"
        ? "تعذر تحميل بيانات السجل من خدمة Laravel."
        : "جار تحميل بيانات السجل من خدمة Laravel.";

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
        if (!active) return;
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
    <AppShell subtitle="تفاصيل السجل" navLabel="تفاصيل السجل" contentClassName="archive-content">
      <PageToolbar
        eyebrow={<span className="badge">تفاصيل السجل</span>}
        title={state.status === "ready" ? state.record.title || "بدون عنوان" : "تفاصيل السجل"}
        description={detailDescription}
        meta={
          state.status === "ready" ? (
            <>
              {state.record.store ? <span className="badge">{state.record.store}</span> : null}
              {state.record.type ? <span className="badge">{state.record.type}</span> : null}
              {state.record.subtype ? <span className="badge">{state.record.subtype}</span> : null}
              {state.record.updatedAt ? (
                <span className="badge">
                  {new Date(state.record.updatedAt).toLocaleDateString("ar-SA")}
                </span>
              ) : null}
            </>
          ) : null
        }
        actions={
          <>
            <a href="/archive" className="button button-secondary">
              العودة إلى الأرشيف
            </a>
            {state.status === "ready" ? (
              <button
                type="button"
                onClick={() => {
                  const newFav = toggleFavorite(id, state.record.title);
                  setIsFav(newFav);
                }}
                className={`button ${isFav ? "button-primary" : "button-secondary"}`}
                aria-pressed={isFav}
                title={isFav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
              >
                {isFav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
              </button>
            ) : null}
          </>
        }
      />

      {state.status === "loading" && (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جار تحميل السجل...</p>
        </div>
      )}

      {state.status === "error" && (
        <EmptyState
          title="خطأ في تحميل السجل"
          description={state.message}
          actions={<a href="/archive" className="button button-secondary">العودة إلى الأرشيف</a>}
        />
      )}

      {state.status === "ready" && (
        <div className="split-layout archive-detail-layout" aria-label="تفاصيل السجل">
          <div className="page-section">
            <article className="panel">
              <div className="panel-section-header">
                <h2>معلومات السجل</h2>
              </div>

              <div className="kv-grid">
                <div className="kv-item">
                  <strong>المعرّف</strong>
                  <span className="wrap-anywhere">{state.record.id}</span>
                </div>

                {state.record.uid ? (
                  <div className="kv-item">
                    <strong>UID</strong>
                    <span className="wrap-anywhere">{state.record.uid}</span>
                  </div>
                ) : null}

                {state.record.store ? (
                  <div className="kv-item">
                    <strong>المخزن</strong>
                    <span>{state.record.store}</span>
                  </div>
                ) : null}

                {state.record.type ? (
                  <div className="kv-item">
                    <strong>النوع</strong>
                    <span>{state.record.type}</span>
                  </div>
                ) : null}

                {state.record.subtype ? (
                  <div className="kv-item">
                    <strong>الفرع</strong>
                    <span>{state.record.subtype}</span>
                  </div>
                ) : null}

                {state.record.createdAt ? (
                  <div className="kv-item">
                    <strong>الإنشاء</strong>
                    <time className="mono-text">
                      {new Date(state.record.createdAt).toLocaleDateString("ar-SA")}
                    </time>
                  </div>
                ) : null}

                {state.record.updatedAt ? (
                  <div className="kv-item">
                    <strong>آخر تحديث</strong>
                    <time className="mono-text">
                      {new Date(state.record.updatedAt).toLocaleDateString("ar-SA")}
                    </time>
                  </div>
                ) : null}
              </div>

              {state.record.tags && state.record.tags.length > 0 ? (
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
              ) : null}
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
                    <div className="kv-item">
                      <strong>صاحب الحقوق</strong>
                      <span>{state.rights.rightsHolder}</span>
                    </div>

                    <div className="kv-item">
                      <strong>الترخيص</strong>
                      <span className="badge">{state.rights.licenseType}</span>
                    </div>

                    {state.rights.embargoStart ? (
                      <div className="kv-item">
                        <strong>حظر من</strong>
                        <time className="mono-text">
                          {new Date(state.rights.embargoStart).toLocaleDateString("ar-SA")}
                        </time>
                      </div>
                    ) : null}

                    {state.rights.embargoEnd ? (
                      <div className="kv-item">
                        <strong>حظر إلى</strong>
                        <time className="mono-text">
                          {new Date(state.rights.embargoEnd).toLocaleDateString("ar-SA")}
                        </time>
                      </div>
                    ) : null}

                    {state.rights.expiresAt ? (
                      <div className="kv-item">
                        <strong>ينتهي في</strong>
                        <time className="mono-text">
                          {new Date(state.rights.expiresAt).toLocaleDateString("ar-SA")}
                        </time>
                      </div>
                    ) : null}
                  </div>

                  {state.rights.geoRestrictions && state.rights.geoRestrictions.length > 0 ? (
                    <div className="section-divider">
                      <strong>القيود الجغرافية</strong>
                      <div className="tags">
                        {state.rights.geoRestrictions.map((restriction) => (
                          <span key={restriction} className="tag">
                            {restriction}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {state.rights.notes ? (
                    <div className="section-divider">
                      <strong>ملاحظات</strong>
                      <p>{state.rights.notes}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title="لا توجد بيانات حقوق مسجلة لهذا السجل."
                  description="يمكن متابعة السجل نفسه بينما تظل الحقوق غير متاحة في API."
                />
              )}
            </article>
          </div>
        </div>
      )}
    </AppShell>
  );
}
