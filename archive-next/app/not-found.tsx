import Link from "next/link";

export default function NotFound() {
  return (
    <main className="content">
      <section className="panel">
        <span className="badge">404</span>
        <h1>الصفحة غير موجودة.</h1>
        <p>الرابط الذي فتحته غير صحيح أو أُزيلت صفحته.</p>
        <div className="button-row">
          <Link className="button button-primary" href="/">
            العودة إلى الرئيسية
          </Link>
          <Link className="button" href="/archive">
            فتح الأرشيف
          </Link>
        </div>
      </section>
    </main>
  );
}
