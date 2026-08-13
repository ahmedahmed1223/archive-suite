import { headers } from "next/headers";
import PageToolbar from "@/components/PageToolbar";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isAppLocale } from "@/lib/i18n/types";
import { ReviewLinkViewer } from "./ReviewLinkViewer";

export default async function ReviewLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const requestHeaders = await headers();
  const forwardedLocale = requestHeaders.get("x-archive-locale");
  const locale = isAppLocale(forwardedLocale) ? forwardedLocale : "ar";
  const t = getDictionary(locale);
  const copy = t.pages.reviewLink;

  return (
    <main className="shell">
      <PublicHeader subtitle={t.pageTitles.publicReviewLink} />

      <section className="content public-content" aria-label={copy.sectionAriaLabel}>
        <PageToolbar
          eyebrow={<span className="badge">{copy.eyebrow}</span>}
          title={copy.title}
          description={copy.description}
          meta={
            <>
              <span className="badge">{copy.protectedCommentsBadge}</span>
              <span className="badge">{copy.limitedPublicAccessBadge}</span>
            </>
          }
        />

        <aside className="panel auth-form">
          <div className="panel-section-header">
            <h2>{copy.contentTitle}</h2>
            <p>{copy.contentDescription}</p>
          </div>
          <ReviewLinkViewer token={token} />
        </aside>
      </section>

      <PublicFooter />
    </main>
  );
}
