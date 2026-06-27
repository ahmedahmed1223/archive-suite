import { ShareViewer } from "./ShareViewer";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Archive Suite</strong>
          <span>Public share viewer</span>
        </div>
        <a className="badge" href="/">حالة الترحيل</a>
      </header>

      <section className="content auth-layout" aria-label="عارض المشاركة">
        <div className="hero auth-copy">
          <span className="badge">Next.js share route</span>
          <h1>عارض المشاركة العامة.</h1>
          <p>
            هذا المسار ينقل أول تجربة عامة منخفضة المخاطر إلى Next.js ويقرأ
            payload المشاركة من Laravel عبر عقد `/api/v1/share/:token`.
          </p>
        </div>

        <aside className="panel auth-form">
          <h2>رمز المشاركة</h2>
          <p className="token-preview">{token}</p>
          <ShareViewer token={token} />
        </aside>
      </section>
    </main>
  );
}
