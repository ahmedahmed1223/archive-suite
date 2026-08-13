import { headers } from "next/headers";
import PageToolbar from "@/components/PageToolbar";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isAppLocale } from "@/lib/i18n/types";
import { ShareViewer } from "./ShareViewer";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const requestHeaders = await headers();
  const forwardedLocale = requestHeaders.get("x-archive-locale");
  const locale = isAppLocale(forwardedLocale) ? forwardedLocale : "ar";
  const t = getDictionary(locale);
  const copy = t.pages.shareToken;

  return (
    <main className="shell">
      <PublicHeader subtitle={t.pageTitles.publicShareViewer} />

      <section className="content public-content" aria-label={copy.contentAriaLabel}>
        <PageToolbar
          eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
          title={copy.toolbar.title}
          description={copy.toolbar.description}
          meta={
            <>
              <span className="badge">{copy.toolbar.protectedByToken}</span>
              <span className="badge">{copy.toolbar.limitedPermission}</span>
            </>
          }
        />

        <aside className="panel auth-form">
          <div className="panel-section-header">
            <h2>{copy.token.title}</h2>
            <p>{copy.token.description}</p>
          </div>
          <p className="token-preview" dir="ltr">{token}</p>
          <ShareViewer token={token} />
        </aside>
      </section>

      <PublicFooter />
    </main>
  );
}
