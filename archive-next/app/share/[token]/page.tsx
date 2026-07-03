import PageToolbar from "@/components/PageToolbar";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { ShareViewer } from "./ShareViewer";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="shell">
      <PublicHeader subtitle="عارض المشاركة العامة" />

      <section className="content public-content" aria-label="عارض المشاركة">
        <PageToolbar
          eyebrow={<span className="badge">مشاركة عامة</span>}
          title="عارض المشاركة العامة"
          description="اعرض السجلات التي سُمح بمشاركتها عبر رابط عام دون كشف بيانات إضافية خارج صلاحية الرابط."
          meta={
            <>
              <span className="badge">محمي برمز</span>
              <span className="badge">صلاحية محددة</span>
            </>
          }
        />

        <aside className="panel auth-form">
          <div className="panel-section-header">
            <h2>رمز المشاركة</h2>
            <p>هذا الرابط والرمز أدناه محميان من الاستخدام غير المصرح.</p>
          </div>
          <p className="token-preview" dir="ltr">{token}</p>
          <ShareViewer token={token} />
        </aside>
      </section>

      <PublicFooter />
    </main>
  );
}
