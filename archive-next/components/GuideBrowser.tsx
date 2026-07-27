"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "@/lib/auth-session";
import { filterGuideChapters, type GuideChapter, type GuideRole } from "@/lib/in-app-guide";

function markdownToSections(body: string) {
  return body.split("\n").filter((line) => line.trim()).map((line, index) => {
    if (line.startsWith("## ")) return <h3 key={index}>{line.slice(3)}</h3>;
    return <p key={index}>{line.replace(/^# /, "")}</p>;
  });
}

export default function GuideBrowser({ chapters }: Readonly<{ chapters: GuideChapter[] }>) {
  const auth = useAuthSession();
  const searchParams = useSearchParams();
  const role = (auth.user?.role ?? "viewer") as GuideRole;
  const [query, setQuery] = useState("");
  const requestedChapter = searchParams.get("chapter");
  const visible = useMemo(() => filterGuideChapters(chapters, role, query), [chapters, role, query]);
  const selected = visible.find((chapter) => chapter.id === requestedChapter) ?? visible[0];

  return (
    <section className="panel" aria-label="دليل الاستخدام">
      <div className="panel-section-header">
        <h2>دليل {role === "admin" ? "المدير" : role === "editor" ? "المحرر" : "المستعرض"}</h2>
        <p>يظهر لك المحتوى الملائم لدورك فقط. تُحفظ الفصول في ملفات Markdown داخل المشروع.</p>
      </div>
      <label className="field-label" htmlFor="guide-search">ابحث في الدليل</label>
      <input id="guide-search" className="text-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: رفع، بحث، صلاحيات" />
      <div className="dense-grid" style={{ marginTop: "1rem" }}>
        <nav aria-label="فصول الدليل">
          <ul className="stack-list">
            {visible.map((chapter) => (
              <li key={chapter.id}>
                <a
                  className="text-accent"
                  href={`/help?chapter=${encodeURIComponent(chapter.id)}`}
                  aria-current={chapter.id === selected?.id ? "page" : undefined}
                >
                  {chapter.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <article aria-live="polite">
          {selected ? <><h2>{selected.title}</h2>{markdownToSections(selected.body)}<a className="button button-secondary" href={selected.href}>افتح الصفحة المرتبطة</a></> : <p>لا توجد نتيجة مطابقة في الدليل المتاح لدورك.</p>}
        </article>
      </div>
    </section>
  );
}
