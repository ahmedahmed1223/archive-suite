"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { clearAllMintedLinks, listMintedLinks, removeMintedLink, type MintedLink } from "@/lib/minted-shares";
import { buildShareExpiry } from "@/lib/admin-action-summary";

function formatLocalDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar-SA");
}

export default function SharesPage() {
  const dialogs = useConfirmDialog();
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

  const handleRemove = async (token: string) => {
    const confirmed = await dialogs.confirm({
      title: "حذف الرابط",
      message: "حذف هذا الرابط من سجل هذا المتصفح فقط؟ لن يؤدي ذلك إلى إبطال الرابط على الخادم.",
      confirmLabel: "حذف",
      destructive: true
    });
    if (!confirmed) return;
    removeMintedLink(token);
    setLinks(listMintedLinks());
  };

  const handleClearAll = async () => {
    if (
      links.length > 0 &&
      !(await dialogs.confirm({
        title: "مسح السجل المحلي",
        message: "مسح سجل الروابط المحلية فقط؟ لن يؤدي ذلك إلى إبطال روابط المشاركة.",
        confirmLabel: "مسح",
        destructive: true
      }))
    )
      return;
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
          <div className="button-row">
            <a className="button button-secondary" href="/shares/with-me">المشاركات الواردة</a>
            <button
              type="button"
              className="button button-danger"
              onClick={handleClearAll}
              disabled={links.length === 0}
            >
              {cleared ? "تم المسح" : "مسح الكل"}
            </button>
          </div>
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

          <div className="mobile-card-list" role="list" aria-label="بطاقات روابط المشاركة">
            {links.map((link) => (
              <article className="local-list-card" key={link.token} role="listitem">
                <div className="local-list-card__main">
                  <div>
                    <span className="badge">مشاركة</span>
                    <h3>{link.itemLabel || "رابط مشاركة"}</h3>
                  </div>
                  <span className={`badge badge-${buildShareExpiry(link.expiresAt).tone}`}>{buildShareExpiry(link.expiresAt).label} (تقدير)</span>
                </div>
                <p className="mono-text wrap-anywhere" dir="ltr">{link.url}</p>
                <dl className="mobile-field-list">
                  <div>
                    <dt>الإنشاء</dt>
                    <dd>{formatLocalDate(link.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>الانتهاء</dt>
                    <dd>{formatLocalDate(link.expiresAt)} — {buildShareExpiry(link.expiresAt).detail} تقدير محلي حسب التاريخ المعلن؛ الإنفاذ بالخادم.</dd>
                  </div>
                </dl>
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
              </article>
            ))}
          </div>

          <div className="scroll-x desktop-table-wrap">
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
                      {formatLocalDate(link.createdAt)}
                    </td>
                    <td className="mono-text">
                      {formatLocalDate(link.expiresAt)}
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
