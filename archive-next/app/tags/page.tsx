"use client";

import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import IconPicker from "@/components/IconPicker";
import { createArchiveApiClient, type ArchiveRecord, type TagNode } from "@/lib/archive-api";
import { buildChangeImpact } from "@/lib/change-impact";
import { countBy, normalizeText } from "@/lib/record-utils";
import { canRedo, canUndo, emptyUndoStack, pushUndo, redo, undo, type UndoStack } from "@/lib/undo-stack";
import { Skeleton } from "@/components/ui/Skeleton";

const iconRegistry = Icons as unknown as Record<string, LucideIcon>;

interface ParentChange {
  tag: string;
  previousParent: string;
  nextParent: string;
}

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
  const [parentStack, setParentStack] = useState<UndoStack<ParentChange>>(emptyUndoStack);
  const [iconEditingTag, setIconEditingTag] = useState<string | null>(null);

  async function handleSetIcon(tag: string, iconName: string) {
    const existing = nodeByTag.get(tag);
    const response = existing
      ? await api.updateTagNode(existing.id, { icon: iconName })
      : await api.createTagNode({ tag, parent: "", icon: iconName });
    if (!response.ok) {
      setError(response.error || "تعذر حفظ أيقونة الوسم.");
      return;
    }
    setIconEditingTag(null);
    await refreshNodes();
  }

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

  // V1-732D: recordUndo=false is used only by the undo/redo replay below, so
  // reverting a change doesn't itself push a new undo entry.
  async function updateParent(tag: string, parent: string, recordUndo = true) {
    const existing = nodeByTag.get(tag);
    const previousParent = existing?.parent || "";
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
    if (!response.ok) {
      setError(response.error || "تعذر حفظ الوسم.");
      await refreshNodes();
      return;
    }
    if (recordUndo && previousParent !== parent) {
      setParentStack((stack) => pushUndo(stack, { tag, previousParent, nextParent: parent }));
    }
    await refreshNodes();
  }

  async function handleUndoParent() {
    const result = undo(parentStack);
    if (!result) return;
    await updateParent(result.entry.tag, result.entry.previousParent, false);
    setParentStack(result.stack);
  }

  async function handleRedoParent() {
    const result = redo(parentStack);
    if (!result) return;
    await updateParent(result.entry.tag, result.entry.nextParent, false);
    setParentStack(result.stack);
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

      {canUndo(parentStack) || canRedo(parentStack) ? (
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(parentStack)}
            onClick={() => void handleUndoParent()}
          >
            تراجع عن تغيير الأب{parentStack.past.length > 0 ? ` (${parentStack.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(parentStack)}
            onClick={() => void handleRedoParent()}
          >
            إعادة تغيير الأب{parentStack.future.length > 0 ? ` (${parentStack.future.length})` : ""}
          </button>
        </div>
      ) : null}

      {loadState.status === "ready" && tagRows.length === 0 ? (
        <EmptyState title="لا توجد وسوم بعد." description="أضف وسوماً إلى السجلات من الأرشيف لتظهر هنا." />
      ) : (
        <section className="panel" aria-label="قائمة الوسوم">
          <div className="analytics-tag-list">
            {tagRows.map((row) => {
              const node = nodeByTag.get(row.tag);
              const rowIcon = node?.icon ?? undefined;
              const RowIcon = rowIcon ? iconRegistry[rowIcon] || Icons.Circle : null;
              return (
                <div className="analytics-tag-row" key={row.tag} style={node?.color ? { borderLeft: `4px solid ${node.color}` } : {}}>
                  <span>
                    <strong>{row.tag}</strong>
                    {row.parent ? <small className="helper-text"> · ضمن {row.parent}</small> : null}
                  </span>
                  <div className="button-row">
                    <strong>{row.count}</strong>
                    <button
                      type="button"
                      className="button button-secondary button-sm"
                      aria-label={`أيقونة الوسم ${row.tag}`}
                      aria-pressed={iconEditingTag === row.tag}
                      onClick={() => setIconEditingTag(iconEditingTag === row.tag ? null : row.tag)}
                    >
                      {RowIcon ? <RowIcon aria-hidden="true" size={16} strokeWidth={2} /> : "أيقونة"}
                    </button>
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
                  <p className="helper-text">تغيير الأب هيكلي فقط ولا يعدّل أي سجل؛ يمكن التراجع عنه من الزر أعلاه.</p>
                  {iconEditingTag === row.tag ? (
                    <IconPicker value={rowIcon} onChange={(iconName) => handleSetIcon(row.tag, iconName)} label={`اختر أيقونة الوسم ${row.tag}`} />
                  ) : null}
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
