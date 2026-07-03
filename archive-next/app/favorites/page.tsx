"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { listFavorites, removeFavorite, type Favorite } from "@/lib/favorites";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    setFavorites(listFavorites());
  }, []);

  const handleRemove = (id: string) => {
    removeFavorite(id);
    setFavorites(listFavorites());
  };

  return (
    <AppShell subtitle="المفضلة" navLabel="المفضلة" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">محلي على الجهاز</span>}
        title="المفضلة"
        description="السجلات التي اختارها المستخدم للرجوع السريع من هذا المتصفح دون مزامنة خارجية."
        meta={
          <>
            <span className="badge">المفضلات المحلية</span>
            <span className="badge">{favorites.length} عنصر</span>
          </>
        }
        actions={
          <a className="button button-secondary" href="/archive">
            فتح الأرشيف
          </a>
        }
      />

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

          <div className="scroll-x">
            <table className="data-table" role="grid" aria-label="قائمة العناصر المفضلة">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>النوع</th>
                  <th>تاريخ الإضافة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {favorites.map((favorite) => (
                  <tr key={favorite.id}>
                    <td className="wrap-anywhere">
                      <strong>{favorite.title || favorite.id}</strong>
                    </td>
                    <td>{favorite.type || "-"}</td>
                    <td className="mono-text">
                      {new Date(favorite.addedAt).toLocaleDateString("ar-SA")}
                    </td>
                    <td>
                      <div className="button-row">
                        <a
                          className="button button-secondary button-sm"
                          href={`/archive/${encodeURIComponent(favorite.id)}`}
                        >
                          فتح
                        </a>
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          onClick={() => handleRemove(favorite.id)}
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
