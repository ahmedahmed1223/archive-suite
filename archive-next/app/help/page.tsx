"use client";

import AppShell from "@/components/AppShell";
import GuideBrowser from "@/components/GuideBrowser";
import PageToolbar from "@/components/PageToolbar";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function HelpPage() {
  const { t } = useLocale();
  const copy = t.help.center;

  return (
    <AppShell
      subtitle={copy.shellSubtitle}
      navLabel={copy.navLabel}
      contentClassName="help-content"
      tipsPage="help"
    >
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={
          <>
            <span className="badge">{copy.chapterCount}</span>
            <span className="badge">{copy.roleAware}</span>
          </>
        }
        actions={(
          <a className="button button-primary" href="/help?chapter=getting-started">
            {copy.openGettingStarted}
          </a>
        )}
      />

      <article className="state-banner state-banner-info" aria-label={copy.bannerAria}>
        <strong>{copy.bannerTitle}</strong>
        <p>{copy.bannerBody}</p>
      </article>

      <GuideBrowser />
    </AppShell>
  );
}
