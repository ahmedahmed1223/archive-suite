"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import BroadcastMetadataPanel from "@/components/BroadcastMetadataPanel";
import EmptyState from "@/components/EmptyState";
import MentionTextarea from "@/components/MentionTextarea";
import PageToolbar from "@/components/PageToolbar";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import GeotagPanel from "./GeotagPanel";
import MediaDerivativesTree from "./MediaDerivativesTree";
import {
  createArchiveApiClient,
  deriveRecordSourcePath,
  type ArchiveRecord,
  type ArchiveSuggestion,
  type CreateRelationPayload,
  type RecordComment,
  type RecordHistoryEntry,
  type RecordNote,
  type RelationGraphEdge,
  type RelationGraphPayload,
  type RelationTypeKey,
  type UpdateRelationPayload,
  type RightsRecord,
  type SuggestionFeedbackValue
} from "@/lib/archive-api";
import { isFavorited, toggleFavorite } from "@/lib/favorites";
import { recordView } from "@/lib/recent-items";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard";
import RecordPresence from "@/components/RecordPresence";
import RecordAttachmentsPanel from "@/components/RecordAttachmentsPanel";

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

function relationEdgeSummary(edge: RelationGraphEdge) {
  if (edge.kind === "manual") {
    return edge.note || edge.label;
  }

  if (edge.kind === "shared-tag" && edge.sharedTags?.length) {
    return edge.sharedTags.join("، ");
  }

  if (edge.kind === "same-type" && edge.sharedType) {
    return edge.sharedType;
  }

  return edge.label;
}

function mediaPlayerHref(record: ArchiveRecord, recordId: string): string | null {
  const source = deriveRecordSourcePath(record);
  if (!source) return null;

  const params = new URLSearchParams({ path: source.sourcePath, recordId });
  if (source.disk) params.set("disk", source.disk);
  return `/media/play?${params.toString()}`;
}

function RelationPreviewPanel({
  graph,
  recordId,
  onCreate,
  onUpdate,
  onDelete
}: Readonly<{
  graph: RelationGraphPayload | null;
  recordId: string;
  onCreate: (payload: CreateRelationPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateRelationPayload) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}>) {
  const dialogs = useConfirmDialog();
  const relationTypes = graph?.relationTypes?.length
    ? graph.relationTypes
    : [{ key: "related_to" as RelationTypeKey, label: "مرتبط بـ", inverse: "related_to", bidirectional: true }];
  const nodesById = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
  const edges = (graph?.edges ?? []).filter((edge) => edge.source === recordId || edge.target === recordId);
  const manualEdges = edges.filter((edge) => edge.kind === "manual" && edge.relationId);
  const manualCount = manualEdges.length;
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<RelationTypeKey>("related_to");
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { type: RelationTypeKey; note: string }>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function relationTypeFromEdge(edge: RelationGraphEdge): RelationTypeKey {
    return relationTypes.some((option) => option.key === edge.type) ? (edge.type as RelationTypeKey) : "related_to";
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetId.trim() || busy) return;

    setBusy(true);
    setStatus("");
    try {
      await onCreate({
        sourceId: recordId,
        targetId: targetId.trim(),
        type,
        ...(note.trim() ? { note: note.trim() } : {})
      });
      setTargetId("");
      setNote("");
      setStatus("تم إنشاء العلاقة.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر إنشاء العلاقة.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(edge: RelationGraphEdge) {
    if (!edge.relationId || busy) return;
    const draft = drafts[edge.relationId] ?? { type: relationTypeFromEdge(edge), note: edge.note || "" };

    setBusy(true);
    setStatus("");
    try {
      await onUpdate(edge.relationId, {
        type: draft.type,
        note: draft.note.trim() || null
      });
      setStatus("تم تحديث العلاقة.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر تحديث العلاقة.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(edge: RelationGraphEdge) {
    if (!edge.relationId || busy) return;
    const confirmed = await dialogs.confirm({
      title: "حذف العلاقة",
      message: "سيتم حذف هذه العلاقة اليدوية بين السجلين. هل تريد المتابعة؟",
      confirmLabel: "حذف",
      destructive: true
    });
    if (!confirmed) return;

    setBusy(true);
    setStatus("");
    try {
      await onDelete(edge.relationId);
      setStatus("تم حذف العلاقة.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر حذف العلاقة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>العلاقات</h2>
          <p className="helper-text">روابط يدوية ومستنتجة حول هذا السجل.</p>
        </div>
        <span className="badge">{edges.length} صلات</span>
      </div>

      {edges.length ? (
        <>
          <div className="kv-grid">
            <div className="kv-item">
              <strong>يدوية</strong>
              <span>{manualCount}</span>
            </div>
            <div className="kv-item">
              <strong>مستنتجة</strong>
              <span>{edges.length - manualCount}</span>
            </div>
          </div>
          <ul className="graph-relation-list">
            {edges.slice(0, 6).map((edge) => {
              const otherId = edge.source === recordId ? edge.target : edge.source;
              const otherNode = nodesById.get(otherId);

              return (
                <li key={edge.id}>
                  <span>
                    <b>{edge.label}</b>
                    <small>{otherNode?.label || otherId} · {relationEdgeSummary(edge)}</small>
                  </span>
                  <a className="badge" href={`/archive/${encodeURIComponent(otherId)}`}>فتح</a>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <EmptyState
          title="لا توجد علاقات ظاهرة لهذا السجل"
          description="افتح خريطة العلاقات لإنشاء علاقة يدوية أو تحسين الوسوم حتى تظهر الروابط المستنتجة."
        />
      )}

      <a className="button button-primary" href={`/graph?recordId=${encodeURIComponent(recordId)}`}>
        فتح خريطة العلاقات
      </a>

      <form className="auth-form relation-inline-form" onSubmit={handleCreate}>
        <div className="panel-section-header">
          <h3>إضافة علاقة من هنا</h3>
        </div>
        <div className="field-row">
          <label>
            السجل الهدف
            <input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="UID أو ID" dir="ltr" />
          </label>
          <label>
            نوع العلاقة
            <select value={type} onChange={(event) => setType(event.target.value as RelationTypeKey)}>
              {relationTypes.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          ملاحظة
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="سبب الربط أو سياقه" />
        </label>
        <button type="submit" className="button button-secondary" disabled={busy || !targetId.trim()}>
          إضافة علاقة
        </button>
      </form>

      {manualEdges.length ? (
        <div className="relation-editor-list">
          <div className="panel-section-header">
            <h3>تعديل العلاقات اليدوية</h3>
          </div>
          {manualEdges.map((edge) => {
            const relationId = edge.relationId || edge.id;
            const draft = edge.relationId && drafts[edge.relationId]
              ? drafts[edge.relationId]
              : { type: relationTypeFromEdge(edge), note: edge.note || "" };
            const otherId = edge.source === recordId ? edge.target : edge.source;
            const otherNode = nodesById.get(otherId);

            return (
              <div key={edge.id} className="relation-editor-row">
                <strong>{otherNode?.label || otherId}</strong>
                <select
                  value={draft.type}
                  onChange={(event) => edge.relationId && setDrafts((current) => ({
                    ...current,
                    [edge.relationId!]: { ...draft, type: event.target.value as RelationTypeKey }
                  }))}
                >
                  {relationTypes.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
                <input
                  value={draft.note}
                  onChange={(event) => edge.relationId && setDrafts((current) => ({
                    ...current,
                    [edge.relationId!]: { ...draft, note: event.target.value }
                  }))}
                  placeholder="ملاحظة العلاقة"
                />
                <button type="button" className="button button-secondary button-sm" onClick={() => void handleUpdate(edge)} disabled={busy || !edge.relationId}>
                  حفظ
                </button>
                <button type="button" className="button button-danger button-sm" onClick={() => void handleDelete(edge)} disabled={busy || !edge.relationId}>
                  حذف
                </button>
                <span className="helper-text mono-text">{relationId}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {status ? <p className="form-status">{status}</p> : null}
    </article>
  );
}

function formatNoteTime(seconds: unknown) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const whole = Math.floor(total);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

function noteAnchor(note: RecordNote) {
  if (note.timestampSeconds !== null && note.timestampSeconds !== undefined) {
    return `عند ${formatNoteTime(note.timestampSeconds)}`;
  }

  if (note.region) {
    return "منطقة محددة";
  }

  return "ملاحظة عامة";
}

function sortRecordNotes(notes: RecordNote[]) {
  return [...notes].sort((left, right) => {
    const leftTime = left.timestampSeconds;
    const rightTime = right.timestampSeconds;
    if (leftTime !== null && leftTime !== undefined && rightTime !== null && rightTime !== undefined && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    if (leftTime !== null && leftTime !== undefined) return -1;
    if (rightTime !== null && rightTime !== undefined) return 1;
    return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
  });
}

function RecordNotesPanel({
  notes,
  loading,
  error,
  onCreate,
  onDelete
}: Readonly<{
  notes: RecordNote[];
  loading: boolean;
  error: string | null;
  onCreate: (payload: { body: string; timestampSeconds?: number | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}>) {
  const [body, setBody] = useState("");
  const [timestampText, setTimestampText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || busy) return;

    const parsedTimestamp = timestampText.trim() === "" ? null : Number(timestampText);
    if (parsedTimestamp !== null && (!Number.isFinite(parsedTimestamp) || parsedTimestamp < 0)) {
      setStatus("أدخل وقتاً صحيحاً بالثواني أو اتركه فارغاً.");
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      await onCreate({ body: trimmed, timestampSeconds: parsedTimestamp });
      setBody("");
      setTimestampText("");
      setStatus("تم حفظ الملاحظة.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر حفظ الملاحظة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel record-notes-panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>ملاحظاتي</h2>
          <p className="helper-text">ملاحظات خاصة بالسجل، عامة أو مرتبطة بزمن داخل المادة.</p>
        </div>
        <span className="badge">{notes.length} ملاحظات</span>
      </div>

      {loading ? (
        <Skeleton label="جار تحميل الملاحظات..." />
      ) : null}

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل الملاحظات</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      <form className="auth-form record-note-form" onSubmit={handleSubmit}>
        <label>
          ملاحظة جديدة
          <MentionTextarea
            value={body}
            onChange={setBody}
            placeholder="اكتب ملاحظة شخصية عن هذا السجل... استخدم @ للإشارة لزميل"
            rows={4}
          />
        </label>
        <div className="field-row">
          <label>
            توقيت اختياري بالثواني
            <input
              inputMode="decimal"
              value={timestampText}
              onChange={(event) => setTimestampText(event.target.value)}
              placeholder="مثال: 83"
            />
          </label>
          <button type="submit" className="button button-primary" disabled={busy || !body.trim()}>
            {busy ? "جار الحفظ..." : "إضافة ملاحظة"}
          </button>
        </div>
        {status ? <p className="form-status">{status}</p> : null}
      </form>

      {!loading && notes.length ? (
        <ul className="record-note-list">
          {notes.map((note) => (
            <li key={note.id}>
              <div>
                <div className="helper-row">
                  <span className="badge">{noteAnchor(note)}</span>
                  <span className="helper-text">{note.authorName || "مجهول"}</span>
                </div>
                <p>{note.body}</p>
                {note.createdAt ? (
                  <small className="helper-text">{new Date(note.createdAt).toLocaleString("ar-SA")}</small>
                ) : null}
              </div>
              <button
                type="button"
                className="button button-danger button-sm"
                onClick={() => void onDelete(note.id)}
                aria-label="حذف الملاحظة"
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <EmptyState
          title="لا توجد ملاحظات بعد"
          description="أضف ملاحظة عامة أو اربطها بزمن داخل المادة لاستخدامها لاحقاً في المراجعة."
        />
      ) : null}
    </article>
  );
}

function RecordCommentsPanel({
  comments,
  loading,
  error,
  onCreate,
  onDelete
}: Readonly<{
  comments: RecordComment[];
  loading: boolean;
  error: string | null;
  onCreate: (payload: { body: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}>) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setStatus("");
    try {
      await onCreate({ body: trimmed });
      setBody("");
      setStatus("تم نشر التعليق.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر نشر التعليق.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel record-comments-panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>تعليقات الفريق</h2>
          <p className="helper-text">تعليقات مرئية للفريق حول هذا السجل، موثقة في سجل التدقيق.</p>
        </div>
        <span className="badge">{comments.length} تعليقات</span>
      </div>

      {loading ? (
        <Skeleton label="جار تحميل التعليقات..." />
      ) : null}

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل التعليقات</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      <form className="auth-form record-note-form" onSubmit={handleSubmit}>
        <label>
          تعليق جديد
          <MentionTextarea
            value={body}
            onChange={setBody}
            placeholder="اكتب تعليقاً يراه بقية أعضاء الفريق... استخدم @ للإشارة لزميل"
            rows={3}
          />
        </label>
        <button type="submit" className="button button-primary" disabled={busy || !body.trim()}>
          {busy ? "جار النشر..." : "نشر التعليق"}
        </button>
        {status ? <p className="form-status">{status}</p> : null}
      </form>

      {!loading && comments.length ? (
        <ul className="record-note-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div>
                <div className="helper-row">
                  <span className="helper-text">{comment.authorName || "مجهول"}</span>
                </div>
                <p>{comment.body}</p>
                {comment.createdAt ? (
                  <small className="helper-text">{new Date(comment.createdAt).toLocaleString("ar-SA")}</small>
                ) : null}
              </div>
              <button
                type="button"
                className="button button-danger button-sm"
                onClick={() => void onDelete(comment.id)}
                aria-label="حذف التعليق"
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <EmptyState
          title="لا توجد تعليقات بعد"
          description="أضف أول تعليق فريق حول هذا السجل."
        />
      ) : null}
    </article>
  );
}

function historyEventLabel(entry: RecordHistoryEntry) {
  const labels: Record<string, string> = {
    "record_notes.create": "إضافة ملاحظة خاصة",
    "record_notes.update": "تحديث ملاحظة خاصة",
    "record_notes.delete": "حذف ملاحظة خاصة",
    "record_comments.create": "إضافة تعليق فريق",
    "record_comments.delete": "حذف تعليق فريق",
    "relations.create": "إضافة علاقة",
    "relations.delete": "حذف علاقة",
    "rights.upsert": "تحديث الحقوق"
  };

  return labels[entry.event] || entry.event;
}

function metadataObject(entry: RecordHistoryEntry) {
  return entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
    ? entry.metadata
    : null;
}

function auditDiffFields(entry: RecordHistoryEntry) {
  const metadata = metadataObject(entry);
  const diff = metadata?.["diff"];
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return [];
  const fields = (diff as Record<string, unknown>)["fields"];
  return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === "string") : [];
}

type AuditComparison = Readonly<{
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}>;

function nonEmptyObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length
    ? value as Record<string, unknown>
    : null;
}

function auditComparison(entry: RecordHistoryEntry): AuditComparison | null {
  const metadata = metadataObject(entry);
  const diff = nonEmptyObject(metadata?.["diff"]);
  const before = nonEmptyObject(diff?.["before"]);
  const after = nonEmptyObject(diff?.["after"]);

  return before && after ? { before, after } : null;
}

function auditValue(value: unknown): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value);

  try {
    return JSON.stringify(value) ?? "—";
  } catch {
    return "—";
  }
}

function auditRequestPayload(entry: RecordHistoryEntry) {
  const metadata = metadataObject(entry);
  const request = metadata?.["request"];
  return request && typeof request === "object" ? request : null;
}

function auditRestoreDecision(entry: RecordHistoryEntry) {
  const metadata = metadataObject(entry);
  const decision = metadata?.["restoreDecision"];
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) return null;

  const value = decision as Record<string, unknown>;
  return {
    available: value["available"] === true,
    label: typeof value["label"] === "string" ? value["label"] : "قرار استعادة",
    reason: typeof value["reason"] === "string" ? value["reason"] : ""
  };
}

function RecordHistoryPanel({
  entries,
  loading,
  error
}: Readonly<{
  entries: RecordHistoryEntry[];
  loading: boolean;
  error: string | null;
}>) {
  return (
    <article className="panel record-history-panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>سجل التغييرات</h2>
          <p className="helper-text">تاريخ التغييرات المدعوم بسجل التدقيق لهذا السجل.</p>
        </div>
        <span className="badge">{entries.length} أحداث</span>
      </div>

      {loading ? (
        <Skeleton label="جار تحميل السجل..." />
      ) : null}

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل سجل التغييرات</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      {!loading && entries.length ? (
        <ul className="record-history-list">
          {entries.map((entry) => {
            const fields = auditDiffFields(entry);
            const comparison = auditComparison(entry);
            const payload = auditRequestPayload(entry);
            const decision = auditRestoreDecision(entry);
            const comparisonFields = comparison
              ? [...new Set([...Object.keys(comparison.before), ...Object.keys(comparison.after)])]
              : [];

            return (
              <li key={entry.id}>
                <div>
                  <div className="helper-row">
                    <span className="badge">{historyEventLabel(entry)}</span>
                    <span className={`badge ${entry.outcome === "success" ? "badge-success" : "badge-error"}`}>
                      {entry.outcome}
                    </span>
                  </div>
                  {entry.createdAt ? (
                    <small className="helper-text">{new Date(entry.createdAt).toLocaleString("ar-SA")}</small>
                  ) : null}
                </div>

                {decision ? (
                  <div className="audit-decision" data-available={decision.available ? "true" : "false"}>
                    <strong>{decision.label}</strong>
                    {decision.reason ? <p>{decision.reason}</p> : null}
                  </div>
                ) : null}

                {fields.length ? (
                  <div className="audit-diff">
                    <strong>حقول التغيير</strong>
                    <div className="tags">
                      {fields.slice(0, 12).map((field) => (
                        <span key={field} className="tag">{field}</span>
                      ))}
                      {fields.length > 12 ? <span className="tag">+{fields.length - 12}</span> : null}
                    </div>
                  </div>
                ) : null}

                {comparison ? (
                  <div className="audit-diff">
                    <strong>مقارنة التغيير</strong>
                    <table aria-label="مقارنة القيم السابقة والجديدة">
                      <thead>
                        <tr>
                          <th scope="col">الحقل</th>
                          <th scope="col">القيمة السابقة</th>
                          <th scope="col">القيمة الجديدة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonFields.map((field) => (
                          <tr key={field}>
                            <th scope="row">{field}</th>
                            <td>{auditValue(comparison.before[field])}</td>
                            <td>{auditValue(comparison.after[field])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {payload ? (
                  <details className="audit-payload">
                    <summary>عرض payload منقح للمراجعة</summary>
                    <pre dir="ltr">{JSON.stringify(payload, null, 2)}</pre>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : !loading ? (
        <EmptyState
          title="لا يوجد سجل تغييرات بعد"
          description="ستظهر هنا الأحداث الموثقة عند تعديل هذا السجل أو ملاحظاته أو تعليقاته."
        />
      ) : null}
    </article>
  );
}

type RecordDescribePatch = {
  title: string;
  description: string;
  type: string;
  subtype: string | null;
  tags: string[];
};

function RecordDescribeForm({
  record,
  onSave
}: Readonly<{
  record: ArchiveRecord;
  onSave: (patch: RecordDescribePatch) => Promise<void>;
}>) {
  const [title, setTitle] = useState(record.title || "");
  const [description, setDescription] = useState(record.description || "");
  const [type, setType] = useState(record.type || "");
  const [subtype, setSubtype] = useState(record.subtype || "");
  const [tags, setTags] = useState((record.tags ?? []).join("، "));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const isDirty = useMemo(
    () =>
      title !== (record.title || "") ||
      description !== (record.description || "") ||
      type !== (record.type || "") ||
      subtype !== (record.subtype || "") ||
      tags !== (record.tags ?? []).join("، "),
    [title, description, type, subtype, tags, record]
  );
  useUnsavedChangesGuard(isDirty);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !title.trim()) return;

    setBusy(true);
    setStatus("");
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        type: type.trim(),
        subtype: subtype.trim() ? subtype.trim() : null,
        tags: tags.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean)
      });
      setStatus("تم حفظ التوصيف.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "تعذر حفظ التوصيف.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel">
      <div className="panel-section-header panel-title-row">
        <div>
          <h2>تحرير التوصيف</h2>
          <p className="helper-text">عدّل العنوان والوصف والنوع والوسوم واحفظها في الأرشيف مباشرة.</p>
        </div>
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          العنوان
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          الوصف
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="وصف موجز للمادة يظهر في التفاصيل والبحث." />
        </label>
        <div className="field-row">
          <label>
            النوع
            <input value={type} onChange={(event) => setType(event.target.value)} dir="ltr" placeholder="video" list="record-type-options" />
          </label>
          <label>
            الفرع
            <input value={subtype} onChange={(event) => setSubtype(event.target.value)} dir="ltr" placeholder="interview / raw" list="record-subtype-options" />
          </label>
        </div>
        <label>
          الوسوم
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="أرشيف، مقابلات، 2026" />
        </label>
        <datalist id="record-type-options">
          <option value="video" />
          <option value="audio" />
          <option value="image" />
          <option value="document" />
          <option value="map" />
        </datalist>
        <datalist id="record-subtype-options">
          <option value="interview" />
          <option value="raw" />
          <option value="report" />
          <option value="broadcast" />
          <option value="highlights" />
        </datalist>
        <div className="record-form-actions">
          <button type="submit" className="button button-primary" disabled={busy || !title.trim()}>
            {busy ? "جار الحفظ..." : "حفظ التوصيف"}
          </button>
          {status ? <p className="form-status">{status}</p> : null}
        </div>
      </form>
    </article>
  );
}

export default function ArchiveDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [isFav, setIsFav] = useState(false);
  const [ocrState, setOcrState] = useState<OcrState>({ status: "idle" });
  const [suggestions, setSuggestions] = useState<ArchiveSuggestion[]>([]);

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
      throw new Error(response.error || "تعذر تحديث العلاقات.");
    }

    setState((current) => current.status === "ready" ? { ...current, relationGraph: response } : current);
  }

  async function handleCreateRelation(payload: CreateRelationPayload) {
    const response = await api.createRelation(payload);
    if (!response.ok) {
      throw new Error(response.error || "تعذر إنشاء العلاقة.");
    }

    await refreshRelationGraph();
  }

  async function handleUpdateRelation(relationId: string, payload: UpdateRelationPayload) {
    const response = await api.updateRelation(relationId, payload);
    if (!response.ok) {
      throw new Error(response.error || "تعذر تحديث العلاقة.");
    }

    await refreshRelationGraph();
  }

  async function handleDeleteRelation(relationId: string) {
    const response = await api.deleteRelation(relationId);
    if (!response.ok) {
      throw new Error(response.error || "تعذر حذف العلاقة.");
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
      throw new Error(response.error || "تعذر حفظ التوصيف.");
    }

    setState((current) => (current.status === "ready" ? { ...current, record: updated } : current));
    const suggestionsResponse = await api.suggestions({ context: "detail", recordId: id });
    setSuggestions(suggestionsResponse.ok ? suggestionsResponse.suggestions : []);
  }

  async function handleSuggestionFeedback(suggestion: ArchiveSuggestion, value: SuggestionFeedbackValue) {
    const response = await api.submitSuggestionFeedback(suggestion.key, { value, context: "detail" });
    if (!response.ok) throw new Error(response.error || "تعذر حفظ تقييم الاقتراح.");
    if (value === "dismissed") setSuggestions((current) => current.filter((item) => item.key !== suggestion.key));
  }

  async function handleCreateNote(payload: { body: string; timestampSeconds?: number | null }) {
    if (state.status !== "ready") return;
    const response = await api.createRecordNote(id, payload, state.record.store || "archive-items");
    if (!response.ok) {
      throw new Error(response.error || "تعذر حفظ الملاحظة.");
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
      throw new Error(response.error || "تعذر نشر التعليق.");
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

  const detailDescription =
    state.status === "ready"
      ? state.record.description || "تفاصيل السجل وحقوقه في عرض تشغيلي مركز."
      : state.status === "error"
        ? "تعذر تحميل بيانات السجل من الخادم."
        : "جار تحميل بيانات السجل من الخادم.";
  const playerHref = state.status === "ready" ? mediaPlayerHref(state.record, id) : null;

  useEffect(() => {
    let active = true;

    const loadDetail = async () => {
      if (!id) {
        setState({ status: "error", message: "معرف السجل غير صحيح" });
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
        history: [],
        historyLoading: true,
        historyError: null
      });
      setIsFav(isFavorited(id));
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
                notesError: response.ok ? null : response.error || "تعذر تحميل الملاحظات."
              }
            : current);
        })
        .catch((error) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                notesLoading: false,
                notesError: error instanceof Error ? error.message : "تعذر تحميل الملاحظات."
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
                commentsError: response.ok ? null : response.error || "تعذر تحميل التعليقات."
              }
            : current);
        })
        .catch((error) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                commentsLoading: false,
                commentsError: error instanceof Error ? error.message : "تعذر تحميل التعليقات."
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
                historyError: response.ok ? null : response.error || "تعذر تحميل سجل التغييرات."
              }
            : current);
        })
        .catch((error) => {
          if (!active) return;
          setState((current) => current.status === "ready"
            ? {
                ...current,
                historyLoading: false,
                historyError: error instanceof Error ? error.message : "تعذر تحميل سجل التغييرات."
              }
            : current);
        });
    };

    loadDetail();
    return () => {
      active = false;
    };
  }, [id, api]);

  return (
    <AppShell
      subtitle="تفاصيل السجل"
      navLabel="تفاصيل السجل"
      contentClassName="archive-content"
      breadcrumbExtra={[{ label: state.status === "ready" ? state.record.title || "بدون عنوان" : "تفاصيل السجل" }]}
    >
      <PageToolbar
        eyebrow={<span className="badge">تفاصيل السجل</span>}
        title={state.status === "ready" ? state.record.title || "بدون عنوان" : "تفاصيل السجل"}
        description={detailDescription}
        meta={
          state.status === "ready" ? (
            <>
              {state.record.store ? <span className="badge">{state.record.store}</span> : null}
              {state.record.type ? <span className="badge">{state.record.type}</span> : null}
              {state.record.subtype ? <span className="badge">{state.record.subtype}</span> : null}
              {state.record.updatedAt ? (
                <span className="badge">
                  {new Date(state.record.updatedAt).toLocaleDateString("ar-SA")}
                </span>
              ) : null}
            </>
          ) : null
        }
        actions={
          <>
            <Link href="/archive" className="button button-secondary">
              العودة إلى الأرشيف
            </Link>
            {state.status === "ready" ? (
              <Link href={`/copilot?recordId=${encodeURIComponent(id)}`} className="button button-secondary">
                اسأل المساعد عن هذا السجل
              </Link>
            ) : null}
            {playerHref ? <Link href={playerHref} className="button button-secondary">تشغيل الوسائط</Link> : null}
            {state.status === "ready" ? (
              <button
                type="button"
                onClick={() => {
                  const newFav = toggleFavorite(id, state.record.title);
                  setIsFav(newFav);
                }}
                className={`button ${isFav ? "button-primary" : "button-secondary"}`}
                aria-pressed={isFav}
                title={isFav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
              >
                {isFav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
              </button>
            ) : null}
            {state.status === "ready" ? (
              <button
                type="button"
                onClick={handleOcr}
                disabled={!deriveRecordSourcePath(state.record) || ocrState.status === "creating"}
                className="button button-secondary"
                title={!deriveRecordSourcePath(state.record) ? "لا يوجد مسار ملف صالح لهذا السجل" : undefined}
              >
                {ocrState.status === "creating" ? "جار الإنشاء..." : "استخراج النص (OCR)"}
              </button>
            ) : null}
          </>
        }
      />
      {state.status === "ready" ? <RecordPresence recordId={id} /> : null}

      {state.status === "ready" && !deriveRecordSourcePath(state.record) && (
        <p className="helper-text">تعذّر تفعيل استخراج النص: لا يحتوي هذا السجل على مسار ملف قابل للاستخدام في metadata.</p>
      )}

      {ocrState.status === "success" && (
        <div className="state-banner state-banner-success">
          <strong>تم إنشاء مهمة OCR بنجاح.</strong>
          <Link href="/media/jobs" className="button button-secondary">عرض في مهام الوسائط</Link>
        </div>
      )}

      {ocrState.status === "error" && (
        <div className="state-banner state-banner-error">
          <strong>تعذّر إنشاء مهمة OCR: {ocrState.message}</strong>
        </div>
      )}

      {state.status === "loading" && (
        <div className="panel panel-compact">
          <Skeleton label="جار تحميل السجل..." />
        </div>
      )}

      {state.status === "error" && (
        <EmptyState
          title="خطأ في تحميل السجل"
          description={state.message}
          actions={<Link href="/archive" className="button button-secondary">العودة إلى الأرشيف</Link>}
        />
      )}

      {state.status === "ready" && (
        <div className="split-layout archive-detail-layout" aria-label="تفاصيل السجل">
          <div className="page-section">
            <article className="panel">
              <div className="panel-section-header">
                <h2>معلومات السجل</h2>
              </div>

              <div className="kv-grid">
                <div className="kv-item">
                  <strong>المعرّف</strong>
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
                    <strong>المخزن</strong>
                    <span>{state.record.store}</span>
                  </div>
                ) : null}

                {state.record.type ? (
                  <div className="kv-item">
                    <strong>النوع</strong>
                    <span>{state.record.type}</span>
                  </div>
                ) : null}

                {state.record.subtype ? (
                  <div className="kv-item">
                    <strong>الفرع</strong>
                    <span>{state.record.subtype}</span>
                  </div>
                ) : null}

                {state.record.createdAt ? (
                  <div className="kv-item">
                    <strong>الإنشاء</strong>
                    <time className="mono-text">
                      {new Date(state.record.createdAt).toLocaleDateString("ar-SA")}
                    </time>
                  </div>
                ) : null}

                {state.record.updatedAt ? (
                  <div className="kv-item">
                    <strong>آخر تحديث</strong>
                    <time className="mono-text">
                      {new Date(state.record.updatedAt).toLocaleDateString("ar-SA")}
                    </time>
                  </div>
                ) : null}
              </div>

              {state.record.tags && state.record.tags.length > 0 ? (
                <div className="section-divider">
                  <strong>الوسوم</strong>
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
            <SuggestionsPanel suggestions={suggestions} title="تحسينات مقترحة لهذا السجل" onFeedback={handleSuggestionFeedback} />
            <RecordDescribeForm record={state.record} onSave={handleSaveRecord} />
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
          </div>

          <div className="page-section">
            <article className="panel">
              <div className="panel-section-header">
                <h2>حقوق الاستخدام</h2>
              </div>

              {state.rights ? (
                <>
                  <div className="kv-grid">
                    <div className="kv-item">
                      <strong>صاحب الحقوق</strong>
                      <span>{state.rights.rightsHolder}</span>
                    </div>

                    <div className="kv-item">
                      <strong>الترخيص</strong>
                      <span className="badge">{state.rights.licenseType}</span>
                    </div>

                    {state.rights.embargoStart ? (
                      <div className="kv-item">
                        <strong>حظر من</strong>
                        <time className="mono-text">
                          {new Date(state.rights.embargoStart).toLocaleDateString("ar-SA")}
                        </time>
                      </div>
                    ) : null}

                    {state.rights.embargoEnd ? (
                      <div className="kv-item">
                        <strong>حظر إلى</strong>
                        <time className="mono-text">
                          {new Date(state.rights.embargoEnd).toLocaleDateString("ar-SA")}
                        </time>
                      </div>
                    ) : null}

                    {state.rights.expiresAt ? (
                      <div className="kv-item">
                        <strong>ينتهي في</strong>
                        <time className="mono-text">
                          {new Date(state.rights.expiresAt).toLocaleDateString("ar-SA")}
                        </time>
                      </div>
                    ) : null}
                  </div>

                  {state.rights.geoRestrictions && state.rights.geoRestrictions.length > 0 ? (
                    <div className="section-divider">
                      <strong>القيود الجغرافية</strong>
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
                      <strong>ملاحظات</strong>
                      <p>{state.rights.notes}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  title="لا توجد بيانات حقوق مسجلة لهذا السجل."
                  description="يمكن متابعة السجل نفسه بينما تظل الحقوق غير متاحة في API."
                />
              )}
            </article>
            <RelationPreviewPanel
              graph={state.relationGraph}
              recordId={id}
              onCreate={handleCreateRelation}
              onUpdate={handleUpdateRelation}
              onDelete={handleDeleteRelation}
            />
            <GeotagPanel
              record={state.record}
              onRecordUpdate={(updated) => setState((current) => (current.status === "ready" ? { ...current, record: updated } : current))}
            />
            <RecordAttachmentsPanel recordId={id} store={state.record.store || "archive-items"} />
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
