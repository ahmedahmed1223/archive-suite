"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { listFavorites, removeFavorite, type Favorite } from "@/lib/favorites";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    setFavorites(listFavorites());
  }, []);

  const handleRemove = (id: string) => {
    removeFavorite(id);
    setFavorites(listFavorites());
  };

  const handleNavigate = (id: string) => {
    window.location.href = `/archive/${encodeURIComponent(id)}`;
  };

  return (
    <main className="shell">
      <AppHeader subtitle="المفضلة" />

      <section className="content" aria-label="السجلات المفضلة">
        <div className="hero">
          <h1>المفضلة</h1>
          <p>
            جميع السجلات التي أضفتها إلى المفضلة على هذا الجهاز.
          </p>
          <div className="hero-actions">
            <span className="badge">المفضلات المحلية</span>
            {favorites.length > 0 && (
              <span className="badge">{favorites.length} عنصر</span>
            )}
          </div>
        </div>

        {favorites.length === 0 ? (
          <div className="empty-state">
            <strong>لا توجد عناصر مفضلة بعد</strong>
            <p className="helper-text">
              انقر على أيقونة النجمة في أي سجل لإضافته إلى المفضلة.
            </p>
          </div>
        ) : (
          <>
            <div className="toolbar-row">
              <span className="helper-text">{favorites.length} عنصر</span>
            </div>

            <div className="data-table scroll-x">
              <table role="grid" aria-label="قائمة العناصر المفضلة">
                <thead>
                  <tr>
                    <th>العنوان</th>
                    <th style={{ width: "8rem" }}>النوع</th>
                    <th style={{ width: "10rem" }}>تاريخ الإضافة</th>
                    <th style={{ width: "8rem" }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {favorites.map((fav) => (
                    <tr key={fav.id}>
                      <td className="wrap-anywhere">
                        <strong>{fav.title || fav.id}</strong>
                      </td>
                      <td className="text-sm">
                        {fav.type || "—"}
                      </td>
                      <td className="mono-text text-sm">
                        {new Date(fav.addedAt).toLocaleDateString("ar-SA")}
                      </td>
                      <td>
                        <div className="flex gap-2" style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleNavigate(fav.id)}
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                          >
                            فتح
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleRemove(fav.id)}
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
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
          </>
        )}
      </section>
    </main>
  );
}
