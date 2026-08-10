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

  return (
    <main className="shell">
      <PublicHeader subtitle={t.pageTitles.publicReviewLink} />

      <section className="content public-content" aria-label="رابط المراجعة العامة">
        <PageToolbar
          eyebrow={<span className="badge">مراجعة عامة</span>}
          title="رابط مراجعة عام"
          description="يعرض بيانات المراجعة والتعليقات المسموحة لهذا الرابط فقط، مع إبقاء الرمز والصلاحيات محكومة من الخادم."
          meta={
            <>
              <span className="badge">تعليقات محمية</span>
              <span className="badge">صلاحية عامة محدودة</span>
            </>
          }
        />

        <aside className="panel auth-form">
          <div className="panel-section-header">
            <h2>محتوى المراجعة</h2>
            <p>اعرض التعليقات والملاحظات على هذا السجل في سياق آمن.</p>
          </div>
          <ReviewLinkViewer token={token} />
        </aside>
      </section>

      <PublicFooter />
    </main>
  );
}
