"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord, type TagNode } from "@/lib/archive-api";
import { countBy, normalizeText } from "@/lib/record-utils";

export default function TagsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [error, setError] = useState("");
  const [nodes, setNodes] = useState<TagNode[]>([]);
  const [filter, setFilter] = useState("");

  async function refreshNodes() {
    const response = await api.tagNodes();
    if (response.ok) setNodes(response.nodes);
    else setError(response.error || "تعذر تحميل الوسوم.");
  }

  useEffect(() => {
    void refreshNodes();
    void (async () => {
      const response = await api.search({ limit: 1000 });
      if (response.ok) setRecords(response.records);
      else setError(response.error);
    })();
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

  return (
    <AppShell subtitle="الوسوم" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Tags</span>}
        title="الوسوم الهرمية"
        description="إدارة يومية للوسوم: counts، آباء هرمية، ومؤشرات تكرار عربية. آباء الوسوم محفوظة في Laravel لكل مستخدم."
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

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل الوسوم</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      {tagRows.length === 0 ? (
        <EmptyState title="لا توجد وسوم بعد." description="أضف وسوماً إلى السجلات من الأرشيف لتظهر هنا." />
      ) : (
        <section className="panel" aria-label="قائمة الوسوم">
          <div className="analytics-tag-list">
            {tagRows.map((row) => (
              <div className="analytics-tag-row" key={row.tag}>
                <span>
                  <strong>{row.tag}</strong>
                  {row.parent ? <small className="helper-text"> · ضمن {row.parent}</small> : null}
                </span>
                <div className="button-row">
                  <strong>{row.count}</strong>
                  <select value={row.parent} onChange={(event) => void updateParent(row.tag, event.target.value)} aria-label={`أب الوسم ${row.tag}`}>
                    <option value="">بلا أب</option>
                    {tagRows.filter((item) => item.tag !== row.tag).map((item) => (
                      <option key={item.tag} value={item.tag}>{item.tag}</option>
                    ))}
                  </select>
                  <a className="button button-secondary button-sm" href={`/search?q=${encodeURIComponent(row.tag)}`}>بحث</a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {duplicateGroups.length > 0 ? (
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
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
