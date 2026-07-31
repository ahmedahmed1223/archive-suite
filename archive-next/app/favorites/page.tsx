"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type SavedFavorite } from "@/lib/archive-api";

function formatLocalDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar-SA");
}

export default function FavoritesPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [favorites, setFavorites] = useState<SavedFavorite[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api.favorites().then((response) => {
      if (response.ok) setFavorites(response.favorites);
      else setError(response.error || "تعذر تحميل المفضلة.");
    });
  }, [api]);

  const handleRemove = async (favorite: SavedFavorite) => {
    const response = await api.removeFavorite(favorite.recordId, favorite.store);
    if (response.ok) setFavorites((current) => current.filter((item) => item.recordId !== favorite.recordId || item.store !== favorite.store));
    else setError(response.error || "تعذر إزالة المفضلة.");
  };

  return (
    <AppShell subtitle="المفضلة" navLabel="المفضلة" contentClassName="local-list-content" tipsPage="favorites">
      <PageToolbar
        eyebrow={<span className="badge">محفوظة للحساب</span>}
        title="المفضلة"
        description="السجلات التي اختارها المستخدم للرجوع السريع من أي جلسة موثقة."
        meta={
          <>
            <span className="badge">المفضلات المحفوظة</span>
            <span className="badge">{favorites.length} عنصر</span>
          </>
        }
        actions={
          <a className="button button-secondary" href="/archive">
            فتح الأرشيف
          </a>
        }
      />

      {error ? <div className="state-banner state-banner-error" role="alert">{error}</div> : null}

      {favorites.length === 0 ? (
        <EmptyState
          title="لا توجد عناصر مفضلة بعد"
          description="افتح أي سجل من الأرشيف وأضفه إلى المفضلة ليظهر هنا."
          actions={<a className="button button-secondary" href="/archive">استعراض الأرشيف</a>}
        />
      ) : (
        <section className="panel" aria-label="السجلات المفضلة">
          <div className="panel-title-row">
            <div>
              <h2>قائمة المفضلة</h2>
              <p>إدارة الاختصارات المحلية للسجلات الأكثر استخداما.</p>
            </div>
            <span className="badge">{favorites.length} عنصر</span>
          </div>

          <div className="mobile-card-list" role="list" aria-label="بطاقات العناصر المفضلة">
            {favorites.map((favorite) => (
              <article className="local-list-card" key={`${favorite.store}:${favorite.recordId}`} role="listitem">
                <div className="local-list-card__main">
                  <div>
                    <span className="badge">مفضلة</span>
                    <h3>{favorite.title || favorite.recordId}</h3>
                  </div>
                  <span className="badge">{favorite.type || "غير محدد"}</span>
                </div>
                <dl className="mobile-field-list">
                  <div>
                    <dt>تاريخ الإضافة</dt>
                    <dd>{formatLocalDate(favorite.addedAt)}</dd>
                  </div>
                  <div>
                    <dt>المعرّف</dt>
                    <dd dir="ltr">{favorite.recordId}</dd>
                  </div>
                </dl>
                <div className="button-row">
                  <a
                    className="button button-secondary button-sm"
                    href={`/archive/${encodeURIComponent(favorite.recordId)}`}
                  >
                    فتح
                  </a>
                  <button
                    type="button"
                    className="button button-danger button-sm"
                    onClick={() => void handleRemove(favorite)}
                  >
                    حذف
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="scroll-x desktop-table-wrap">
            <table className="data-table" role="grid" aria-label="قائمة العناصر المفضلة">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>النوع</th>
                  <th>تاريخ الإضافة</th>
                  <th className="data-table-sticky-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {favorites.map((favorite) => (
                  <tr key={`${favorite.store}:${favorite.recordId}`}>
                    <td className="wrap-anywhere">
                      <strong>{favorite.title || favorite.recordId}</strong>
                    </td>
                    <td>{favorite.type || "-"}</td>
                    <td className="mono-text">
                      {formatLocalDate(favorite.addedAt)}
                    </td>
                    <td className="data-table-sticky-end">
                      <div className="button-row">
                        <a
                          className="button button-secondary button-sm"
                          href={`/archive/${encodeURIComponent(favorite.recordId)}`}
                        >
                          فتح
                        </a>
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          onClick={() => void handleRemove(favorite)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
