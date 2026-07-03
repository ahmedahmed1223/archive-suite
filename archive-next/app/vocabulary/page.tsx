"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { countBy, normalizeText } from "@/lib/record-utils";

interface VocabularyTerm {
  id: string;
  term: string;
  kind: "type" | "tag" | "custom";
  aliases: string;
  note: string;
  createdAt: string;
}

const STORAGE_KEY = "masar:vocabulary:v1";

function readTerms(): VocabularyTerm[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTerms(terms: VocabularyTerm[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
}

export default function VocabularyPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [error, setError] = useState("");
  const [terms, setTerms] = useState<VocabularyTerm[]>([]);
  const [term, setTerm] = useState("");
  const [kind, setKind] = useState<VocabularyTerm["kind"]>("custom");
  const [aliases, setAliases] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setTerms(readTerms());
    void (async () => {
      const response = await api.search({ limit: 1000 });
      if (response.ok) setRecords(response.records);
      else setError(response.error);
    })();
  }, [api]);

  const discovered = useMemo(() => {
    const typeRows = countBy(records.map((record) => record.type || "").filter(Boolean)).map(([value, count]) => ({ term: value, kind: "type" as const, count }));
    const tagRows = countBy(records.flatMap((record) => record.tags || [])).map(([value, count]) => ({ term: value, kind: "tag" as const, count }));
    return [...typeRows, ...tagRows].filter((item) => normalizeText(item.term).includes(normalizeText(filter))).slice(0, 80);
  }, [filter, records]);

  const savedTerms = useMemo(() => {
    const normalized = normalizeText(filter);
    return terms.filter((item) => !normalized || normalizeText([item.term, item.aliases, item.note].join(" ")).includes(normalized));
  }, [filter, terms]);

  function addTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!term.trim()) return;
    const next: VocabularyTerm = {
      id: crypto.randomUUID(),
      term: term.trim(),
      kind,
      aliases: aliases.trim(),
      note: note.trim(),
      createdAt: new Date().toISOString()
    };
    const nextTerms = [next, ...terms.filter((item) => normalizeText(item.term) !== normalizeText(next.term))].slice(0, 120);
    writeTerms(nextTerms);
    setTerms(nextTerms);
    setTerm("");
    setAliases("");
    setNote("");
    setKind("custom");
  }

  function adoptDiscovered(item: { term: string; kind: VocabularyTerm["kind"] }) {
    setTerm(item.term);
    setKind(item.kind);
  }

  function removeTerm(id: string) {
    const nextTerms = terms.filter((item) => item.id !== id);
    writeTerms(nextTerms);
    setTerms(nextTerms);
  }

  return (
    <AppShell subtitle="المفردات" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Taxonomy</span>}
        title="المفردات"
        description="قاموس تشغيل يربط الأنواع والوسوم والمرادفات. يستخدم بيانات الأرشيف الحالية ويحتفظ بالملاحظات محلياً حتى يتوفر مخزن Vocabulary دائم."
        meta={(
          <>
            <span className="badge">{savedTerms.length} مصطلح محفوظ</span>
            <span className="badge">{discovered.length} مصطلح مكتشف</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/tags">إدارة الوسوم</a>}
      >
        <form className="archive-toolbar-grid" onSubmit={addTerm}>
          <label>
            <span>المصطلح</span>
            <input className="search-input" value={term} onChange={(event) => setTerm(event.target.value)} />
          </label>
          <label>
            <span>النوع</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as VocabularyTerm["kind"])}>
              <option value="custom">مخصص</option>
              <option value="type">نوع محتوى</option>
              <option value="tag">وسم</option>
            </select>
          </label>
          <label>
            <span>مرادفات</span>
            <input className="search-input" value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="افصل بينها بفواصل" />
          </label>
          <label>
            <span>بحث داخل القاموس</span>
            <input className="search-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="مصطلح، وسم، مرادف..." />
          </label>
          <label className="full-span">
            <span>ملاحظة</span>
            <textarea className="search-input" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          <div className="archive-toolbar-actions">
            <button className="button button-primary" type="submit" disabled={!term.trim()}>حفظ المصطلح</button>
          </div>
        </form>
      </PageToolbar>

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر قراءة الأرشيف</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      <section className="split-layout">
        <article className="panel">
          <div className="panel-title-row">
            <div>
              <h2>المصطلحات المحفوظة</h2>
              <p>المرادفات والملاحظات التي يعتمدها الفريق في التوصيف والبحث.</p>
            </div>
            <span className="badge">{savedTerms.length}</span>
          </div>
          {savedTerms.length === 0 ? (
            <EmptyState title="لا توجد مصطلحات محفوظة." description="اختر مصطلحاً مكتشفاً أو أضف مصطلحاً يدوياً." />
          ) : (
            <div className="analytics-tag-list">
              {savedTerms.map((item) => (
                <div className="analytics-tag-row" key={item.id}>
                  <span>
                    <strong>{item.term}</strong>
                    {item.aliases ? <small className="helper-text"> · {item.aliases}</small> : null}
                    {item.note ? <small className="helper-text"> · {item.note}</small> : null}
                  </span>
                  <div className="button-row">
                    <span className="badge">{item.kind}</span>
                    <button type="button" className="button button-danger button-sm" onClick={() => removeTerm(item.id)}>حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-title-row">
            <div>
              <h2>مصطلحات مكتشفة</h2>
              <p>أنواع ووسوم تظهر في السجلات ويمكن اعتمادها في القاموس.</p>
            </div>
            <span className="badge">{discovered.length}</span>
          </div>
          <div className="analytics-tag-list">
            {discovered.map((item) => (
              <div className="analytics-tag-row" key={`${item.kind}-${item.term}`}>
                <span>{item.term}</span>
                <div className="button-row">
                  <strong>{item.count}</strong>
                  <span className="badge">{item.kind === "type" ? "نوع" : "وسم"}</span>
                  <button type="button" className="button button-secondary button-sm" onClick={() => adoptDiscovered(item)}>اعتماد</button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
