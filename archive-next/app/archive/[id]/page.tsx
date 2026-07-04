"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import BroadcastMetadataPanel from "@/components/BroadcastMetadataPanel";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import {
  createArchiveApiClient,
  type ArchiveRecord,
  type RecordComment,
  type RecordHistoryEntry,
  type RecordNote,
  type RelationGraphEdge,
  type RelationGraphPayload,
  type RightsRecord
} from "@/lib/archive-api";
import { isFavorited, toggleFavorite } from "@/lib/favorites";

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

/** Records don't carry a guaranteed file path — only ingested/uploaded metadata does. */
function deriveSourcePath(record: ArchiveRecord): { sourcePath: string; disk?: string } | null {
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  const sourcePath = metadata["filePath"] ?? metadata["path"];
  if (typeof sourcePath !== "string" || !sourcePath.trim()) return null;
  const disk = metadata["disk"];
  return { sourcePath, ...(typeof disk === "string" && disk.trim() ? { disk } : {}) };
}

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

function RelationPreviewPanel({
  graph,
  recordId
}: Readonly<{
  graph: RelationGraphPayload | null;
  recordId: string;
}>) {
  const nodesById = new Map((graph?.nodes ?? []).map((node) => [node.id, node]));
  const edges = (graph?.edges ?? []).filter((edge) => edge.source === recordId || edge.target === recordId);
  const manualCount = edges.filter((edge) => edge.kind === "manual").length;

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
        <p className="form-status" role="status" aria-live="polite">جار تحميل الملاحظات...</p>
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
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="اكتب ملاحظة شخصية عن هذا السجل..."
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
        <p className="form-status" role="status" aria-live="polite">جار تحميل التعليقات...</p>
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
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="اكتب تعليقاً يراه بقية أعضاء الفريق..."
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
        <p className="form-status" role="status" aria-live="polite">جار تحميل السجل...</p>
      ) : null}

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل سجل التغييرات</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      {!loading && entries.length ? (
        <ul className="record-history-list">
          {entries.map((entry) => (
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
            </li>
          ))}
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

export default function ArchiveDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [isFav, setIsFav] = useState(false);
  const [ocrState, setOcrState] = useState<OcrState>({ status: "idle" });

  async function handleOcr() {
    if (state.status !== "ready") return;
    const source = deriveSourcePath(state.record);
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

  async function handleCreateNote(payload: { body: string; timestampSeconds?: number | null }) {
    if (state.status !== "ready") return;
    const response = await api.createRecordNote(id, payload);
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
    const response = await api.createRecordComment(id, payload);
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
        ? "تعذر تحميل بيانات السجل من خدمة Laravel."
        : "جار تحميل بيانات السجل من خدمة Laravel.";

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

      void api.recordNotes(id)
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

      void api.recordComments(id)
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

      void api.recordHistory(id, { limit: 50 })
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
    <AppShell subtitle="تفاصيل السجل" navLabel="تفاصيل السجل" contentClassName="archive-content">
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
            <a href="/archive" className="button button-secondary">
              العودة إلى الأرشيف
            </a>
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
                disabled={!deriveSourcePath(state.record) || ocrState.status === "creating"}
                className="button button-secondary"
                title={!deriveSourcePath(state.record) ? "لا يوجد مسار ملف صالح لهذا السجل" : undefined}
              >
                {ocrState.status === "creating" ? "جار الإنشاء..." : "استخراج النص (OCR)"}
              </button>
            ) : null}
          </>
        }
      />

      {state.status === "ready" && !deriveSourcePath(state.record) && (
        <p className="helper-text">تعذّر تفعيل استخراج النص: لا يحتوي هذا السجل على مسار ملف قابل للاستخدام في metadata.</p>
      )}

      {ocrState.status === "success" && (
        <div className="state-banner state-banner-success">
          <strong>تم إنشاء مهمة OCR بنجاح.</strong>
          <a href="/media/jobs" className="button button-secondary">عرض في مهام الوسائط</a>
        </div>
      )}

      {ocrState.status === "error" && (
        <div className="state-banner state-banner-error">
          <strong>تعذّر إنشاء مهمة OCR: {ocrState.message}</strong>
        </div>
      )}

      {state.status === "loading" && (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جار تحميل السجل...</p>
        </div>
      )}

      {state.status === "error" && (
        <EmptyState
          title="خطأ في تحميل السجل"
          description={state.message}
          actions={<a href="/archive" className="button button-secondary">العودة إلى الأرشيف</a>}
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
            <RelationPreviewPanel graph={state.relationGraph} recordId={id} />
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
