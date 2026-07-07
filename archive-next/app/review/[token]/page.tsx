import PageToolbar from "@/components/PageToolbar";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { ReviewLinkViewer } from "./ReviewLinkViewer";

export default async function ReviewLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="shell">
      <PublicHeader subtitle="رابط مراجعة عام" />

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
