"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { Button } from "@/components/ui/Button";
import { createArchiveApiClient, type ArchiveType } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getDefaultArchiveTypes, selectMissingDefaults } from "@/lib/default-taxonomy";
import TypesList from "./_components/TypesList";
import TypesEditor from "./_components/TypesEditor";
import "./types.css";
import { Skeleton } from "@/components/ui/Skeleton";

type TypesState =
  | { status: "loading"; types: ArchiveType[] }
  | { status: "ready"; types: ArchiveType[] }
  | { status: "error"; types: ArchiveType[]; message: string };

export default function TypesPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.types;
  const api = useMemo(() => createArchiveApiClient(), []);
  const dialogs = useConfirmDialog();
  const [state, setState] = useState<TypesState>({ status: "loading", types: [] });
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [editorType, setEditorType] = useState<ArchiveType | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);
  const [editorError, setEditorError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const loadTypes = useCallback(async () => {
    setState((current) => ({ status: "loading", types: current.types }));
    const types: ArchiveType[] = [];
    let cursor: string | undefined;

    do {
      const response = await api.types({ cursor, limit: 200 });
      if (!response.ok) {
        setState({ status: "error", types, message: response.error || copy.loadError });
        return;
      }
      types.push(...response.types);
      cursor = response.nextCursor ?? undefined;
    } while (cursor);

    setState({ status: "ready", types });
    setSelectedTypeId((current) => current && types.some((type) => type.id === current) ? current : types[0]?.id ?? null);
  }, [api, copy.loadError]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const selectedType = state.types.find((type) => type.id === selectedTypeId) ?? null;
  const isEditorOpen = editorType !== undefined;

  async function importDefaults() {
    if (isSaving) return;
    setIsSaving(true);
    setActionMessage("");
    const missing = selectMissingDefaults(state.types.map((type) => type.id), getDefaultArchiveTypes(locale));
    if (missing.length === 0) {
      setActionMessage(copy.defaultsComplete);
      setIsSaving(false);
      return;
    }
    let imported = 0;
    for (const type of missing) {
      const response = await api.saveType(type);
      if (!response.ok) {
        setActionMessage(copy.defaultsPartial.replace("{imported}", String(imported)).replace("{total}", String(missing.length)).replace("{name}", type.name).replace("{error}", response.error));
        setIsSaving(false);
        await loadTypes();
        return;
      }
      imported += 1;
    }
    setActionMessage(copy.defaultsImported.replace("{count}", String(imported)));
    setIsSaving(false);
    await loadTypes();
  }

  function startCreate() {
    setEditorError("");
    setEditorType(null);
  }

  async function startEdit(type: ArchiveType) {
    setEditorError("");
    setActionMessage("");
    const response = await api.type(type.id);
    if (!response.ok) {
      setActionMessage(response.error || copy.editLoadError);
      return;
    }
    setSelectedTypeId(response.type.id);
    setEditorType(response.type);
  }

  function closeEditor() {
    if (isSaving) return;
    setEditorError("");
    setEditorType(undefined);
  }

  async function handleSaveType(typeData: ArchiveType) {
    setIsSaving(true);
    setEditorError("");
    setActionMessage("");
    const response = await api.saveType(typeData);
    setIsSaving(false);

    if (!response.ok) {
      setEditorError(response.error || copy.saveError);
      return;
    }

    setState((current) => {
      const index = current.types.findIndex((type) => type.id === response.type.id);
      const types = index === -1
        ? [...current.types, response.type]
        : current.types.map((type) => type.id === response.type.id ? response.type : type);
      return { status: "ready", types };
    });
    setSelectedTypeId(response.type.id);
    setActionMessage(copy.saved.replace("{name}", response.type.name));
    setEditorType(undefined);
  }

  async function handleDeleteType(type: ArchiveType) {
    const confirmed = await dialogs.confirm({
      title: copy.deleteTitle,
      message: copy.deleteMessage.replace("{name}", type.name),
      confirmLabel: copy.delete,
      destructive: true
    });
    if (!confirmed) return;

    setDeletingTypeId(type.id);
    setActionMessage("");
    const response = await api.deleteType(type.id);
    setDeletingTypeId(null);

    if (!response.ok) {
      setActionMessage(response.error || copy.deleteError);
      return;
    }

    setState((current) => ({ status: "ready", types: current.types.filter((item) => item.id !== type.id) }));
    setSelectedTypeId((current) => current === type.id ? null : current);
    if (editorType?.id === type.id) setEditorType(undefined);
    setActionMessage(copy.deleted.replace("{name}", type.name));
  }

  return (
    <AppShell subtitle={t.pageTitles.types} contentClassName="types-content" tipsPage="types">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={<span className="badge">{copy.count.replace("{count}", String(state.types.length))}</span>}
        actions={(
          <>
            <Button type="button" variant="secondary" disabled={isSaving} onClick={() => void importDefaults()}>{copy.importDefaults}</Button>
            <Button type="button" variant="primary" onClick={startCreate}>{copy.newType}</Button>
          </>
        )}
      />

      {actionMessage ? <p className="types-feedback" role="status">{actionMessage}</p> : null}
      <section className="state-banner" role="alert">
        <strong>{copy.impactTitle}</strong>
        <span className="helper-text">{copy.impactDescription}</span>
      </section>

      {state.status === "error" ? (
        <section className="types-state" role="alert">
          <strong>{copy.loadError}</strong>
          <p>{state.message}</p>
          <Button type="button" variant="secondary" onClick={() => void loadTypes()}>{copy.retry}</Button>
        </section>
      ) : null}

      {state.status === "loading" && state.types.length === 0 ? (
        <section className="types-state"><Skeleton label={copy.loading} /></section>
      ) : null}

      {(state.status === "ready" || state.types.length > 0) ? (
        <div className="schema-studio">
          <section className="schema-sidebar" aria-labelledby="types-list-heading">
            <div className="schema-sidebar__heading">
              <div>
                <p className="schema-editor__eyebrow">{copy.availableSchemas}</p>
                <h2 id="types-list-heading">{copy.archiveTypes}</h2>
              </div>
              {state.status === "loading" ? <span className="schema-loading">{copy.refreshing}</span> : null}
            </div>
            <TypesList
              types={state.types}
              selectedTypeId={selectedTypeId}
              deletingTypeId={deletingTypeId}
              onSelectType={setSelectedTypeId}
              onEditType={(type) => void startEdit(type)}
              onDeleteType={(type) => void handleDeleteType(type)}
              onCreateType={startCreate}
            />
          </section>

          <section className="schema-preview" aria-labelledby="type-preview-heading">
            {selectedType ? (
              <>
                <div className="schema-preview__heading">
                  <div>
                    <p className="schema-editor__eyebrow">{copy.schemaPreview}</p>
                    <h2 id="type-preview-heading">{selectedType.name}</h2>
                    <code dir="ltr">{selectedType.id}</code>
                  </div>
                  <Button type="button" size="sm" onClick={() => void startEdit(selectedType)}>{copy.edit}</Button>
                </div>
                <dl className="schema-preview__fields">
                  {selectedType.fields.map((field) => (
                    <div key={field.name}>
                      <dt>{field.name}</dt>
                      <dd>{copy.fieldTypes[field.type]}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} actions={<Button type="button" variant="primary" onClick={startCreate}>{copy.newType}</Button>} />
            )}
          </section>

          {isEditorOpen ? <TypesEditor initialType={editorType ?? null} isSaving={isSaving} requestError={editorError} onSave={handleSaveType} onCancel={closeEditor} /> : <aside className="schema-editor schema-editor--placeholder"><p>{copy.editorPlaceholder}</p></aside>}
        </div>
      ) : null}
    </AppShell>
  );
}
