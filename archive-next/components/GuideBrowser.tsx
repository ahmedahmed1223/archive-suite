"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthSession } from "@/lib/auth-session";
import { filterGuideChapters, type GuideChapter, type GuideRole } from "@/lib/in-app-guide";

function markdownToSections(body: string) {
  const sections: React.ReactNode[] = [];
  let lines: string[] = [];
  let heading = "";

  function flushLines() {
    if (!lines.length) return;

    const ordered = lines.every((line) => /^\d+\.\s+/.test(line));
    const unordered = lines.every((line) => /^[-*]\s+/.test(line));
    if (ordered || unordered) {
      const List = ordered ? "ol" : "ul";
      const marker = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      sections.push(
        <List key={sections.length} aria-label={heading || undefined}>
          {lines.map((line) => <li key={line}>{line.replace(marker, "")}</li>)}
        </List>,
      );
    } else {
      lines.forEach((line) => sections.push(<p key={sections.length}>{line.replace(/^# /, "")}</p>));
    }
    lines = [];
  }

  body.split("\n").forEach((line) => {
    if (!line.trim()) {
      flushLines();
    } else if (line.startsWith("## ")) {
      flushLines();
      heading = line.slice(3);
      sections.push(<h3 key={sections.length}>{heading}</h3>);
    } else {
      lines.push(line);
    }
  });
  flushLines();
  return sections;
}

export default function GuideBrowser({ chapters: initialChapters = [] }: Readonly<{ chapters?: GuideChapter[] }>) {
  const auth = useAuthSession();
  const searchParams = useSearchParams();
  const role = (auth.user?.role ?? "viewer") as GuideRole;
  const [chapters, setChapters] = useState(initialChapters);
  const [query, setQuery] = useState("");
  const requestedChapter = searchParams.get("chapter");
  const visible = useMemo(() => filterGuideChapters(chapters, role, query), [chapters, role, query]);
  const selected = visible.find((chapter) => chapter.id === requestedChapter) ?? visible[0];

  useEffect(() => {
    if (auth.status !== "authenticated" || !auth.accessToken) return;

    let cancelled = false;
    fetch("/api/guide", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload: { ok?: boolean; chapters?: GuideChapter[] } | null) => {
        if (!cancelled && payload?.ok === true && Array.isArray(payload.chapters)) {
          setChapters(payload.chapters);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [auth.accessToken, auth.status]);

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
