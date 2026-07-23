"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type ArchiveRecord, type VocabularyTerm } from "@/lib/archive-api";
import { buildChangeImpact, countAffectedRecords } from "@/lib/change-impact";
import { countBy, normalizeText } from "@/lib/record-utils";
import { selectMissingVocabularyTags } from "@/lib/default-taxonomy";
import { canRedo, canUndo, emptyUndoStack, pushUndo, redo, undo, type UndoStack } from "@/lib/undo-stack";
import { Skeleton } from "@/components/ui/Skeleton";

type Kind = VocabularyTerm["kind"];
type VocabularyLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

// V1-732D: enough to recreate a deleted term - the recreated row gets a new
// id, so redo looks the term back up by name rather than reusing an id.
interface TermDeletion {
  term: string;
  kind: Kind;
  aliases: string;
  note: string;
}

export default function VocabularyPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const canManageVocabulary = useCapability("vocabulary.manage");
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [loadState, setLoadState] = useState<VocabularyLoadState>({ status: "loading" });
  const [error, setError] = useState("");
  const [terms, setTerms] = useState<VocabularyTerm[]>([]);
  const [term, setTerm] = useState("");
  const [kind, setKind] = useState<Kind>("custom");
  const [aliases, setAliases] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [deleteStack, setDeleteStack] = useState<UndoStack<TermDeletion>>(emptyUndoStack);

  async function importDefaultTags() {
    if (isImporting) return;
    setIsImporting(true);
    setImportMessage("");
    const missing = selectMissingVocabularyTags(terms.map((item) => item.term));
    if (missing.length === 0) {
      setImportMessage("كل الوسوم الافتراضية موجودة بالفعل — لم يتغير شيء.");
      setIsImporting(false);
      return;
    }
    let imported = 0;
    for (const tag of missing) {
      const response = await api.createVocabularyTerm({ term: tag, kind: "tag" });
      if (!response.ok) {
        setImportMessage(`استُورد ${imported} من ${missing.length}؛ توقف عند «${tag}»: ${response.error}`);
        setIsImporting(false);
        await refreshTerms();
        return;
      }
      imported += 1;
    }
    setImportMessage(`استُورد ${imported} وسمًا افتراضيًا دون المساس بالمفردات الموجودة.`);
    setIsImporting(false);
    await refreshTerms();
  }

  async function refreshTerms() {
    const response = await api.vocabularyTerms();
    if (response.ok) setTerms(response.terms);
    else setError(response.error || "تعذر تحميل المفردات.");
  }

  async function loadVocabulary() {
    setLoadState({ status: "loading" });
    setError("");
    const [termsResponse, recordsResponse] = await Promise.all([api.vocabularyTerms(), api.search({ limit: 1000 })]);
    if (!termsResponse.ok || !recordsResponse.ok) {
      const message = !termsResponse.ok
        ? termsResponse.error || "تعذر تحميل المفردات."
        : !recordsResponse.ok
          ? recordsResponse.error || "تعذر تحميل السجلات."
          : "تعذر تحميل بيانات المفردات.";
      setLoadState({
        status: "error",
        message
      });
      return;
    }
    setTerms(termsResponse.terms);
    setRecords(recordsResponse.records);
    setLoadState({ status: "ready" });
  }

  useEffect(() => {
    void loadVocabulary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function addTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = term.trim();
    if (!trimmed) return;
    // De-dupe by term client-side: drop any existing entry with the same normalized term.
    const duplicate = terms.find((item) => normalizeText(item.term) === normalizeText(trimmed));
    if (duplicate) await api.deleteVocabularyTerm(duplicate.id);
    const response = await api.createVocabularyTerm({ term: trimmed, kind, aliases: aliases.trim(), note: note.trim() });
    if (!response.ok) {
      setError(response.error || "تعذر حفظ المصطلح.");
      return;
    }
    await refreshTerms();
    setTerm("");
    setAliases("");
    setNote("");
    setKind("custom");
  }

  function adoptDiscovered(item: { term: string; kind: Kind }) {
    setTerm(item.term);
    setKind(item.kind);
  }

  async function removeTerm(id: string) {
    const target = terms.find((item) => item.id === id);
    const response = await api.deleteVocabularyTerm(id);
    if (!response.ok) {
      setError(response.error || "تعذر حذف المصطلح.");
      await refreshTerms();
      return;
    }
    if (target) {
      setDeleteStack((stack) =>
        pushUndo(stack, { term: target.term, kind: target.kind, aliases: target.aliases || "", note: target.note || "" })
      );
    }
    await refreshTerms();
  }

  async function handleUndoRemove() {
    const result = undo(deleteStack);
    if (!result) return;
    const response = await api.createVocabularyTerm({
      term: result.entry.term,
      kind: result.entry.kind,
      aliases: result.entry.aliases,
      note: result.entry.note
    });
    if (!response.ok) {
      setError(response.error || "تعذر التراجع عن الحذف.");
      return;
    }
    setDeleteStack(result.stack);
    await refreshTerms();
  }

  async function handleRedoRemove() {
    const result = redo(deleteStack);
    if (!result) return;
    const current = terms.find((item) => normalizeText(item.term) === normalizeText(result.entry.term));
    if (!current) {
      setError(`تعذرت إعادة الحذف: المصطلح "${result.entry.term}" غير موجود حالياً.`);
      return;
    }
    const response = await api.deleteVocabularyTerm(current.id);
    if (!response.ok) {
      setError(response.error || "تعذرت إعادة الحذف.");
      return;
    }
    setDeleteStack(result.stack);
    await refreshTerms();
  }

  return (
    <AppShell subtitle="المفردات" contentClassName="local-list-content" tipsPage="vocabulary">
      <PageToolbar
        eyebrow={<span className="badge">Taxonomy</span>}
        title="المفردات"
        description="قاموس تشغيل يربط الأنواع والوسوم والمرادفات. يستخدم بيانات الأرشيف الحالية ويحفظ المصطلحات في الخادم لكل مستخدم."
        meta={(
          <>
            <span className="badge">{savedTerms.length} مصطلح محفوظ</span>
            <span className="badge">{discovered.length} مصطلح مكتشف</span>
          </>
        )}
        actions={(
          <>
            {canManageVocabulary && (
              <button type="button" className="button button-secondary" disabled={isImporting} onClick={() => void importDefaultTags()}>استيراد الوسوم الافتراضية</button>
            )}
            <a className="button button-secondary" href="/tags">إدارة الوسوم</a>
          </>
        )}
      >
        {canManageVocabulary ? (
          <form className="archive-toolbar-grid" onSubmit={addTerm}>
            <label>
              <span>المصطلح</span>
              <input className="search-input" value={term} onChange={(event) => setTerm(event.target.value)} />
            </label>
            <label>
              <span>النوع</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
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
        ) : (
          <div className="archive-toolbar-grid">
            <label>
              <span>بحث داخل القاموس</span>
              <input className="search-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="مصطلح، وسم، مرادف..." />
            </label>
          </div>
        )}
      </PageToolbar>

      {loadState.status === "loading" ? (
        <div className="panel panel-compact"><Skeleton label="جار تحميل المفردات والسجلات..." /></div>
      ) : null}

      {loadState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر قراءة الأرشيف</strong>
          <span className="helper-text">{loadState.message}</span>
          <div><button className="button button-secondary button-sm" type="button" onClick={() => void loadVocabulary()}>إعادة المحاولة</button></div>
        </div>
      ) : null}

      {error && loadState.status === "ready" ? (
        <div className="state-banner state-banner-error" role="alert"><strong>تعذر حفظ تغيير المفردات</strong><span className="helper-text">{error}</span></div>
      ) : null}

      {importMessage ? <p className="helper-text" role="status">{importMessage}</p> : null}

      {canManageVocabulary && (canUndo(deleteStack) || canRedo(deleteStack)) ? (
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(deleteStack)}
            onClick={() => void handleUndoRemove()}
          >
            تراجع عن الحذف{deleteStack.past.length > 0 ? ` (${deleteStack.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(deleteStack)}
            onClick={() => void handleRedoRemove()}
          >
            إعادة الحذف{deleteStack.future.length > 0 ? ` (${deleteStack.future.length})` : ""}
          </button>
        </div>
      ) : null}

      {loadState.status === "ready" ? <section className="split-layout">
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
                    {canManageVocabulary && (
                      <button type="button" className="button button-danger button-sm" onClick={() => void removeTerm(item.id)}>حذف</button>
                    )}
                  </div>
                  <span className="helper-text">معاينة: {countAffectedRecords(records, (record) => record.type === item.term || (record.tags || []).includes(item.term))} سجل يستخدم هذا المصطلح؛ حذفه من القاموس لا يعدّل السجلات.</span>
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
          <ChangeImpactPreview impact={buildChangeImpact({ action: "update", entity: "القاموس", affectedCount: 0 })} />
        </article>
      </section> : null}
    </AppShell>
  );
}
