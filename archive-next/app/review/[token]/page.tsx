import AppHeader from "@/components/AppHeader";
import { ReviewLinkViewer } from "./ReviewLinkViewer";

export default async function ReviewLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="shell">
      <AppHeader subtitle="رابط مراجعة عام" />

      <section className="content auth-layout" aria-label="رابط المراجعة العامة">
        <div className="hero auth-copy">
          <span className="badge">Next.js review route</span>
          <h1>رابط مراجعة عام.</h1>
          <p>
            هذا المسار يقرأ الرابط العام من Laravel ويعرض media UID والبيانات
            المسموحة بدون كشف الرمز نفسه.
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
