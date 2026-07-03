"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import {
  createArchiveApiClient,
  type ArchiveRecord,
  type RelationGraphEdge,
  type RelationGraphPayload,
  type RightsRecord
} from "@/lib/archive-api";
import { isFavorited, toggleFavorite } from "@/lib/favorites";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; record: ArchiveRecord; rights: RightsRecord | null; relationGraph: RelationGraphPayload | null }
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

      // Fetch related panels; neither should block the base record.
      const [rightsResult, relationResult] = await Promise.allSettled([
        api.rights(id),
        api.relationGraph({ recordId: id, limit: 32 })
      ]);
      const rightsResponse = rightsResult.status === "fulfilled" ? rightsResult.value : null;
      const relationResponse = relationResult.status === "fulfilled" ? relationResult.value : null;
      const rights = rightsResponse?.ok ? rightsResponse.record : null;
      const relationGraph = relationResponse?.ok ? relationResponse : null;

      if (!active) return;

      setState({
        status: "ready",
        record: recordResponse.record,
        rights,
        relationGraph
      });
      setIsFav(isFavorited(id));
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
          </div>
        </div>
      )}
    </AppShell>
  );
}
