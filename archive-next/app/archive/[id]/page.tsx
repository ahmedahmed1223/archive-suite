"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useCapability } from "@/components/RoleGate";
import BroadcastMetadataPanel from "@/components/BroadcastMetadataPanel";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { type AppDictionary } from "@/lib/i18n/dictionaries";
import GeotagPanel from "./GeotagPanel";
import MediaDerivativesTree from "./MediaDerivativesTree";
import { RecordDescribeForm, type RecordDescribePatch } from "./RecordDescribeForm";
import { RelationPreviewPanel } from "./RelationPreviewPanel";
import { RecordNotesPanel, sortRecordNotes } from "./RecordNotesPanel";
import { RecordCommentsPanel } from "./RecordCommentsPanel";
import { RecordFieldRequestsPanel } from "./RecordFieldRequestsPanel";
import { RecordHistoryPanel } from "./RecordHistoryPanel";
import { RecordReadinessPanel } from "./RecordReadinessPanel";
import {
  createArchiveApiClient,
  deriveRecordSourcePath,
  type ArchiveRecord,
  type ArchiveSuggestion,
  type CreateRelationPayload,
  type RecordAiAssist,
  type RecordComment,
  type RecordFieldRequest,
  type RecordHistoryEntry,
  type RecordNote,
  type RelationGraphPayload,
  type UpdateRelationPayload,
  type RightsRecord,
  type SuggestionFeedbackValue
} from "@/lib/archive-api";
import { deferRecord, getLaterEntry, removeLater, type LaterEntry } from "@/lib/later-list";
import { isInBasket, toggleBasket } from "@/lib/work-basket";
import { isInQueue, toggleQueue } from "@/lib/personal-queue";
import { getShortcut, isTypingTarget, matchesKeyEvent } from "@/lib/keyboard-shortcuts";
import { recordView } from "@/lib/recent-items";
import { Skeleton } from "@/components/ui/Skeleton";
import RecordPresence from "@/components/RecordPresence";
import RecordAttachmentsPanel from "@/components/RecordAttachmentsPanel";
import RecordSourceReplacementPanel from "@/components/RecordSourceReplacementPanel";
import RecordChangeImpactPanel from "@/components/RecordChangeImpactPanel";
import VocabularyLinkedText, { VocabularyLinkToggle } from "@/components/VocabularyLinkedText";
import DisclosureToolbar from "@/components/DisclosureToolbar";

export { RecordDescribeForm, type RecordDescribePatch };

type DetailState =
  | { status: "loading" }
  | {
      status: "ready";
      record: ArchiveRecord;
      rights: RightsRecord | null;
      relationGraph: RelationGraphPayload | null;
      notes: RecordNote[];
      notesLoading: boolean;
      notesError: string | null;
      comments: RecordComment[];
      commentsLoading: boolean;
      commentsError: string | null;
      fieldRequests: RecordFieldRequest[];
      fieldRequestsLoading: boolean;
      fieldRequestsError: string | null;
      history: RecordHistoryEntry[];
      historyLoading: boolean;
      historyError: string | null;
    }
  | { status: "error"; message: string };

type OcrState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "success"; jobId: string }
  | { status: "error"; message: string };

function mediaPlayerHref(record: ArchiveRecord, recordId: string): string | null {
  const source = deriveRecordSourcePath(record);
  if (!source) return null;

  const params = new URLSearchParams({ path: source.sourcePath, recordId });
  if (source.disk) params.set("disk", source.disk);
  return `/media/play?${params.toString()}`;
}

function RecordAiAssistPanel({
  onAnalyze,
  canEdit
}: Readonly<{
  onAnalyze: () => Promise<RecordAiAssist>;
  canEdit: boolean;
}>) {
  const { t } = useLocale();
  const copy = t.pages.archiveDetail.aiAssist;
  const [result, setResult] = useState<RecordAiAssist | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function analyze() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      setResult(await onAnalyze());
      setStatus(copy.analyzeSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.analyzeError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>{copy.title}</h2>
          <p className="helper-text">{copy.description}</p>
        </div>
        <span className="badge">{copy.reviewRequiredBadge}</span>
      </div>
      {canEdit ? <button type="button" className="button button-secondary" onClick={() => void analyze()} disabled={busy}>{busy ? copy.analyzingButton : copy.analyzeButton}</button> : null}
      {!canEdit ? <p className="helper-text">{copy.permissionHint}</p> : null}
      {status ? <p className="form-status" role="status">{status}</p> : null}
      {result ? (
        <div className="stack section-divider">
          <p><strong>{copy.summaryLabel}</strong> {result.summary}</p>
          <div><strong>{copy.suggestedTagsLabel}</strong><div className="tags">{result.suggestedTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></div>
          <div><strong>{copy.entitiesLabel}</strong><div className="tags">{result.entities.length ? result.entities.map((entity) => <span className="tag" key={`${entity.kind}:${entity.term}`}>{entity.term} · {entity.kind}</span>) : <span className="helper-text">{copy.noEntities}</span>}</div></div>
          <ul className="plain-list">{result.proofreading.map((issue) => <li key={issue.code}>{issue.message}</li>)}</ul>
          <p className="helper-text">{copy.providerNote.replace("{provider}", result.provider)}</p>
        </div>
      ) : null}
    </article>
  );
}



// V3-VOCAB-002: read-only surface for the description and transcript excerpt
// with vocabulary terms auto-linked. Purely presentational - it renders
// `record.description`/`record.transcript` as-is, it never edits them.
function RecordReadSurfacePanel({ record }: Readonly<{ record: ArchiveRecord }>) {
  const { t } = useLocale();
  const copy = t.pages.archiveDetail.readSurface;

  return (
    <article className="panel">
      <div className="panel-section-header panel-title-row">
        <h2>{copy.title}</h2>
        <VocabularyLinkToggle className="helper-text" />
      </div>
      <div className="stack">
        <div>
          <strong>{copy.descriptionLabel}</strong>
          {record.description ? (
            <p><VocabularyLinkedText text={record.description} /></p>
          ) : (
            <p className="helper-text">{copy.noDescription}</p>
          )}
        </div>
        <div>
          <strong>{copy.transcriptLabel}</strong>
          {record.transcript ? (
            <p><VocabularyLinkedText text={record.transcript} /></p>
          ) : (
            <p className="helper-text">{copy.noTranscript}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ArchiveDetailPage() {
  const { t, locale } = useLocale();
  const copy = t.pages.archiveDetail.page;
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const api = useMemo(() => createArchiveApiClient(), []);
  const canEditRecords = useCapability("records.edit");
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [isFav, setIsFav] = useState(false);
  const [inBasket, setInBasket] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [laterEntry, setLaterEntry] = useState<LaterEntry | null>(null);
  const [laterFormOpen, setLaterFormOpen] = useState(false);
  const [laterReason, setLaterReason] = useState("");
  const [laterReviewDate, setLaterReviewDate] = useState("");
  const [ocrState, setOcrState] = useState<OcrState>({ status: "idle" });
  const [suggestions, setSuggestions] = useState<ArchiveSuggestion[]>([]);

  // V1-832: the record-scoped shortcuts. Ctrl/Cmd+Enter deliberately still
  // fires inside a field -- saving from within the form is the whole point --
  // while the single-key jumps stay out of the way while typing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;

      if (matchesKeyEvent(event, getShortcut("saveRecord"))) {
        const form = document.getElementById("record-describe-form");
        if (form instanceof HTMLFormElement) {
          event.preventDefault();
          form.requestSubmit();
        }
        return;
      }

      if (isTypingTarget(event.target)) return;

      if (matchesKeyEvent(event, getShortcut("focusComments"))) {
        const comment = document.querySelector<HTMLTextAreaElement>("#record-comment-form textarea");
        if (comment) {
          event.preventDefault();
          comment.focus();
          comment.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (matchesKeyEvent(event, getShortcut("focusTags"))) {
        const tagsInput = document.getElementById("record-tags-input");
        if (tagsInput instanceof HTMLInputElement) {
          event.preventDefault();
          tagsInput.focus();
          tagsInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleOcr() {
    if (state.status !== "ready") return;
    const source = deriveRecordSourcePath(state.record);
    if (!source) return;

    setOcrState({ status: "creating" });
    const response = await api.createMediaJob({
      recordId: id,
      operation: "ocr",
      sourcePath: source.sourcePath,
      ...(source.disk ? { options: { disk: source.disk } } : {})
    });

    if (!response.ok) {
      setOcrState({ status: "error", message: response.error });
      return;
    }

    setOcrState({ status: "success", jobId: response.job.id });
  }

  async function refreshRelationGraph() {
    const response = await api.relationGraph({ recordId: id, limit: 32 });
    if (!response.ok) {
      throw new Error(response.error || t.pages.archiveDetail.relations.refreshError);
    }

    setState((current) => current.status === "ready" ? { ...current, relationGraph: response } : current);
  }

  async function handleCreateRelation(payload: CreateRelationPayload) {
    const response = await api.createRelation(payload);
    if (!response.ok) {
      throw new Error(response.error || t.pages.archiveDetail.relations.createError);
    }

    await refreshRelationGraph();
  }

  async function handleUpdateRelation(relationId: string, payload: UpdateRelationPayload) {
    const response = await api.updateRelation(relationId, payload);
    if (!response.ok) {
      throw new Error(response.error || t.pages.archiveDetail.relations.updateError);
    }

    await refreshRelationGraph();
  }

  async function handleDeleteRelation(relationId: string) {
    const response = await api.deleteRelation(relationId);
    if (!response.ok) {
      throw new Error(response.error || t.pages.archiveDetail.relations.deleteError);
    }

    await refreshRelationGraph();
  }

  async function handleSaveRecord(patch: RecordDescribePatch) {
    if (state.status !== "ready") return;
    const store = state.record.store || "archive-items";
    const updated: ArchiveRecord = {
      ...state.record,
      title: patch.title,
      description: patch.description,
      type: patch.type,
      subtype: patch.subtype,
      tags: patch.tags,
      updatedAt: new Date().toISOString()
    };

    const response = await api.bulkRecords({ store, records: [updated] });
    if (!response.ok) {
      throw new Error(response.error || t.pages.archiveDetail.page.saveDescriptionError);
    }

    setState((current) => (current.status === "ready" ? { ...current, record: updated } : current));
    const suggestionsResponse = await api.suggestions({ context: "detail", recordId: id });
    setSuggestions(suggestionsResponse.ok ? suggestionsResponse.suggestions : []);
  }

  async function handleSuggestionFeedback(suggestion: ArchiveSuggestion, value: SuggestionFeedbackValue) {
    const response = await api.submitSuggestionFeedback(suggestion.key, { value, context: "detail" });
    if (!response.ok) throw new Error(response.error || t.pages.archiveDetail.suggestions.feedbackError);
    if (value === "dismissed") setSuggestions((current) => current.filter((item) => item.key !== suggestion.key));
  }

  async function handleAiAssist(): Promise<RecordAiAssist> {
    const response = await api.recordAiAssist(id);
    if (!response.ok) throw new Error(response.error || t.pages.archiveDetail.aiAssist.analyzeError);
    return response;
  }

  async function handleCreateNote(payload: { body: string; timestampSeconds?: number | null }) {
    if (state.status !== "ready") return;
    const response = await api.createRecordNote(id, payload, state.record.store || "archive-items");
    if (!response.ok) {
      throw new Error(response.error || t.pages.archiveDetail.notes.saveError);
    }
    setState((current) => current.status === "ready"
      ? { ...current, notes: sortRecordNotes([...current.notes, response.note]) }
      : current);
  }

  async function handleDeleteNote(noteId: string) {
    if (state.status !== "ready") return;
    const response = await api.deleteRecordNote(noteId);
    if (!response.ok) {
      setState((current) => current.status === "ready" ? { ...current } : current);
      return;
    }
    setState((current) => current.status === "ready"
      ? { ...current, notes: current.notes.filter((note) => note.id !== noteId) }
      : current);
  }

  async function handleCreateComment(payload: { body: string }) {
    if (state.status !== "ready") return;
    const response = await api.createRecordComment(id, payload, state.record.store || "archive-items");
    if (!response.ok) {
      throw new Error(response.error || t.pages.archiveDetail.comments.postError);
    }
    setState((current) => current.status === "ready"
      ? { ...current, comments: [...current.comments, response.comment] }
      : current);
  }

  async function handleDeleteComment(commentId: string) {
    if (state.status !== "ready") return;
    const response = await api.deleteRecordComment(commentId);
    if (!response.ok) {
      setState((current) => current.status === "ready" ? { ...current } : current);
      return;
    }
    setState((current) => current.status === "ready"
      ? { ...current, comments: current.comments.filter((comment) => comment.id !== commentId) }
      : current);
  }

  async function handleCreateFieldRequest(payload: { field: string; message: string; assignee?: string; dueDate?: string }) {
    if (state.status !== "ready") return;
    const response = await api.createRecordFieldRequest(id, payload);
    if (!response.ok) throw new Error(response.error || t.pages.archiveDetail.fieldRequests.createError);
    setState((current) => current.status === "ready"
      ? { ...current, fieldRequests: [...current.fieldRequests, response.request] }
      : current);
  }

  async function handleResolveFieldRequest(requestId: string) {
    const response = await api.resolveFieldRequest(requestId);
    if (!response.ok) throw new Error(response.error || t.pages.archiveDetail.fieldRequests.resolveThrowError);
    setState((current) => current.status === "ready"
      ? { ...current, fieldRequests: current.fieldRequests.map((request) => request.id === requestId ? response.request : request) }
      : current);
  }

  const detailDescription =
    state.status === "ready"
      ? state.record.description || t.pages.archiveDetail.page.defaultDescription
      : state.status === "error"
        ? t.pages.archiveDetail.page.loadErrorDescription
        : t.pages.archiveDetail.page.loadingDescription;
  const playerHref = state.status === "ready" ? mediaPlayerHref(state.record, id) : null;

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (!id) {
        setState({ status: "error", message: t.pages.archiveDetail.page.invalidRecordId });
        return;
      }

      setState({ status: "loading" });

      // Fetch record
      const recordResponse = await api.record(id);
      if (!recordResponse.ok) {
        if (!active) return;
        setState({ status: "error", message: recordResponse.error });
        return;
      }

      if (!active) return;

      setState({
        status: "ready",
        record: recordResponse.record,
        rights: null,
        relationGraph: null,
        notes: [],
        notesLoading: true,
        notesError: null,
        comments: [],
        commentsLoading: true,
        commentsError: null,
        fieldRequests: [],
        fieldRequestsLoading: true,
        fieldRequestsError: null,
        history: [],
        historyLoading: true,
        historyError: null
      });
      void api.favorites().then((response) => {
        if (active && response.ok) setIsFav(response.favorites.some((favorite) => favorite.recordId === id));
      });
      setInBasket(isInBasket(id));
      setInQueue(isInQueue(id));
      setLaterEntry(getLaterEntry(id));
      recordView(id, recordResponse.record.title, recordResponse.record.type);

      void api.suggestions({ context: "detail", recordId: id })
        .then((response) => {
          if (!active) return;
          setSuggestions(response.ok ? response.suggestions : []);
        })
        .catch(() => {});

      void api.rights(id)
        .then((response) => {
          if (!active || !response.ok) return;
          setState((current) => current.status === "ready" ? { ...current, rights: response.record } : current);
        })
        .catch(() => {});

      void api.relationGraph({ recordId: id, limit: 32 })
        .then((response) => {
          if (!active || !response.ok) return;
          setState((current) => current.status === "ready" ? { ...current, relationGraph: response } : current);
        })
        .catch(() => {});

      const recordStore = recordResponse.record.store || "archive-items";

      void api.recordNotes(id, recordStore)
        .then((response) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                notes: response.ok ? response.notes : [],
                notesLoading: false,
                notesError: response.ok ? null : response.error || t.pages.archiveDetail.notes.loadError
              }
            : current);
        })
        .catch((error) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                notesLoading: false,
                notesError: error instanceof Error ? error.message : t.pages.archiveDetail.notes.loadError
              }
            : current);
        });

      void api.recordComments(id, recordStore)
        .then((response) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                comments: response.ok ? response.comments : [],
                commentsLoading: false,
                commentsError: response.ok ? null : response.error || t.pages.archiveDetail.comments.loadError
              }
            : current);
        })
        .catch((error) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                commentsLoading: false,
                commentsError: error instanceof Error ? error.message : t.pages.archiveDetail.comments.loadError
              }
            : current);
        });

      void api.recordFieldRequests(id)
        .then((response) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                fieldRequests: response.ok ? response.requests : [],
                fieldRequestsLoading: false,
                fieldRequestsError: response.ok ? null : response.error || t.pages.archiveDetail.fieldRequests.loadError
              }
            : current);
        })
        .catch((error) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                fieldRequestsLoading: false,
                fieldRequestsError: error instanceof Error ? error.message : t.pages.archiveDetail.fieldRequests.loadError
              }
            : current);
        });

      void api.recordHistory(id, { limit: 50, store: recordStore })
        .then((response) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                history: response.ok ? response.entries : [],
                historyLoading: false,
                historyError: response.ok ? null : response.error || t.pages.archiveDetail.history.loadError
              }
            : current);
        })
        .catch((error) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                historyLoading: false,
                historyError: error instanceof Error ? error.message : t.pages.archiveDetail.history.loadError
              }
            : current);
        });
    };

    loadDetail();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t only affects fallback error copy, not fetch identity
  }, [id, api]);

  async function toggleSavedFavorite() {
    if (state.status !== "ready") return;
    const response = isFav
      ? await api.removeFavorite(id, state.record.store || undefined)
      : await api.addFavorite({ recordId: id, store: state.record.store || undefined });
    if (response.ok) setIsFav(!isFav);
  }

  return (
    <AppShell
      subtitle={t.pageTitles.recordDetails}
      navLabel={t.pageTitles.recordDetails}
      contentClassName="archive-content"
      breadcrumbExtra={[{ label: state.status === "ready" ? state.record.title || copy.untitledRecord : copy.defaultTitle }]}
    >
      <PageToolbar
        eyebrow={<span className="badge">{copy.defaultTitle}</span>}
        title={state.status === "ready" ? state.record.title || copy.untitledRecord : copy.defaultTitle}
        description={detailDescription}
        meta={
          state.status === "ready" ? (
            <>
              {state.record.store ? <span className="badge">{state.record.store}</span> : null}
              {state.record.type ? <span className="badge">{state.record.type}</span> : null}
              {state.record.subtype ? <span className="badge">{state.record.subtype}</span> : null}
              {state.record.updatedAt ? (
                <span className="badge">
                  {new Date(state.record.updatedAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-SA")}
                </span>
              ) : null}
            </>
          ) : null
        }
        actions={
          <>
            <Link href="/archive" className="button button-secondary">
              {copy.backToArchive}
            </Link>
            {/* V14-AUDIT-012: favorite is the one toggle that earns toolbar space;
                the other six actions wait behind "more actions". */}
            {state.status === "ready" ? (
              <button
                type="button"
                onClick={() => void toggleSavedFavorite()}
                className={`button ${isFav ? "button-primary" : "button-secondary"}`}
                aria-pressed={isFav}
                title={isFav ? copy.removeFavorite : copy.addFavorite}
              >
                {isFav ? copy.removeFavorite : copy.addFavorite}
              </button>
            ) : null}
            {state.status === "ready" ? (
              <DisclosureToolbar summary={copy.moreActionsLabel}>
            <Link href={`/copilot?recordId=${encodeURIComponent(id)}`} className="button button-secondary">
              {copy.askCopilot}
            </Link>
            {playerHref ? <Link href={playerHref} className="button button-secondary">{copy.playMedia}</Link> : null}
            {state.status === "ready" ? (
              <button
                type="button"
                onClick={() => {
                  setInBasket(toggleBasket(id, { title: state.record.title, type: state.record.type }));
                }}
                className={`button ${inBasket ? "button-primary" : "button-secondary"}`}
                aria-pressed={inBasket}
                title={inBasket ? copy.removeFromBasketTitle : copy.addToBasketTitle}
              >
                {inBasket ? copy.removeFromBasketLabel : copy.addToBasketLabel}
              </button>
            ) : null}
            {state.status === "ready" ? (
              <button
                type="button"
                onClick={() => {
                  setInQueue(toggleQueue(id, { title: state.record.title, type: state.record.type }));
                }}
                className={`button ${inQueue ? "button-primary" : "button-secondary"}`}
                aria-pressed={inQueue}
                title={inQueue ? copy.removeFromQueueTitle : copy.addToQueueTitle}
              >
                {inQueue ? copy.removeFromQueueLabel : copy.addToQueueLabel}
              </button>
            ) : null}
            {state.status === "ready" ? (
              <button
                type="button"
                onClick={() => {
                  if (laterEntry) {
                    removeLater(id);
                    setLaterEntry(null);
                    setLaterFormOpen(false);
                  } else {
                    setLaterReason("");
                    setLaterReviewDate("");
                    setLaterFormOpen((open) => !open);
                  }
                }}
                className={`button ${laterEntry ? "button-primary" : "button-secondary"}`}
                aria-pressed={Boolean(laterEntry)}
                title={laterEntry ? copy.cancelDeferLabel : copy.deferTitleHint}
              >
                {laterEntry ? copy.cancelDeferLabel : copy.deferButtonLabel}
              </button>
            ) : null}
            {state.status === "ready" ? (
              <button
                type="button"
                onClick={handleOcr}
                disabled={!deriveRecordSourcePath(state.record) || ocrState.status === "creating"}
                className="button button-secondary"
                title={!deriveRecordSourcePath(state.record) ? copy.noSourcePathTitle : undefined}
              >
                {ocrState.status === "creating" ? copy.creatingOcrLabel : copy.extractOcrLabel}
              </button>
            ) : null}
              </DisclosureToolbar>
            ) : null}
          </>
        }
      />
      {state.status === "ready" ? <RecordPresence recordId={id} /> : null}

      {state.status === "ready" && !deriveRecordSourcePath(state.record) && (
        <p className="helper-text">{copy.noSourcePathHelper}</p>
      )}

      {ocrState.status === "success" && (
        <div className="state-banner state-banner-success">
          <strong>{copy.ocrSuccessMessage}</strong>
          <Link href="/media/jobs" className="button button-secondary">{copy.viewMediaJobs}</Link>
        </div>
      )}

      {ocrState.status === "error" && (
        <div className="state-banner state-banner-error">
          <strong>{copy.ocrErrorPrefix.replace("{message}", ocrState.message)}</strong>
        </div>
      )}

      {state.status === "loading" && (
        <div className="panel panel-compact">
          <Skeleton label={copy.loadingRecordLabel} />
        </div>
      )}

      {state.status === "error" && (
        <EmptyState
          title={copy.errorTitle}
          description={state.message}
          actions={<Link href="/archive" className="button button-secondary">{copy.backToArchive}</Link>}
        />
      )}

      {state.status === "ready" && (
        <div className="split-layout archive-detail-layout" aria-label={copy.defaultTitle}>
          <div className="page-section">
            {laterEntry ? (
              <div className="panel panel-compact" role="status">
                <p>
                  <strong>{copy.deferredLabel}</strong> {laterEntry.reason}
                  {laterEntry.reviewDate ? copy.deferredReviewDateSuffix.replace("{date}", laterEntry.reviewDate) : ""}
                </p>
              </div>
            ) : laterFormOpen ? (
              <form
                className="panel panel-compact stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!laterReason.trim()) return;
                  deferRecord(id, {
                    title: state.record.title,
                    type: state.record.type,
                    reason: laterReason.trim(),
                    reviewDate: laterReviewDate || null
                  });
                  setLaterEntry(getLaterEntry(id));
                  setLaterFormOpen(false);
                }}
              >
                <label className="form-field">
                  <span>{copy.deferReasonLabel}</span>
                  <input
                    type="text"
                    value={laterReason}
                    onChange={(event) => setLaterReason(event.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <label className="form-field">
                  <span>{copy.deferReviewDateLabel}</span>
                  <input
                    type="date"
                    value={laterReviewDate}
                    onChange={(event) => setLaterReviewDate(event.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button type="submit" className="button button-primary">{copy.deferSubmitButton}</button>
                  <button type="button" className="button button-secondary" onClick={() => setLaterFormOpen(false)}>
                    {copy.deferCancelButton}
                  </button>
                </div>
              </form>
            ) : null}
            <RecordReadinessPanel
              record={state.record}
              rights={state.rights}
              hasTeamComments={state.comments.length > 0}
            />
            <article className="panel">
              <div className="panel-section-header">
                <h2>{t.pages.archiveDetail.recordInfo.title}</h2>
              </div>

              <div className="kv-grid">
                <div className="kv-item">
                  <strong>{t.pages.archiveDetail.recordInfo.idLabel}</strong>
                  <span className="wrap-anywhere">{state.record.id}</span>
                </div>

                {state.record.uid ? (
                  <div className="kv-item">
                    <strong>UID</strong>
                    <span className="wrap-anywhere">{state.record.uid}</span>
                  </div>
                ) : null}

                {state.record.store ? (
                  <div className="kv-item">
                    <strong>{t.pages.archiveDetail.recordInfo.storeLabel}</strong>
                    <span>{state.record.store}</span>
                  </div>
                ) : null}

                {state.record.type ? (
                  <div className="kv-item">
                    <strong>{t.pages.archiveDetail.recordInfo.typeLabel}</strong>
                    <span>{state.record.type}</span>
                  </div>
                ) : null}

                {state.record.subtype ? (
                  <div className="kv-item">
                    <strong>{t.pages.archiveDetail.recordInfo.subtypeLabel}</strong>
                    <span>{state.record.subtype}</span>
                  </div>
                ) : null}

                {state.record.createdAt ? (
                  <div className="kv-item">
                    <strong>{t.pages.archiveDetail.recordInfo.createdLabel}</strong>
                    <time className="mono-text">
                      {new Date(state.record.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-SA")}
                    </time>
                  </div>
                ) : null}

                {state.record.updatedAt ? (
                  <div className="kv-item">
                    <strong>{t.pages.archiveDetail.recordInfo.updatedLabel}</strong>
                    <time className="mono-text">
                      {new Date(state.record.updatedAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-SA")}
                    </time>
                  </div>
                ) : null}
              </div>

              {state.record.tags && state.record.tags.length > 0 ? (
                <div className="section-divider">
                  <strong>{t.pages.archiveDetail.recordInfo.tagsLabel}</strong>
                  <div className="tags">
                    {state.record.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
            <RecordReadSurfacePanel record={state.record} />
            <RecordAiAssistPanel onAnalyze={handleAiAssist} canEdit={canEditRecords} />
            <SuggestionsPanel suggestions={suggestions} title={copy.suggestionsTitle} onFeedback={handleSuggestionFeedback} />
            {canEditRecords && <RecordDescribeForm key={id} record={state.record} onSave={handleSaveRecord} />}
            <RecordNotesPanel
              notes={state.notes}
              loading={state.notesLoading}
              error={state.notesError}
              onCreate={handleCreateNote}
              onDelete={handleDeleteNote}
            />
            <RecordCommentsPanel
              comments={state.comments}
              loading={state.commentsLoading}
              error={state.commentsError}
              onCreate={handleCreateComment}
              onDelete={handleDeleteComment}
            />
            <RecordFieldRequestsPanel
              requests={state.fieldRequests}
              loading={state.fieldRequestsLoading}
              error={state.fieldRequestsError}
              onCreate={handleCreateFieldRequest}
              onResolve={handleResolveFieldRequest}
              canEdit={canEditRecords}
            />
          </div>

          <div className="page-section">
            <article className="panel">
              <div className="panel-section-header">
                <h2>{t.pages.archiveDetail.rights.title}</h2>
              </div>

              {state.rights ? (
                <>
                  <div className="kv-grid">
                    <div className="kv-item">
                      <strong>{t.pages.archiveDetail.rights.holderLabel}</strong>
                      <span>{state.rights.rightsHolder}</span>
                    </div>

                    <div className="kv-item">
                      <strong>{t.pages.archiveDetail.rights.licenseLabel}</strong>
                      <span className="badge">{state.rights.licenseType}</span>
                    </div>

                    {state.rights.embargoStart ? (
                      <div className="kv-item">
                        <strong>{t.pages.archiveDetail.rights.embargoStartLabel}</strong>
                        <time className="mono-text">
                          {new Date(state.rights.embargoStart).toLocaleDateString(locale === "en" ? "en-US" : "ar-SA")}
                        </time>
                      </div>
                    ) : null}

                    {state.rights.embargoEnd ? (
                      <div className="kv-item">
                        <strong>{t.pages.archiveDetail.rights.embargoEndLabel}</strong>
                        <time className="mono-text">
                          {new Date(state.rights.embargoEnd).toLocaleDateString(locale === "en" ? "en-US" : "ar-SA")}
                        </time>
                      </div>
                    ) : null}

                    {state.rights.expiresAt ? (
                      <div className="kv-item">
                        <strong>{t.pages.archiveDetail.rights.expiresLabel}</strong>
                        <time className="mono-text">
                          {new Date(state.rights.expiresAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-SA")}
                        </time>
                      </div>
                    ) : null}
                  </div>

                  {state.rights.geoRestrictions && state.rights.geoRestrictions.length > 0 ? (
                    <div className="section-divider">
                      <strong>{t.pages.archiveDetail.rights.geoRestrictionsLabel}</strong>
                      <div className="tags">
                        {state.rights.geoRestrictions.map((restriction) => (
                          <span key={restriction} className="tag">
                            {restriction}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {state.rights.notes ? (
                    <div className="section-divider">
                      <strong>{t.pages.archiveDetail.rights.notesLabel}</strong>
                      <p>{state.rights.notes}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title={t.pages.archiveDetail.rights.emptyTitle}
                  description={t.pages.archiveDetail.rights.emptyDescription}
                />
              )}
            </article>
            <RelationPreviewPanel
              graph={state.relationGraph}
              recordId={id}
              onCreate={handleCreateRelation}
              onUpdate={handleUpdateRelation}
              onDelete={handleDeleteRelation}
              canEdit={canEditRecords}
            />
            <GeotagPanel
              record={state.record}
              onRecordUpdate={(updated) => setState((current) => (current.status === "ready" ? { ...current, record: updated } : current))}
            />
            <RecordAttachmentsPanel recordId={id} store={state.record.store || "archive-items"} />
            <RecordSourceReplacementPanel recordId={id} canEdit={canEditRecords} />
            <RecordChangeImpactPanel recordId={id} canEdit={canEditRecords} />
            <MediaDerivativesTree record={state.record} />
            <RecordHistoryPanel
              entries={state.history}
              loading={state.historyLoading}
              error={state.historyError}
            />
            <BroadcastMetadataPanel recordId={id} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
