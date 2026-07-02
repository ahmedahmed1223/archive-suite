"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { listMintedLinks, removeMintedLink, clearAllMintedLinks, type MintedLink } from "@/lib/minted-shares";

export default function SharesPage() {
  const [links, setLinks] = useState<MintedLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setLinks(listMintedLinks());
  }, []);

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Silent fail
    }
  };

  const handleRemove = (token: string) => {
    removeMintedLink(token);
    setLinks(listMintedLinks());
  };

  const handleClearAll = () => {
    clearAllMintedLinks();
    setLinks([]);
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <main className="shell">
      <AppHeader subtitle="روابط المشاركة" />

      <section className="content" aria-label="روابط المشاركة المُنشأة">
        <div className="hero">
          <h1>روابط المشاركة</h1>
          <p>
            جميع الروابط التي أنشأتها على هذا الجهاز. تُحفظ محلياً ولا تُزامن عبر الأجهزة.
          </p>
          <div className="hero-actions">
            <span className="badge">المشاركات المحلية</span>
            {links.length > 0 && (
              <span className="badge">{links.length} رابط</span>
            )}
          </div>
        </div>

        {links.length === 0 ? (
          <div className="empty-state">
            <strong>لم تُنشئ أي روابط مشاركة بعد</strong>
            <p className="helper-text">
              انتقل إلى صفحة الملفات وحدّد عناصر لإنشاء رابط مشاركة.
            </p>
          </div>
        ) : (
          <>
            <div className="toolbar-row">
              <span className="helper-text">{links.length} رابط</span>
              <button
                type="button"
                className="button button-secondary"
                onClick={handleClearAll}
              >
                {cleared ? "تم المسح" : "مسح الكل"}
              </button>
            </div>

            <div className="data-table scroll-x">
              <table role="grid" aria-label="قائمة روابط المشاركة">
                <thead>
                  <tr>
                    <th>العنصر</th>
                    <th style={{ width: "15rem" }}>الرابط</th>
                    <th style={{ width: "8rem" }}>الإنشاء</th>
                    <th style={{ width: "8rem" }}>الانتهاء</th>
                    <th style={{ width: "8rem" }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.token}>
                      <td className="wrap-anywhere">
                        <strong>{link.itemLabel || "—"}</strong>
                      </td>
                      <td className="mono-text text-sm">
                        <div dir="ltr" style={{ overflow: "auto", maxWidth: "15rem" }}>
                          {link.url}
                        </div>
                      </td>
                      <td className="mono-text text-sm">
                        {new Date(link.createdAt).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="mono-text text-sm">
                        {link.expiresAt
                          ? new Date(link.expiresAt).toLocaleDateString("ar-SA")
                          : "—"}
                      </td>
                      <td>
                        <div className="flex gap-2" style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleCopyLink(link.url)}
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                          >
                            {copied === link.url ? "✓ نسخ" : "نسخ"}
                          </button>
                          <a
                            href={`/share/${encodeURIComponent(link.token)}`}
                            className="button button-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                          >
                            فتح
                          </a>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleRemove(link.token)}
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
