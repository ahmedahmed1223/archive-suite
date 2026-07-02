import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { ReviewLinkViewer } from "./ReviewLinkViewer";

export default async function ReviewLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="shell">
      <PublicHeader subtitle="رابط مراجعة عام" />

      <section className="content auth-layout" aria-label="رابط المراجعة العامة">
        <div className="hero auth-copy">
          <span className="badge">مراجعة عامة</span>
          <h1>رابط مراجعة عام.</h1>
          <p>
            يعرض بيانات المراجعة والتعليقات المسموحة لهذا الرابط فقط، مع
            إبقاء الرمز والصلاحيات محكومة من Laravel.
          </p>
          <div className="hero-actions">
            <span className="badge">آمن ومشفر</span>
            <span className="badge">تعليقات محمية</span>
          </div>
        </div>

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
