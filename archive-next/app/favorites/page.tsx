"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type SavedFavorite } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

function formatLocalDate(value: string | null, locale: "ar" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale === "en" ? "en-US" : "ar-SA");
}

export default function FavoritesPage() {
  const { locale, t } = useLocale();
  const copy = locale === "en" ? { loadError: "Could not load favorites.", removeError: "Could not remove the favorite.", eyebrow: "Saved for this account", title: "Favorites", description: "Records the user saved for quick access from any authenticated session.", saved: "Saved favorites", items: "items", openArchive: "Open archive", emptyTitle: "No favorite items yet", emptyDescription: "Open any record in the archive and add it to Favorites to show it here.", browse: "Browse archive", records: "Favorite records", list: "Favorites list", listDescription: "Manage quick links to the records you use most.", cards: "Favorite item cards", favorite: "Favorite", unspecified: "Unspecified", added: "Date added", identifier: "Identifier", open: "Open", delete: "Delete", columns: { title: "Title", type: "Type", added: "Date added", actions: "Actions" } } : { loadError: "تعذر تحميل المفضلة.", removeError: "تعذر إزالة المفضلة.", eyebrow: "محفوظة للحساب", title: "المفضلة", description: "السجلات التي اختارها المستخدم للرجوع السريع من أي جلسة موثقة.", saved: "المفضلات المحفوظة", items: "عنصر", openArchive: "فتح الأرشيف", emptyTitle: "لا توجد عناصر مفضلة بعد", emptyDescription: "افتح أي سجل من الأرشيف وأضفه إلى المفضلة ليظهر هنا.", browse: "استعراض الأرشيف", records: "السجلات المفضلة", list: "قائمة المفضلة", listDescription: "إدارة الاختصارات المحلية للسجلات الأكثر استخداما.", cards: "بطاقات العناصر المفضلة", favorite: "مفضلة", unspecified: "غير محدد", added: "تاريخ الإضافة", identifier: "المعرّف", open: "فتح", delete: "حذف", columns: { title: "العنوان", type: "النوع", added: "تاريخ الإضافة", actions: "الإجراءات" } };
  const api = useMemo(() => createArchiveApiClient(), []);
  const [favorites, setFavorites] = useState<SavedFavorite[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api.favorites().then((response) => {
      if (response.ok) setFavorites(response.favorites);
      else setError(response.error || copy.loadError);
    });
  }, [api, copy.loadError]);

  const handleRemove = async (favorite: SavedFavorite) => {
    const response = await api.removeFavorite(favorite.recordId, favorite.store);
    if (response.ok) setFavorites((current) => current.filter((item) => item.recordId !== favorite.recordId || item.store !== favorite.store));
    else setError(response.error || copy.removeError);
  };

  return (
    <AppShell subtitle={t.pageTitles.favorites} navLabel={t.pageTitles.favorites} contentClassName="local-list-content" tipsPage="favorites">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={
          <>
            <span className="badge">{copy.saved}</span>
            <span className="badge">{favorites.length} {copy.items}</span>
          </>
        }
        actions={
          <a className="button button-secondary" href="/archive">
            {copy.openArchive}
          </a>
        }
      />

      {error ? <div className="state-banner state-banner-error" role="alert">{error}</div> : null}

      {favorites.length === 0 ? (
        <EmptyState
          title={copy.emptyTitle}
          description={copy.emptyDescription}
          actions={<a className="button button-secondary" href="/archive">{copy.browse}</a>}
        />
      ) : (
        <section className="panel" aria-label={copy.records}>
          <div className="panel-title-row">
            <div>
              <h2>{copy.list}</h2>
              <p>{copy.listDescription}</p>
            </div>
            <span className="badge">{favorites.length} {copy.items}</span>
          </div>

          <div className="mobile-card-list" role="list" aria-label={copy.cards}>
            {favorites.map((favorite) => (
              <article className="local-list-card" key={`${favorite.store}:${favorite.recordId}`} role="listitem">
                <div className="local-list-card__main">
                  <div>
                    <span className="badge">{copy.favorite}</span>
                    <h3>{favorite.title || favorite.recordId}</h3>
                  </div>
                  <span className="badge">{favorite.type || copy.unspecified}</span>
                </div>
                <dl className="mobile-field-list">
                  <div>
                    <dt>{copy.added}</dt>
                    <dd>{formatLocalDate(favorite.addedAt, locale)}</dd>
                  </div>
                  <div>
                    <dt>{copy.identifier}</dt>
                    <dd dir="ltr">{favorite.recordId}</dd>
                  </div>
                </dl>
                <div className="button-row">
                  <a
                    className="button button-secondary button-sm"
                    href={`/archive/${encodeURIComponent(favorite.recordId)}`}
                  >
                    {copy.open}
                  </a>
                  <button
                    type="button"
                    className="button button-danger button-sm"
                    onClick={() => void handleRemove(favorite)}
                  >
                    {copy.delete}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="scroll-x desktop-table-wrap">
            <table className="data-table" role="grid" aria-label={copy.list}>
              <thead>
                <tr>
                  <th>{copy.columns.title}</th>
                  <th>{copy.columns.type}</th>
                  <th>{copy.columns.added}</th>
                  <th className="data-table-sticky-end">{copy.columns.actions}</th>
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
                      {formatLocalDate(favorite.addedAt, locale)}
                    </td>
                    <td className="data-table-sticky-end">
                      <div className="button-row">
                        <a
                          className="button button-secondary button-sm"
                          href={`/archive/${encodeURIComponent(favorite.recordId)}`}
                        >
                          {copy.open}
                        </a>
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          onClick={() => void handleRemove(favorite)}
                        >
                          {copy.delete}
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
