"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { clearAllMintedLinks, listMintedLinks, removeMintedLink, type MintedLink } from "@/lib/minted-shares";

export default function SharesPage() {
  const [links, setLinks] = useState<MintedLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setLinks(listMintedLinks());
  }, []);

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
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
    <AppShell subtitle="روابط المشاركة" navLabel="المشاركات" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">محلي على الجهاز</span>}
        title="روابط المشاركة"
        description="الروابط التي أنشأها المستخدم من هذا المتصفح، مع نسخ سريع ومتابعة تاريخ الإنشاء والانتهاء."
        meta={
          <>
            <span className="badge">المشاركات المحلية</span>
            <span className="badge">{links.length} رابط</span>
          </>
        }
        actions={
          <button
            type="button"
            className="button button-danger"
            onClick={handleClearAll}
            disabled={links.length === 0}
          >
            {cleared ? "تم المسح" : "مسح الكل"}
          </button>
        }
      />

      {links.length === 0 ? (
        <EmptyState
          title="لم تنشئ أي روابط مشاركة بعد"
          description="انتقل إلى صفحة الملفات وحدد عناصر لإنشاء رابط مشاركة."
          actions={<a className="button button-secondary" href="/files">فتح الملفات</a>}
        />
      ) : (
        <section className="panel" aria-label="روابط المشاركة المنشأة">
          <div className="panel-title-row">
            <div>
              <h2>قائمة الروابط</h2>
              <p>تدار هذه الروابط محليا لتسهيل الرجوع والنسخ دون مزامنة عبر الأجهزة.</p>
            </div>
            <span className="badge">{links.length} رابط</span>
          </div>

          <div className="scroll-x">
            <table className="data-table" role="grid" aria-label="قائمة روابط المشاركة">
              <thead>
                <tr>
                  <th>العنصر</th>
                  <th>الرابط</th>
                  <th>الإنشاء</th>
                  <th>الانتهاء</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.token}>
                    <td className="wrap-anywhere">
                      <strong>{link.itemLabel || "-"}</strong>
                    </td>
                    <td className="mono-text wrap-anywhere" dir="ltr">
                      {link.url}
                    </td>
                    <td className="mono-text">
                      {new Date(link.createdAt).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="mono-text">
                      {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString("ar-SA") : "-"}
                    </td>
                    <td>
                      <div className="button-row">
                        <button
                          type="button"
                          className="button button-secondary button-sm"
                          onClick={() => void handleCopyLink(link.url)}
                        >
                          {copied === link.url ? "تم النسخ" : "نسخ"}
                        </button>
                        <a
                          href={`/share/${encodeURIComponent(link.token)}`}
                          className="button button-secondary button-sm"
                        >
                          فتح
                        </a>
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          onClick={() => handleRemove(link.token)}
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
