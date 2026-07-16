"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import { createArchiveApiClient, type ArchiveRecord, type TagNode } from "@/lib/archive-api";
import { buildChangeImpact } from "@/lib/change-impact";
import { countBy, normalizeText } from "@/lib/record-utils";
import { Skeleton } from "@/components/ui/Skeleton";

type TagsLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export default function TagsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [loadState, setLoadState] = useState<TagsLoadState>({ status: "loading" });
  const [error, setError] = useState("");
  const [nodes, setNodes] = useState<TagNode[]>([]);
  const [filter, setFilter] = useState("");

  async function refreshNodes() {
    const response = await api.tagNodes();
    if (response.ok) setNodes(response.nodes);
    else setError(response.error || "تعذر تحميل الوسوم.");
  }

  async function loadTags() {
    setLoadState({ status: "loading" });
    setError("");
    const [nodesResponse, recordsResponse] = await Promise.all([api.tagNodes(), api.search({ limit: 1000 })]);
    if (!nodesResponse.ok || !recordsResponse.ok) {
      const message = !nodesResponse.ok
        ? nodesResponse.error || "تعذر تحميل الوسوم."
        : !recordsResponse.ok
          ? recordsResponse.error || "تعذر تحميل السجلات."
          : "تعذر تحميل بيانات الوسوم.";
      setLoadState({
        status: "error",
        message
      });
      return;
    }
    setNodes(nodesResponse.nodes);
    setRecords(recordsResponse.records);
    setLoadState({ status: "ready" });
  }

  useEffect(() => {
    void loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const nodeByTag = useMemo(() => new Map(nodes.map((node) => [node.tag, node])), [nodes]);

  const tagRows = useMemo(() => {
    const rows = countBy(records.flatMap((record) => record.tags || [])).map(([tag, count]) => ({
      tag,
      count,
      parent: nodeByTag.get(tag)?.parent || ""
    }));
    const normalized = normalizeText(filter);
    return rows.filter((row) => !normalized || normalizeText(`${row.tag} ${row.parent}`).includes(normalized));
  }, [filter, nodeByTag, records]);

  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    tagRows.forEach((row) => {
      const key = normalizeText(row.tag);
      groups.set(key, [...(groups.get(key) || []), row.tag]);
    });
    return Array.from(groups.values()).filter((items) => items.length > 1);
  }, [tagRows]);

  async function updateParent(tag: string, parent: string) {
    const existing = nodeByTag.get(tag);
    let response;
    if (parent) {
      response = existing
        ? await api.updateTagNode(existing.id, { parent })
        : await api.createTagNode({ tag, parent });
    } else if (existing) {
      response = await api.deleteTagNode(existing.id);
    } else {
      return;
    }
    if (!response.ok) setError(response.error || "تعذر حفظ الوسم.");
    await refreshNodes();
  }

  async function updateColor(tagId: string, color: string | null) {
    const response = await api.updateTagNode(tagId, { color: color || undefined });
    if (!response.ok) setError(response.error || "تعذر تحديث اللون.");
    else await refreshNodes();
  }

  async function mergeTags(sourceId: string, targetId: string) {
    const response = await api.mergeTagNodes(sourceId, targetId);
    if (!response.ok) setError(response.error || "تعذر دمج الوسوم.");
    else await refreshNodes();
  }

  async function moveTag(tagId: string, newParent: string, deleteChildren: boolean = false) {
    const response = await api.moveTagNode(tagId, newParent, deleteChildren);
    if (!response.ok) setError(response.error || "تعذر نقل الوسم.");
    else await refreshNodes();
  }

  return (
    <AppShell subtitle="الوسوم" contentClassName="local-list-content" tipsPage="tags">
      <PageToolbar
        eyebrow={<span className="badge">Tags</span>}
        title="الوسوم الهرمية"
        description="إدارة يومية للوسوم: counts، آباء هرمية، ومؤشرات تكرار عربية. آباء الوسوم محفوظة في الخادم لكل مستخدم."
        meta={(
          <>
            <span className="badge">{tagRows.length} وسم</span>
            <span className="badge">{duplicateGroups.length} تشابه محتمل</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/vocabulary">فتح المفردات</a>}
      >
        <div className="archive-toolbar-grid">
          <label>
            <span>بحث في الوسوم</span>
            <input className="search-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="وسم أو أب" />
          </label>
        </div>
      </PageToolbar>

      {loadState.status === "loading" ? (
        <div className="panel panel-compact"><Skeleton label="جار تحميل الوسوم والسجلات..." /></div>
      ) : null}

      {loadState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل الوسوم</strong>
          <span className="helper-text">{loadState.message}</span>
          <div><button className="button button-secondary button-sm" type="button" onClick={() => void loadTags()}>إعادة المحاولة</button></div>
        </div>
      ) : null}

      {error && loadState.status === "ready" ? (
        <div className="state-banner state-banner-error" role="alert"><strong>تعذر حفظ تغيير الوسم</strong><span className="helper-text">{error}</span></div>
      ) : null}

      {loadState.status === "ready" && tagRows.length === 0 ? (
        <EmptyState title="لا توجد وسوم بعد." description="أضف وسوماً إلى السجلات من الأرشيف لتظهر هنا." />
      ) : (
        <section className="panel" aria-label="قائمة الوسوم">
          <div className="analytics-tag-list">
            {tagRows.map((row) => {
              const node = nodeByTag.get(row.tag);
              return (
                <div className="analytics-tag-row" key={row.tag} style={node?.color ? { borderLeft: `4px solid ${node.color}` } : {}}>
                  <span>
                    <strong>{row.tag}</strong>
                    {row.parent ? <small className="helper-text"> · ضمن {row.parent}</small> : null}
                  </span>
                  <div className="button-row">
                    <strong>{row.count}</strong>
                    {node && (
                      <input
                        type="color"
                        value={node.color || "#808080"}
                        onChange={(event) => void updateColor(node.id, event.target.value)}
                        aria-label={`لون الوسم ${row.tag}`}
                        style={{ width: "2.5rem", height: "2.5rem", cursor: "pointer" }}
                      />
                    )}
                    <select value={row.parent} onChange={(event) => void updateParent(row.tag, event.target.value)} aria-label={`أب الوسم ${row.tag}`}>
                      <option value="">بلا أب</option>
                      {tagRows.filter((item) => item.tag !== row.tag).map((item) => (
                        <option key={item.tag} value={item.tag}>{item.tag}</option>
                      ))}
                    </select>
                    <a className="button button-secondary button-sm" href={`/search?q=${encodeURIComponent(row.tag)}`}>بحث</a>
                  </div>
                  <p className="helper-text">تغيير الأب هيكلي فقط ولا يعدّل أي سجل؛ لا يتوفر تراجع تلقائي لهذا التحديث.</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {loadState.status === "ready" && duplicateGroups.length > 0 ? (
        <section className="page-section">
          <div className="toolbar-row toolbar-start">
            <h2 className="section-heading">تشابهات تحتاج مراجعة</h2>
            <span className="badge badge-warning">تطبيع عربي</span>
          </div>
          <div className="dense-grid">
            {duplicateGroups.map((group) => (
              <article className="panel" key={group.join("|")}>
                <h3>{group[0]}</h3>
                <p>وسوم متقاربة بعد التطبيع: {group.join("، ")}</p>
                <ChangeImpactPreview impact={buildChangeImpact({ action: "merge", entity: "الوسوم المتقاربة", affectedCount: records.filter((record) => (record.tags || []).some((tag) => group.includes(tag))).length })} />
                <p className="helper-text">الدمج غير معروض هنا قبل توفير نقطة نهاية تدعم المعاينة؛ راجع السجلات أولاً.</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
