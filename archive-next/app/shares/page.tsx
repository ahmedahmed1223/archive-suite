"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { clearAllMintedLinks, listMintedLinks, removeMintedLink, type MintedLink } from "@/lib/minted-shares";
import { buildShareExpiry } from "@/lib/admin-action-summary";

function formatLocalDate(value: string | undefined, locale: "ar" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale === "en" ? "en-US" : "ar-SA");
}

type ExpiryStatus = "noExpiry" | "invalidDate" | "expired" | "expiresSoon" | "active";

function getExpiryStatus(expiresAt: string | undefined, tone: string): ExpiryStatus {
  if (!expiresAt) return "noExpiry";
  if (Number.isNaN(new Date(expiresAt).getTime())) return "invalidDate";
  if (tone === "danger") return "expired";
  if (tone === "warning") return "expiresSoon";
  return "active";
}

export default function SharesPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.shares;
  const dialogs = useConfirmDialog();
  const [links, setLinks] = useState<MintedLink[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const getExpiry = (expiresAt?: string) => {
    const expiry = buildShareExpiry(expiresAt);
    const status = copy.expiry[getExpiryStatus(expiresAt, expiry.tone)];
    return { ...expiry, label: status.label, detail: status.detail };
  };

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
      title: copy.dialogs.remove.title,
      message: copy.dialogs.remove.message,
      confirmLabel: copy.dialogs.remove.confirm,
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
        title: copy.dialogs.clear.title,
        message: copy.dialogs.clear.message,
        confirmLabel: copy.dialogs.clear.confirm,
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
    <AppShell subtitle={t.pageTitles.shareLinks} navLabel={t.pageTitles.shares} contentClassName="local-list-content" tipsPage="shares">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={
          <>
            <span className="badge">{copy.toolbar.localShares}</span>
            <span className="badge">{copy.toolbar.linkCount.replace("{count}", String(links.length))}</span>
          </>
        }
        actions={
          <div className="button-row">
            <a className="button button-secondary" href="/shares/with-me">{copy.toolbar.incomingShares}</a>
            <button
              type="button"
              className="button button-danger"
              onClick={handleClearAll}
              disabled={links.length === 0}
            >
              {cleared ? copy.toolbar.cleared : copy.toolbar.clearAll}
            </button>
          </div>
        }
      />

      {links.length === 0 ? (
        <EmptyState
          title={copy.empty.title}
          description={copy.empty.description}
          actions={<a className="button button-secondary" href="/files">{copy.empty.openFiles}</a>}
        />
      ) : (
        <section className="panel" aria-label={copy.list.ariaLabel}>
          <div className="panel-title-row">
            <div>
              <h2>{copy.list.title}</h2>
              <p>{copy.list.description}</p>
            </div>
            <span className="badge">{copy.toolbar.linkCount.replace("{count}", String(links.length))}</span>
          </div>

          <div className="mobile-card-list" role="list" aria-label={copy.list.cardsAriaLabel}>
            {links.map((link) => {
              const expiry = getExpiry(link.expiresAt);
              return (
                <article className="local-list-card" key={link.token} role="listitem">
                  <div className="local-list-card__main">
                    <div>
                      <span className="badge">{copy.list.share}</span>
                      <h3>{link.itemLabel || copy.list.fallbackLink}</h3>
                    </div>
                    <span className={`badge badge-${expiry.tone}`}>{expiry.label} {copy.expiry.estimate}</span>
                  </div>
                  <p className="mono-text wrap-anywhere" dir="ltr">{link.url}</p>
                  <dl className="mobile-field-list">
                    <div>
                      <dt>{copy.list.createdAt}</dt>
                      <dd>{formatLocalDate(link.createdAt, locale)}</dd>
                    </div>
                    <div>
                      <dt>{copy.list.expiresAt}</dt>
                      <dd>{copy.list.expiryDescription.replace("{date}", formatLocalDate(link.expiresAt, locale)).replace("{detail}", expiry.detail)}</dd>
                    </div>
                  </dl>
                  <div className="button-row">
                    <button
                      type="button"
                      className="button button-secondary button-sm"
                      onClick={() => void handleCopyLink(link.url)}
                    >
                      {copied === link.url ? copy.list.copied : copy.list.copy}
                    </button>
                    <a
                      href={`/share/${encodeURIComponent(link.token)}`}
                      className="button button-secondary button-sm"
                    >
                      {copy.list.open}
                    </a>
                    <button
                      type="button"
                      className="button button-danger button-sm"
                      onClick={() => handleRemove(link.token)}
                    >
                      {copy.list.remove}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="scroll-x desktop-table-wrap">
            <table className="data-table" role="grid" aria-label={copy.table.ariaLabel}>
              <thead>
                <tr>
                  <th>{copy.table.item}</th>
                  <th>{copy.table.link}</th>
                  <th>{copy.table.createdAt}</th>
                  <th>{copy.table.expiresAt}</th>
                  <th className="data-table-sticky-end">{copy.table.actions}</th>
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
                      {formatLocalDate(link.createdAt, locale)}
                    </td>
                    <td className="mono-text">
                      {formatLocalDate(link.expiresAt, locale)}
                    </td>
                    <td className="data-table-sticky-end">
                      <div className="button-row">
                        <button
                          type="button"
                          className="button button-secondary button-sm"
                          onClick={() => void handleCopyLink(link.url)}
                        >
                          {copied === link.url ? copy.list.copied : copy.list.copy}
                        </button>
                        <a
                          href={`/share/${encodeURIComponent(link.token)}`}
                          className="button button-secondary button-sm"
                        >
                          {copy.list.open}
                        </a>
                        <button
                          type="button"
                          className="button button-danger button-sm"
                          onClick={() => handleRemove(link.token)}
                        >
                          {copy.list.remove}
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
