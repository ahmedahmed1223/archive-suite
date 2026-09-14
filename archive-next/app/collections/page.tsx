"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import IconPicker from "@/components/IconPicker";
import ArchivalHierarchyTree from "@/components/ArchivalHierarchyTree";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type ArchivalNode, type ArchiveRecord, type AuthorityEntity, type Collection, type CreateCollectionPayload, type CuratedCollection } from "@/lib/archive-api";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { buildChangeImpact } from "@/lib/change-impact";
import { countBy, formatDate, recordMatches, uniqueSorted } from "@/lib/record-utils";
import { toastError, toastSuccess } from "@/lib/toast";
import { canRedo, canUndo, emptyUndoStack, pushUndo, redo, undo, type UndoStack } from "@/lib/undo-stack";
import { Skeleton } from "@/components/ui/Skeleton";
import { iconRegistry } from "@/lib/icon-registry";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { hierarchyTreeCopy } from "@/lib/i18n/dictionaries/hierarchy-tree";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[] }
  | { status: "error"; message: string };

type CollectionsLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };


export default function CollectionsPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.collections;
  const hierarchyMoveCopy = copy.hierarchyMove;
  const hierarchyTreeLabels = hierarchyTreeCopy(locale);
  const authorityCopy = copy.authority;
  const authorityKindLabels: Record<AuthorityEntity["kind"], string> = copy.authorityKinds;
  const curatedCopy = copy.curated;
  const curatedStatusLabels: Record<CuratedCollection["status"], string> = copy.curatedStatuses;
  const curatedOrderCopy = t.pages.daily;
  const dialogs = useConfirmDialog();
  const canManageCollections = useCapability("collections.manage");
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [collections, setCollections] = useState<Collection[]>([]);
  const [archivalNodes, setArchivalNodes] = useState<ArchivalNode[]>([]);
  const [archivalNodesError, setArchivalNodesError] = useState("");
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [nodeTitle, setNodeTitle] = useState("");
  const [nodeLevel, setNodeLevel] = useState<ArchivalNode["level"]>("fonds");
  const [nodeParentId, setNodeParentId] = useState("");
  const [movingNodeId, setMovingNodeId] = useState("");
  const [moveParentId, setMoveParentId] = useState("");
  const [moveAffectedCount, setMoveAffectedCount] = useState<number | null>(null);
  const [authorityEntities, setAuthorityEntities] = useState<AuthorityEntity[]>([]);
  const [authorityError, setAuthorityError] = useState("");
  const [showAuthorityForm, setShowAuthorityForm] = useState(false);
  const [authorityLabel, setAuthorityLabel] = useState("");
  const [authorityKind, setAuthorityKind] = useState<AuthorityEntity["kind"]>("person");
  const [authorityAliases, setAuthorityAliases] = useState("");
  const [curatedCollections, setCuratedCollections] = useState<CuratedCollection[]>([]);
  const [showCuratedForm, setShowCuratedForm] = useState(false);
  const [curatedTitle, setCuratedTitle] = useState("");
  const [curatedIntroduction, setCuratedIntroduction] = useState("");
  const [curatedError, setCuratedError] = useState("");
  const [selectedCuratedCollectionId, setSelectedCuratedCollectionId] = useState("");
  const [curatedRecordIds, setCuratedRecordIds] = useState<string[]>([]);
  const [curatedRecordsLoading, setCuratedRecordsLoading] = useState(false);
  const [recordToAdd, setRecordToAdd] = useState("");
  const [collectionsState, setCollectionsState] = useState<CollectionsLoadState>({ status: "loading" });
  const [statusMessage, setStatusMessage] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [tag, setTag] = useState("all");
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [deleteStack, setDeleteStack] = useState<UndoStack<CreateCollectionPayload>>(emptyUndoStack);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function refreshCollections() {
    setCollectionsState({ status: "loading" });
    const response = await api.collections();
    if (response.ok) {
      setCollections(response.collections);
      setCollectionsState({ status: "ready" });
    } else {
      const message = response.error || copy.loadFailed;
      setCollectionsState({ status: "error", message });
      setStatusMessage(message);
    }
  }

  useEffect(() => {
    void refreshCollections();
    void api.archivalNodes().then((response) => {
      if (response.ok) setArchivalNodes(response.nodes);
      else setArchivalNodesError(response.error || copy.hierarchyLoadFailed);
    });
    void api.authorityEntities().then((response) => {
      if (response.ok) setAuthorityEntities(response.entities);
      else setAuthorityError(response.error || authorityCopy.failed);
    });
    void api.curatedCollections().then((response) => { if (response.ok) setCuratedCollections(response.collections); else setCuratedError(response.error || curatedCopy.failed); });
    void (async () => {
      const response = await api.search({ limit: 1000 });
      setState(response.ok ? { status: "ready", records: response.records } : { status: "error", message: response.error });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshCollections and the inline search callback are redefined every render; api is the only stable dependency and is already listed
  }, [api]);

  useEffect(() => {
    if (!selectedCuratedCollectionId && curatedCollections.length > 0) {
      setSelectedCuratedCollectionId(curatedCollections[0].id);
    }
  }, [curatedCollections, selectedCuratedCollectionId]);

  useEffect(() => {
    if (!selectedCuratedCollectionId) {
      setCuratedRecordIds([]);
      return;
    }
    setCuratedRecordsLoading(true);
    void api.curatedCollectionRecords(selectedCuratedCollectionId).then((response) => {
      if (response.ok) setCuratedRecordIds(response.recordIds);
      else setCuratedError(response.error || curatedCopy.membershipFailed);
      setCuratedRecordsLoading(false);
    });
  }, [api, curatedCopy.membershipFailed, selectedCuratedCollectionId]);

  const records = useMemo(
    () => (state.status === "ready" ? state.records : []),
    [state]
  );
  const types = useMemo(() => uniqueSorted(records.map((record) => record.type), locale), [locale, records]);
  const tags = useMemo(() => uniqueSorted(records.flatMap((record) => record.tags || []), locale), [locale, records]);
  const smartSuggestions = useMemo(() => {
    const topTypes = countBy(records.map((record) => record.type || "").filter(Boolean), locale).slice(0, 4);
    const topTags = countBy(records.flatMap((record) => record.tags || []), locale).slice(0, 4);
    return [
      ...topTypes.map(([value, count]) => ({ label: copy.typeSuggestion.replace("{value}", value), type: value, tag: "all", count })),
      ...topTags.map(([value, count]) => ({ label: copy.tagSuggestion.replace("{value}", value), type: "all", tag: value, count }))
    ].slice(0, 6);
  }, [records, copy, locale]);

  async function createCollection(payload: { name: string; query?: string; type?: string; tag?: string; icon?: string }) {
    setStatusMessage(copy.saving);
    const response = await api.createCollection(payload);
    if (!response.ok) {
      const message = response.error || copy.saveFailed;
      setStatusMessage(message);
      toastError(message);
      return;
    }
    setStatusMessage(copy.saved); toastSuccess(copy.saved);
    await refreshCollections();
  }

  async function createArchivalNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nodeTitle.trim()) return;
    setArchivalNodesError("");
    const response = await api.createArchivalNode({ title: nodeTitle.trim(), level: nodeLevel, parentId: nodeParentId || null });
    if (!response.ok) {
      setArchivalNodesError(response.error || copy.hierarchyCreateFailed);
      return;
    }
    setArchivalNodes((current) => [...current, response.node]);
    setNodeTitle("");
    setNodeParentId("");
    setShowNodeForm(false);
  }

  async function previewArchivalMove() {
    if (!movingNodeId) return;
    setArchivalNodesError("");
    const response = await api.previewArchivalNodeMove(movingNodeId, { parentId: moveParentId || null });
    if (!response.ok) {
      setArchivalNodesError(response.error || hierarchyMoveCopy.failed);
      return;
    }
    setMoveAffectedCount(response.preview.affectedDescendantCount);
  }

  async function applyArchivalMove() {
    if (!movingNodeId || moveAffectedCount === null) return;
    const response = await api.moveArchivalNode(movingNodeId, { parentId: moveParentId || null });
    if (!response.ok) {
      setArchivalNodesError(response.error || hierarchyMoveCopy.failed);
      return;
    }
    setArchivalNodes((current) => current.map((node) => node.id === response.node.id ? response.node : node));
    setMovingNodeId("");
    setMoveParentId("");
    setMoveAffectedCount(null);
  }

  async function createAuthorityEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorityLabel.trim()) return;
    setAuthorityError("");
    const response = await api.createAuthorityEntity({ kind: authorityKind, preferredLabel: authorityLabel.trim(), aliases: authorityAliases.split(",").map((alias) => alias.trim()).filter(Boolean) });
    if (!response.ok) {
      setAuthorityError(response.error || authorityCopy.failed);
      return;
    }
    setAuthorityEntities((current) => [...current, response.entity]);
    setAuthorityLabel(""); setAuthorityAliases(""); setShowAuthorityForm(false);
  }

  async function createCuratedCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!curatedTitle.trim()) return;
    const response = await api.createCuratedCollection({ title: curatedTitle.trim(), introduction: curatedIntroduction.trim() || null });
    if (!response.ok) { setCuratedError(response.error || curatedCopy.failed); return; }
    setCuratedCollections((current) => [...current, response.collection]); setSelectedCuratedCollectionId(response.collection.id); setCuratedTitle(""); setCuratedIntroduction(""); setShowCuratedForm(false);
  }

  async function addRecordToCuratedCollection() {
    if (!selectedCuratedCollectionId || !recordToAdd) return;
    setCuratedError("");
    const response = await api.addCuratedCollectionRecord(selectedCuratedCollectionId, recordToAdd);
    if (!response.ok) { setCuratedError(response.error || curatedCopy.membershipFailed); return; }
    setCuratedRecordIds((current) => current.includes(recordToAdd) ? current : [...current, recordToAdd]);
    setRecordToAdd("");
  }

  async function removeRecordFromCuratedCollection(recordId: string) {
    if (!selectedCuratedCollectionId) return;
    setCuratedError("");
    const response = await api.removeCuratedCollectionRecord(selectedCuratedCollectionId, recordId);
    if (!response.ok) { setCuratedError(response.error || curatedCopy.membershipFailed); return; }
    setCuratedRecordIds((current) => current.filter((id) => id !== recordId));
  }

  async function moveCuratedRecord(recordId: string, offset: -1 | 1) {
    if (!selectedCuratedCollectionId) return;
    const currentPosition = curatedRecordIds.indexOf(recordId);
    const targetPosition = currentPosition + offset;
    if (currentPosition < 0 || targetPosition < 0 || targetPosition >= curatedRecordIds.length) return;
    const recordIds = [...curatedRecordIds];
    [recordIds[currentPosition], recordIds[targetPosition]] = [recordIds[targetPosition], recordIds[currentPosition]];
    setCuratedError("");
    const response = await api.reorderCuratedCollectionRecords(selectedCuratedCollectionId, { recordIds });
    if (!response.ok) { setCuratedError(response.error || curatedCopy.membershipFailed); return; }
    setCuratedRecordIds(response.recordIds);
  }

  async function addCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    await createCollection({ name: name.trim(), query: query.trim(), type, tag, icon });
    setName("");
    setQuery("");
    setType("all");
    setTag("all");
    setIcon(undefined);
    setShowCreateForm(false);
  }

  async function removeCollection(id: string) {
    if (state.status !== "ready") {
      setStatusMessage(copy.countUnavailable);
      return;
    }
    const collection = collections.find((item) => item.id === id);
    if (
      collection &&
      !(await dialogs.confirm({
        title: copy.deleteTitle, message: copy.deleteMessage.replace("{count}", String(records.filter((record) => recordMatches(record, collection)).length)), confirmLabel: copy.delete,
        destructive: true
      }))
    )
      return;
    const response = await api.deleteCollection(id);
    if (!response.ok) {
      setStatusMessage(response.error || copy.deleteFailed);
      await refreshCollections();
      return;
    }
    setStatusMessage(copy.deleted);
    if (collection) {
      setDeleteStack((stack) =>
        pushUndo(stack, { name: collection.name, query: collection.query || undefined, type: collection.type, tag: collection.tag, icon: collection.icon || undefined })
      );
    }
    await refreshCollections();
  }

  async function handleUndoRemoveCollection() {
    const result = undo(deleteStack);
    if (!result) return;
    const response = await api.createCollection(result.entry);
    if (!response.ok) {
      setStatusMessage(response.error || copy.undoFailed);
      return;
    }
    setStatusMessage(copy.restored);
    setDeleteStack(result.stack);
    await refreshCollections();
  }

  async function handleRedoRemoveCollection() {
    const result = redo(deleteStack);
    if (!result) return;
    const current = collections.find((item) => item.name === result.entry.name);
    if (!current) {
      setStatusMessage(copy.redoMissing.replace("{name}", result.entry.name));
      return;
    }
    const response = await api.deleteCollection(current.id);
    if (!response.ok) {
      setStatusMessage(response.error || copy.redoFailed);
      return;
    }
    setStatusMessage(copy.redone);
    setDeleteStack(result.stack);
    await refreshCollections();
  }

  async function saveSuggestion(suggestion: { label: string; type: string; tag: string }) {
    await createCollection({ name: suggestion.label, type: suggestion.type, tag: suggestion.tag });
  }

  return (
    <AppShell subtitle={t.pageTitles.groups} contentClassName="local-list-content" tipsPage="collections">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>} title={copy.title} description={copy.description}
        meta={(
          <>
            <span className="badge">{copy.collectionCount.replace("{count}", String(collections.length))}</span><span className="badge">{copy.recordCount.replace("{count}", String(records.length))}</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/archive">{copy.openArchive}</a>}
      >
        {canManageCollections ? (
          showCreateForm ? (
            <form className="archive-toolbar-grid" onSubmit={addCollection}>
              <label>
                <span>{copy.name}</span><input className="search-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.namePlaceholder} />
              </label>
              <label>
                <span>{copy.query}</span><input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.queryPlaceholder} />
              </label>
              <label>
                <span>{copy.type}</span>
                <select value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="all">{copy.allTypes}</option>
                  {types.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>{copy.tag}</span>
                <select value={tag} onChange={(event) => setTag(event.target.value)}>
                  <option value="all">{copy.allTags}</option>
                  {tags.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="full-span">
                <IconPicker value={icon} onChange={setIcon} label={copy.iconLabel} />
              </div>
              <div className="archive-toolbar-actions">
                <button className="button button-primary" type="submit" disabled={!name.trim()}>{copy.save}</button><button className="button button-secondary" type="button" onClick={() => setShowCreateForm(false)}>{copy.cancel}</button>
              </div>
            </form>
          ) : (
            <div className="archive-toolbar-actions">
              <button className="button button-primary" type="button" onClick={() => setShowCreateForm(true)}>{copy.newCollection}</button>
            </div>
          )
        ) : (
          <p className="helper-text">{copy.noPermission}</p>
        )}
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
      </PageToolbar>

      <section className="panel panel-compact" aria-labelledby="institutional-hierarchy-heading">
        <div className="toolbar-row toolbar-start">
          <div>
            <span className="badge">{copy.hierarchyBadge}</span>
            <h2 id="institutional-hierarchy-heading" className="section-heading">{copy.hierarchyTitle}</h2>
          </div>
          <strong className="metric-value">{archivalNodes.length}</strong>
        </div>
        <p className="helper-text">{copy.hierarchyDescription}</p>
        {archivalNodesError ? <p className="form-status" role="alert">{archivalNodesError}</p> : null}
        {canManageCollections ? (
          showNodeForm ? (
            <form className="archive-toolbar-grid" onSubmit={createArchivalNode}>
              <label><span>{copy.hierarchyNodeTitle}</span><input className="search-input" value={nodeTitle} onChange={(event) => setNodeTitle(event.target.value)} required /></label>
              <label><span>{copy.hierarchyLevel}</span><select value={nodeLevel} onChange={(event) => setNodeLevel(event.target.value as ArchivalNode["level"])}>{(["institution", "fonds", "series", "program", "season", "episode", "item", "segment"] as const).map((level) => <option key={level} value={level}>{copy.hierarchyLevels[level]}</option>)}</select></label>
              <label><span>{copy.hierarchyParent}</span><select value={nodeParentId} onChange={(event) => setNodeParentId(event.target.value)}><option value="">{copy.hierarchyRoot}</option>{archivalNodes.map((node) => <option key={node.id} value={node.id}>{[...node.path.map((entry) => entry.title), node.title].join(" › ")}</option>)}</select></label>
              <div className="archive-toolbar-actions"><button className="button button-primary" type="submit">{copy.hierarchyCreate}</button><button className="button button-secondary" type="button" onClick={() => setShowNodeForm(false)}>{copy.cancel}</button></div>
            </form>
          ) : <button className="button button-secondary button-sm" type="button" onClick={() => setShowNodeForm(true)}>{copy.hierarchyNew}</button>
        ) : null}
        {!archivalNodesError && archivalNodes.length === 0 ? <p className="helper-text">{copy.hierarchyEmpty}</p> : null}
        {archivalNodes.length > 0 ? (
          <ArchivalHierarchyTree
            nodes={archivalNodes}
            copy={{ ...hierarchyTreeLabels, move: hierarchyMoveCopy.move, levelLabels: copy.hierarchyLevels }}
            ariaLabel={copy.hierarchyTitle}
            onMove={canManageCollections ? (node) => { setMovingNodeId(node.id); setMoveParentId(node.parentId || ""); setMoveAffectedCount(null); } : undefined}
          />
        ) : null}
        {movingNodeId ? (
          <div className="panel panel-compact">
            <label><span>{copy.hierarchyParent}</span><select value={moveParentId} onChange={(event) => { setMoveParentId(event.target.value); setMoveAffectedCount(null); }}><option value="">{copy.hierarchyRoot}</option>{archivalNodes.filter((node) => node.id !== movingNodeId).map((node) => <option key={node.id} value={node.id}>{[...node.path.map((entry) => entry.title), node.title].join(" › ")}</option>)}</select></label>
            <div className="archive-toolbar-actions"><button className="button button-secondary" type="button" onClick={() => void previewArchivalMove()}>{hierarchyMoveCopy.preview}</button>{moveAffectedCount !== null ? <button className="button button-primary" type="button" onClick={() => void applyArchivalMove()}>{hierarchyMoveCopy.apply}</button> : null}<button className="button button-secondary" type="button" onClick={() => { setMovingNodeId(""); setMoveAffectedCount(null); }}>{copy.cancel}</button></div>
            {moveAffectedCount !== null ? <p className="form-status" role="status">{hierarchyMoveCopy.impact.replace("{count}", String(moveAffectedCount))}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="panel panel-compact" aria-labelledby="authority-entities-heading">
        <div className="toolbar-row toolbar-start"><div><span className="badge">{authorityCopy.badge}</span><h2 id="authority-entities-heading" className="section-heading">{authorityCopy.title}</h2></div><strong className="metric-value">{authorityEntities.length}</strong></div>
        <p className="helper-text">{authorityCopy.description}</p>
        {authorityError ? <p className="form-status" role="alert">{authorityError}</p> : null}
        {canManageCollections ? (showAuthorityForm ? <form className="archive-toolbar-grid" onSubmit={createAuthorityEntity}><label><span>{authorityCopy.label}</span><input className="search-input" value={authorityLabel} onChange={(event) => setAuthorityLabel(event.target.value)} required /></label><label><span>{authorityCopy.kind}</span><select value={authorityKind} onChange={(event) => setAuthorityKind(event.target.value as AuthorityEntity["kind"])}>{(["person", "organization", "place", "program"] as const).map((kind) => <option key={kind} value={kind}>{authorityKindLabels[kind]}</option>)}</select></label><label><span>{authorityCopy.aliases}</span><input className="search-input" value={authorityAliases} onChange={(event) => setAuthorityAliases(event.target.value)} /></label><div className="archive-toolbar-actions"><button className="button button-primary" type="submit">{authorityCopy.save}</button><button className="button button-secondary" type="button" onClick={() => setShowAuthorityForm(false)}>{copy.cancel}</button></div></form> : <button className="button button-secondary button-sm" type="button" onClick={() => setShowAuthorityForm(true)}>{authorityCopy.newEntity}</button>) : null}
        {authorityEntities.length > 0 ? <div className="tags">{authorityEntities.map((entity) => <span className="tag" key={entity.id}>{entity.preferredLabel} · {authorityKindLabels[entity.kind]}</span>)}</div> : null}
      </section>

      <section className="panel panel-compact" aria-labelledby="curated-collections-heading">
        <div className="toolbar-row toolbar-start"><div><span className="badge">{copy.eyebrow}</span><h2 id="curated-collections-heading" className="section-heading">{curatedCopy.title}</h2></div><strong className="metric-value">{curatedCollections.length}</strong></div>
        <p className="helper-text">{curatedCopy.description}</p>{curatedError ? <p className="form-status" role="alert">{curatedError}</p> : null}
        {canManageCollections ? (showCuratedForm ? <form className="archive-toolbar-grid" onSubmit={createCuratedCollection}><label><span>{curatedCopy.label}</span><input className="search-input" value={curatedTitle} onChange={(event) => setCuratedTitle(event.target.value)} required /></label><label><span>{curatedCopy.intro}</span><textarea value={curatedIntroduction} onChange={(event) => setCuratedIntroduction(event.target.value)} /></label><div className="archive-toolbar-actions"><button className="button button-primary" type="submit">{curatedCopy.save}</button><button className="button button-secondary" type="button" onClick={() => setShowCuratedForm(false)}>{copy.cancel}</button></div></form> : <button className="button button-secondary button-sm" type="button" onClick={() => setShowCuratedForm(true)}>{curatedCopy.new}</button>) : null}
        {curatedCollections.length ? <div className="tags">{curatedCollections.map((collection) => <span className="tag" key={collection.id}>{collection.title} · {curatedStatusLabels[collection.status]}</span>)}</div> : null}
        {curatedCollections.length > 0 ? (
          <div className="panel panel-compact">
            <label><span>{curatedCopy.choose}</span><select value={selectedCuratedCollectionId} onChange={(event) => setSelectedCuratedCollectionId(event.target.value)}>{curatedCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label>
            <h3 className="section-heading">{curatedCopy.selected}</h3>
            {curatedRecordsLoading ? <p className="helper-text">{copy.loadingRecords}</p> : null}
            {!curatedRecordsLoading && curatedRecordIds.length === 0 ? <p className="helper-text">{curatedCopy.empty}</p> : null}
            {curatedRecordIds.length > 0 ? <ol className="mobile-field-list">{curatedRecordIds.map((recordId, index) => { const record = records.find((item) => item.id === recordId); return <li key={recordId}><strong>{record?.title || recordId}</strong>{canManageCollections ? <div className="button-row"><button className="button button-secondary button-sm" type="button" disabled={index === 0} onClick={() => void moveCuratedRecord(recordId, -1)}>{curatedOrderCopy.moveUp}</button><button className="button button-secondary button-sm" type="button" disabled={index === curatedRecordIds.length - 1} onClick={() => void moveCuratedRecord(recordId, 1)}>{curatedOrderCopy.moveDown}</button><button className="button button-secondary button-sm" type="button" onClick={() => void removeRecordFromCuratedCollection(recordId)}>{curatedCopy.removeRecord}</button></div> : null}</li>; })}</ol> : null}
            {canManageCollections ? <div className="archive-toolbar-actions"><select aria-label={curatedCopy.chooseRecord} value={recordToAdd} onChange={(event) => setRecordToAdd(event.target.value)}><option value="">{curatedCopy.chooseRecord}</option>{records.filter((record) => !curatedRecordIds.includes(record.id)).map((record) => <option key={record.id} value={record.id}>{record.title}</option>)}</select><button className="button button-primary button-sm" type="button" disabled={!recordToAdd} onClick={() => void addRecordToCuratedCollection()}>{curatedCopy.addRecord}</button></div> : null}
          </div>
        ) : null}
      </section>

      {canManageCollections && (canUndo(deleteStack) || canRedo(deleteStack)) ? (
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(deleteStack)}
            onClick={() => void handleUndoRemoveCollection()}
          >
            {copy.undo}{deleteStack.past.length > 0 ? ` (${deleteStack.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(deleteStack)}
            onClick={() => void handleRedoRemoveCollection()}
          >
            {copy.redo}{deleteStack.future.length > 0 ? ` (${deleteStack.future.length})` : ""}
          </button>
        </div>
      ) : null}

      {state.status === "loading" ? <div className="panel panel-compact"><Skeleton label={copy.loadingRecords} /></div> : null}
      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadRecordsFailed}</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {collectionsState.status === "loading" ? <div className="panel panel-compact"><Skeleton label={copy.loadingCollections} /></div> : null}
      {collectionsState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadFailed}</strong>
          <span className="helper-text">{collectionsState.message}</span>
          <div><button className="button button-secondary button-sm" type="button" onClick={() => void refreshCollections()}>{copy.retry}</button></div>
        </div>
      ) : null}

      {collectionsState.status === "ready" && collections.length === 0 ? (
        <EmptyState
          title={copy.empty} description={copy.emptyDescription}
        />
      ) : collectionsState.status === "ready" ? (
        <section className="dense-grid" aria-label={copy.savedCollections}>
          {collections.map((collection) => {
            const matches = state.status === "ready" ? records.filter((record) => recordMatches(record, collection)) : [];
            const searchTerm = collection.query || (collection.tag !== "all" ? collection.tag : collection.name);
            const searchHref = `/search?q=${encodeURIComponent(searchTerm)}${collection.type !== "all" ? `&type=${encodeURIComponent(collection.type)}` : ""}`;
            const CollectionIcon = collection.icon ? iconRegistry[collection.icon] : null;
            return (
              <article className="local-list-card" key={collection.id}>
                <div className="local-list-card__main">
                  <div>
                    <span className="badge">
                      {CollectionIcon && <CollectionIcon aria-hidden="true" size={14} strokeWidth={2} />}
                      {copy.collection}
                    </span>
                    <h3>{collection.name}</h3>
                  </div>
                  <strong className="metric-value">{matches.length}</strong>
                </div>
                <dl className="mobile-field-list">
                  <div><dt>{copy.type}</dt><dd>{collection.type === "all" ? copy.allTypes : collection.type}</dd></div><div><dt>{copy.tag}</dt><dd>{collection.tag === "all" ? copy.allTags : collection.tag}</dd></div><div><dt>{copy.created}</dt><dd>{collection.createdAt ? formatDate(collection.createdAt, "-", locale) : "-"}</dd></div>
                </dl>
                <ChangeImpactPreview impact={buildChangeImpact({ action: "update", entity: copy.entity, affectedCount: 0 })} /><p className="helper-text">{state.status === "ready" ? copy.preview.replace("{count}", String(matches.length)) : copy.countUnavailable}</p>
                <div className="button-row">
                  <a className="button button-primary button-sm" href={searchHref}>{copy.results}</a>
                  {canManageCollections && (
                    <button className="button button-danger button-sm" type="button" disabled={state.status !== "ready"} onClick={() => void removeCollection(collection.id)}>{copy.delete}</button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {canManageCollections && smartSuggestions.length > 0 ? (
        <section className="page-section" aria-labelledby="smart-collections-heading">
          <div className="toolbar-row toolbar-start">
            <h2 id="smart-collections-heading" className="section-heading">{copy.suggestions}</h2><span className="badge">{copy.archiveData}</span>
          </div>
          <div className="analytics-tag-list">
            {smartSuggestions.map((suggestion) => (
              <div className="analytics-tag-row" key={`${suggestion.type}-${suggestion.tag}`}>
                <span>{suggestion.label}</span>
                <div className="button-row">
                  <strong>{suggestion.count}</strong>
                  <button type="button" className="button button-secondary button-sm" onClick={() => void saveSuggestion(suggestion)}>{copy.save}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
