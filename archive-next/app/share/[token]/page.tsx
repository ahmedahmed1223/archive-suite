import AppHeader from "@/components/AppHeader";
import { ShareViewer } from "./ShareViewer";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="shell">
      <AppHeader subtitle="عارض المشاركة العامة" />

      <section className="content auth-layout" aria-label="عارض المشاركة">
        <div className="hero auth-copy">
          <span className="badge">مشاركة عامة</span>
          <h1>عارض المشاركة العامة.</h1>
          <p>
            اعرض السجلات التي سُمح بمشاركتها عبر رابط عام دون كشف بيانات
            إضافية خارج صلاحية الرابط.
          </p>
          <div className="hero-actions">
            <span className="badge">آمن ومشفر</span>
            <span className="badge">محمي برمز</span>
          </div>
        </div>

        <aside className="panel auth-form">
          <div className="panel-section-header">
            <h2>رمز المشاركة</h2>
            <p>هذا الرابط والرمز أدناه محميان من الاستخدام غير المصرح.</p>
          </div>
          <p className="token-preview" dir="ltr">{token}</p>
          <ShareViewer token={token} />
        </aside>
      </section>
    </main>
  );
}
