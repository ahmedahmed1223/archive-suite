"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type ArchiveRecord, type VocabularyKindDefinition, type VocabularyTerm } from "@/lib/archive-api";
import { buildChangeImpact, countAffectedRecords } from "@/lib/change-impact";
import { countBy, normalizeText } from "@/lib/record-utils";
import { getDefaultVocabularyTags, selectMissingVocabularyTags } from "@/lib/default-taxonomy";
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
  canonicalTermId: string | null;
  note: string;
}

export default function VocabularyPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.vocabulary;
  const api = useMemo(() => createArchiveApiClient(), []);
  const canManageVocabulary = useCapability("vocabulary.manage");
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [loadState, setLoadState] = useState<VocabularyLoadState>({ status: "loading" });
  const [error, setError] = useState("");
  const [terms, setTerms] = useState<VocabularyTerm[]>([]);
  const [kindDefinitions, setKindDefinitions] = useState<VocabularyKindDefinition[]>([]);
  const [term, setTerm] = useState("");
  const [kind, setKind] = useState<Kind>("custom");
  const [aliases, setAliases] = useState("");
  const [canonicalTermId, setCanonicalTermId] = useState("");
  const [note, setNote] = useState("");
  const [kindKey, setKindKey] = useState("");
  const [kindLabel, setKindLabel] = useState("");
  const [kindDescription, setKindDescription] = useState("");
  const [filter, setFilter] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [preferredTermIds, setPreferredTermIds] = useState<string[]>([]);
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [deleteStack, setDeleteStack] = useState<UndoStack<TermDeletion>>(emptyUndoStack);

  async function importDefaultTags() {
    if (isImporting) return;
    setIsImporting(true);
    setImportMessage("");
    const missing = selectMissingVocabularyTags(terms.map((item) => item.term), getDefaultVocabularyTags(locale));
    if (missing.length === 0) {
      setImportMessage(copy.defaultTagsPresent);
      setIsImporting(false);
      return;
    }
    let imported = 0;
    for (const tag of missing) {
      const response = await api.createVocabularyTerm({ term: tag, kind: "tag" });
      if (!response.ok) {
        setImportMessage(copy.importStopped.replace("{imported}", String(imported)).replace("{total}", String(missing.length)).replace("{tag}", tag).replace("{error}", response.error));
        setIsImporting(false);
        await refreshTerms();
        return;
      }
      imported += 1;
    }
    setImportMessage(copy.imported.replace("{count}", String(imported)));
    setIsImporting(false);
    await refreshTerms();
  }

  async function refreshTerms() {
    const response = await api.vocabularyTerms(departmentId.trim() || undefined);
    if (response.ok) {
      setTerms(response.terms);
      setPreferredTermIds(response.preferredTermIds);
    }
    else setError(response.error || copy.loadTermsFailed);
  }

  async function loadVocabulary() {
    setLoadState({ status: "loading" });
    setError("");
    const [termsResponse, kindsResponse, recordsResponse] = await Promise.all([api.vocabularyTerms(), api.vocabularyKinds(), api.search({ limit: 1000 })]);
    if (!termsResponse.ok || !kindsResponse.ok || !recordsResponse.ok) {
      const message = !termsResponse.ok
        ? termsResponse.error || copy.loadTermsFailed
        : !kindsResponse.ok
          ? kindsResponse.error || copy.loadKindsFailed
        : !recordsResponse.ok
          ? recordsResponse.error || copy.loadRecordsFailed : copy.loadDataFailed;
      setLoadState({
        status: "error",
        message
      });
      return;
    }
    setTerms(termsResponse.terms);
    setKindDefinitions(kindsResponse.kinds);
    setPreferredTermIds(termsResponse.preferredTermIds);
    setRecords(recordsResponse.records);
    setLoadState({ status: "ready" });
  }

  async function loadDepartmentPreferences() {
    const currentDepartmentId = departmentId.trim();
    if (!currentDepartmentId) {
      setError(copy.departmentIdRequired);
      return;
    }
    setError("");
    setPreferenceMessage("");
    const response = await api.vocabularyTerms(currentDepartmentId);
    if (!response.ok) {
      setError(response.error || copy.loadPreferencesFailed);
      return;
    }
    setTerms(response.terms);
    setPreferredTermIds(response.preferredTermIds);
    setPreferenceMessage(copy.preferencesLoaded.replace("{id}", currentDepartmentId));
  }

  function toggleDepartmentPreference(termId: string) {
    setPreferredTermIds((current) => current.includes(termId) ? current.filter((id) => id !== termId) : [...current, termId]);
  }

  async function saveDepartmentPreferences() {
    const currentDepartmentId = departmentId.trim();
    if (!currentDepartmentId || isSavingPreferences) return;
    setIsSavingPreferences(true);
    setError("");
    setPreferenceMessage("");
    const response = await api.replaceDepartmentVocabularyPreferences(currentDepartmentId, preferredTermIds);
    setIsSavingPreferences(false);
    if (!response.ok) {
      setError(response.error || copy.savePreferencesFailed);
      return;
    }
    setTerms(response.terms);
    setPreferredTermIds(response.preferredTermIds);
    setPreferenceMessage(copy.preferencesSaved.replace("{count}", String(response.preferredTermIds.length)).replace("{id}", currentDepartmentId));
  }

  useEffect(() => {
    void loadVocabulary();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadVocabulary is redefined every render; api is the only stable dependency and is already listed
  }, [api]);

  const discovered = useMemo(() => {
    const typeRows = countBy(records.map((record) => record.type || "").filter(Boolean), locale).map(([value, count]) => ({ term: value, kind: "type" as const, count }));
    const tagRows = countBy(records.flatMap((record) => record.tags || []), locale).map(([value, count]) => ({ term: value, kind: "tag" as const, count }));
    return [...typeRows, ...tagRows].filter((item) => normalizeText(item.term).includes(normalizeText(filter))).slice(0, 80);
  }, [filter, locale, records]);

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
    const response = await api.createVocabularyTerm({ term: trimmed, kind, aliases: aliases.trim(), note: note.trim(), canonicalTermId: canonicalTermId || null });
    if (!response.ok) {
      setError(response.error || copy.saveTermFailed);
      return;
    }
    await refreshTerms();
    setTerm("");
    setAliases("");
    setCanonicalTermId("");
    setNote("");
    setKind("custom");
  }

  async function addDictionaryCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = kindKey.trim().toLowerCase();
    const label = kindLabel.trim();
    if (!key || !label || kindDefinitions.some((definition) => definition.key === key)) return;
    const response = await api.replaceVocabularyKinds([
      ...kindDefinitions.filter((definition) => !definition.builtIn).map(({ key: existingKey, label: existingLabel, description, icon, order }) => ({ key: existingKey, label: existingLabel, description, icon, order })),
      { key, label, description: kindDescription.trim() || null, icon: null, order: 1000 + kindDefinitions.length }
    ]);
    if (!response.ok) {
      setError(response.error || copy.saveKindFailed);
      return;
    }
    setKindDefinitions(response.kinds);
    setKindKey("");
    setKindLabel("");
    setKindDescription("");
  }

  function adoptDiscovered(item: { term: string; kind: Kind }) {
    setTerm(item.term);
    setKind(item.kind);
  }

  async function removeTerm(id: string) {
    const target = terms.find((item) => item.id === id);
    const response = await api.deleteVocabularyTerm(id);
    if (!response.ok) {
      setError(response.error || copy.deleteFailed);
      await refreshTerms();
      return;
    }
    if (target) {
      setDeleteStack((stack) =>
        pushUndo(stack, { term: target.term, kind: target.kind, aliases: target.aliases || "", canonicalTermId: target.canonicalTermId || null, note: target.note || "" })
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
      canonicalTermId: result.entry.canonicalTermId,
      note: result.entry.note
    });
    if (!response.ok) {
      setError(response.error || copy.undoFailed);
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
      setError(copy.redoMissing.replace("{term}", result.entry.term));
      return;
    }
    const response = await api.deleteVocabularyTerm(current.id);
    if (!response.ok) {
      setError(response.error || copy.redoFailed);
      return;
    }
    setDeleteStack(result.stack);
    await refreshTerms();
  }

  return (
    <AppShell subtitle={t.pageTitles.vocabulary} contentClassName="local-list-content" tipsPage="vocabulary">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>} title={copy.title} description={copy.description}
        meta={(
          <>
            <span className="badge">{copy.savedCount.replace("{count}", String(savedTerms.length))}</span><span className="badge">{copy.discoveredCount.replace("{count}", String(discovered.length))}</span>
          </>
        )}
        actions={(
          <>
            {canManageVocabulary && (
              <button type="button" className="button button-secondary" disabled={isImporting} onClick={() => void importDefaultTags()}>{copy.importDefaults}</button>
            )}
            <a className="button button-secondary" href="/tags">{copy.manageTags}</a>
          </>
        )}
      >
        {canManageVocabulary ? (
          <form className="archive-toolbar-grid" onSubmit={addTerm}>
            <label>
              <span>{copy.term}</span>
              <input className="search-input" value={term} onChange={(event) => setTerm(event.target.value)} />
            </label>
            <label>
              <span>{copy.kind}</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
                {kindDefinitions.map((definition) => <option key={definition.key} value={definition.key}>{definition.icon ? `${definition.icon} ` : ""}{definition.label}</option>)}
              </select>
            </label>
            <label>
              <span>{copy.aliases}</span><input className="search-input" value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder={copy.aliasesPlaceholder} />
            </label>
            <label>
              <span>{copy.canonical}</span><select value={canonicalTermId} onChange={(event) => setCanonicalTermId(event.target.value)}><option value="">{copy.canonicalSelf}</option>{terms.filter((item) => item.id !== canonicalTermId).map((item) => <option key={item.id} value={item.id}>{item.term}</option>)}</select>
            </label>
            <label>
              <span>{copy.searchDictionary}</span><input className="search-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={copy.searchPlaceholder} />
            </label>
            <label className="full-span">
              <span>{copy.note}</span>
              <textarea className="search-input" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
            </label>
            <div className="archive-toolbar-actions">
              <button className="button button-primary" type="submit" disabled={!term.trim()}>{copy.saveTerm}</button>
            </div>
          </form>
        ) : (
          <div className="archive-toolbar-grid">
            <label>
              <span>{copy.searchDictionary}</span><input className="search-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={copy.searchPlaceholder} />
            </label>
          </div>
        )}
      </PageToolbar>

      {canManageVocabulary && loadState.status === "ready" ? (
        <section className="panel panel-compact" aria-labelledby="dictionary-categories">
          <div className="panel-title-row">
            <div>
              <h2 id="dictionary-categories">{copy.categories}</h2><p>{copy.categoriesDescription}</p>
            </div>
            <span className="badge">{copy.categoryCount.replace("{count}", String(kindDefinitions.length))}</span>
          </div>
          <form className="archive-toolbar-grid" onSubmit={addDictionaryCategory}>
            <label><span>{copy.identifier}</span><input className="search-input" value={kindKey} onChange={(event) => setKindKey(event.target.value)} placeholder="organization" pattern="[a-z][a-z0-9_-]*" /></label><label><span>{copy.displayName}</span><input className="search-input" value={kindLabel} onChange={(event) => setKindLabel(event.target.value)} placeholder={copy.displayName} /></label><label><span>{copy.categoryDescription}</span><input className="search-input" value={kindDescription} onChange={(event) => setKindDescription(event.target.value)} placeholder={copy.categoryDescription} /></label><div className="archive-toolbar-actions"><button className="button button-secondary" type="submit" disabled={!kindKey.trim() || !kindLabel.trim()}>{copy.addCategory}</button></div>
          </form>
        </section>
      ) : null}

      {loadState.status === "loading" ? (
        <div className="panel panel-compact"><Skeleton label={copy.loading} /></div>
      ) : null}

      {loadState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.archiveReadFailed}</strong>
          <span className="helper-text">{loadState.message}</span>
          <div><button className="button button-secondary button-sm" type="button" onClick={() => void loadVocabulary()}>{copy.retry}</button></div>
        </div>
      ) : null}

      {error && loadState.status === "ready" ? (
        <div className="state-banner state-banner-error" role="alert"><strong>{copy.saveError}</strong><span className="helper-text">{error}</span></div>
      ) : null}

      {importMessage ? <p className="helper-text" role="status">{importMessage}</p> : null}

      {canManageVocabulary && loadState.status === "ready" ? (
        <section className="panel panel-compact" aria-labelledby="department-vocabulary-preferences">
          <div className="panel-title-row">
            <div>
              <h2 id="department-vocabulary-preferences">{copy.departmentPreferences}</h2><p>{copy.departmentPreferencesDescription}</p>
            </div>
            <span className="badge">{copy.approvedCount.replace("{count}", String(preferredTermIds.length))}</span>
          </div>
          <div className="archive-toolbar-grid">
            <label>
              <span>{copy.departmentId}</span>
              <input className="search-input" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} placeholder="news" />
            </label>
            <div className="archive-toolbar-actions">
              <button type="button" className="button button-secondary" onClick={() => void loadDepartmentPreferences()} disabled={!departmentId.trim()}>{copy.loadPreferences}</button>
              <button type="button" className="button button-primary" onClick={() => void saveDepartmentPreferences()} disabled={!departmentId.trim() || isSavingPreferences}>
                {isSavingPreferences ? copy.saving : copy.savePreferences}
              </button>
            </div>
          </div>
          {preferenceMessage ? <p className="helper-text" role="status">{preferenceMessage}</p> : null}
          <div className="analytics-tag-list">
            {terms.map((item) => (
              <label className="analytics-tag-row" key={`department-preference-${item.id}`}>
                <span><strong>{item.term}</strong>{item.aliases ? <small className="helper-text"> · {item.aliases}</small> : null}</span>
                <span className="button-row">
                  <span className="badge">{item.kind}</span>
                  <input type="checkbox" checked={preferredTermIds.includes(item.id)} onChange={() => toggleDepartmentPreference(item.id)} aria-label={copy.approveForDepartment.replace("{term}", item.term)} />
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {canManageVocabulary && (canUndo(deleteStack) || canRedo(deleteStack)) ? (
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(deleteStack)}
            onClick={() => void handleUndoRemove()}
          >
            {copy.undoDelete}{deleteStack.past.length > 0 ? ` (${deleteStack.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(deleteStack)}
            onClick={() => void handleRedoRemove()}
          >
            {copy.redoDelete}{deleteStack.future.length > 0 ? ` (${deleteStack.future.length})` : ""}
          </button>
        </div>
      ) : null}

      {loadState.status === "ready" ? <section className="split-layout">
        <article className="panel">
          <div className="panel-title-row">
            <div>
              <h2>{copy.savedTerms}</h2><p>{copy.savedTermsDescription}</p>
            </div>
            <span className="badge">{savedTerms.length}</span>
          </div>
          {savedTerms.length === 0 ? (
            <EmptyState title={copy.noSavedTerms} description={copy.noSavedTermsDescription} />
          ) : (
            <div className="analytics-tag-list">
              {savedTerms.map((item) => (
                <div className="analytics-tag-row" key={item.id}>
                  <span>
                    <strong>{item.term}</strong>
                    {item.aliases ? <small className="helper-text"> · {item.aliases}</small> : null}
                    {item.canonicalTermId ? <small className="helper-text"> · {copy.canonicalAlias.replace("{term}", terms.find((candidate) => candidate.id === item.canonicalTermId)?.term || copy.canonicalFallback)}</small> : null}
                    {item.note ? <small className="helper-text"> · {item.note}</small> : null}
                  </span>
                  <div className="button-row">
                    <span className="badge">{item.kind}</span>
                    {canManageVocabulary && (
                      <button type="button" className="button button-danger button-sm" onClick={() => void removeTerm(item.id)}>{copy.delete}</button>
                    )}
                  </div>
                  <span className="helper-text">{copy.impactPreview.replace("{count}", String(countAffectedRecords(records, (record) => record.type === item.term || (record.tags || []).includes(item.term))))}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-title-row">
            <div>
              <h2>{copy.discoveredTerms}</h2><p>{copy.discoveredTermsDescription}</p>
            </div>
            <span className="badge">{discovered.length}</span>
          </div>
          <div className="analytics-tag-list">
            {discovered.map((item) => (
              <div className="analytics-tag-row" key={`${item.kind}-${item.term}`}>
                <span>{item.term}</span>
                <div className="button-row">
                  <strong>{item.count}</strong>
                  <span className="badge">{item.kind === "type" ? copy.type : copy.tag}</span><button type="button" className="button button-secondary button-sm" onClick={() => adoptDiscovered(item)}>{copy.adopt}</button>
                </div>
              </div>
            ))}
          </div>
          <ChangeImpactPreview impact={buildChangeImpact({ action: "update", entity: copy.dictionary, affectedCount: 0 })} />
        </article>
      </section> : null}
    </AppShell>
  );
}
