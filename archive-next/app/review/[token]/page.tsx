import AppHeader from "@/components/AppHeader";
import { ReviewLinkViewer } from "./ReviewLinkViewer";

export default async function ReviewLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="shell">
      <AppHeader subtitle="رابط مراجعة عام" />

      <section className="content auth-layout" aria-label="رابط المراجعة العامة">
        <div className="hero auth-copy">
          <span className="badge">مراجعة عامة</span>
          <h1>رابط مراجعة عام.</h1>
          <p>
            يعرض بيانات المراجعة والتعليقات المسموحة لهذا الرابط فقط، مع
            إبقاء الرمز والصلاحيات محكومة من Laravel.
          </p>
        </div>

        <aside className="panel auth-form">
          <h2>محتوى المراجعة</h2>
          <ReviewLinkViewer token={token} />
        </aside>
      </section>
    </main>
  );
}
