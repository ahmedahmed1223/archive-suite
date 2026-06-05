import {
  useAppStore
} from "../stores/index.js";
import { EntityFormModal } from "../components/common/EntityFormModal.jsx";
import { ColorSwatchPicker } from "../components/common/ColorSwatchPicker.jsx";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  FolderTree,
  Hash,
  PenLine,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { appConfirm } from "../components/common/ConfirmDialog.js";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { MotionPage, PageHero } from "../components/ui/V1Primitives.jsx";
import {
  HIERARCHICAL_TAG_COLORS,
  analyzeTagWorkspace,
  buildHierarchicalTagModel,
  createHierarchicalTagValue,
  getDescendantTagIds,
  getFilteredHierarchicalTags,
  getHierarchicalTagPath,
  getNextHierarchicalTagOrder,
  parseHierarchicalTagAliases
} from "../features/hierarchical-tags/viewModel.js";
import { formatNumber, normalizeArabicSearchText } from "../utils/formatting.js";


function TagForm({ tag, parentTag, tags, onCancel, onSave }) {
  const [name, setName] = React.useState(tag?.name || "");
  const [aliases, setAliases] = React.useState((tag?.aliases || []).join("، "));
  const [color, setColor] = React.useState(tag?.color || "#10b981");
  const colorLabelId = React.useId();
  const nameRef = React.useRef(null);

  const submit = async (keepOpen) => {
    if (!name.trim()) return;
    const parentId = tag ? tag.parentId || null : parentTag?.id || null;
    const ok = await onSave({
      ...tag,
      name,
      aliases: parseHierarchicalTagAliases(aliases),
      color,
      parentId,
      order: tag?.order ?? getNextHierarchicalTagOrder(tags, parentId)
    }, { keepOpen });
    if (ok && keepOpen) {
      setName("");
      window.requestAnimationFrame(() => nameRef.current?.focus());
    }
  };

  return jsx(EntityFormModal, {
    title: tag ? "تعديل الوسم" : parentTag ? `وسم فرعي داخل ${parentTag.name}` : "وسم جذر جديد",
    icon: jsx(Hash, { className: "h-4 w-4" }),
    onCancel,
    onSubmit: () => submit(false),
    onSubmitAndNew: () => submit(true),
    canSubmit: Boolean(name.trim()),
    submitLabel: tag ? "حفظ التعديل" : "إنشاء الوسم",
    isEditing: Boolean(tag),
    children: jsxs("div", {
      className: "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]",
      children: [
        jsxs("label", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("span", { children: "اسم الوسم" }),
          jsx("input", {
            ref: nameRef,
            "data-autofocus": true,
            value: name,
            onChange: (event) => setName(event.target.value),
            className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40",
            placeholder: "مثال: رياضة / كرة قدم"
          })
        ] }),
        jsxs("label", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [
          jsx("span", { children: "مرادفات الوسم" }),
          jsx("input", {
            value: aliases,
            onChange: (event) => setAliases(event.target.value),
            className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40",
            placeholder: "أسماء بديلة مفصولة بفواصل"
          })
        ] }),
        jsxs("div", { className: "space-y-1", children: [
          jsx("span", { id: colorLabelId, className: "text-sm text-gray-300", children: "اللون" }),
          jsx(ColorSwatchPicker, { value: color, onChange: setColor, presets: HIERARCHICAL_TAG_COLORS, labelId: colorLabelId, className: "max-w-[280px]" })
        ] })
      ]
    })
  });
}

function TagNode({
  tag,
  level,
  tags,
  model,
  expandedIds,
  onToggle,
  onCreateChild,
  onEdit,
  onDelete,
  onMove,
  getTagUsageCount
}) {
  const children = model.childrenByParent.get(tag.id) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(tag.id);
  const usageCount = typeof getTagUsageCount === "function" ? getTagUsageCount(tag.id) : 0;

  return jsxs("div", {
    role: "treeitem",
    "aria-expanded": hasChildren ? isExpanded : undefined,
    children: [
      jsxs("div", {
        className: "group flex items-center gap-2 rounded-xl border border-transparent p-2 transition-colors hover:border-white/10 hover:bg-white/5",
        style: { paddingRight: `${level * 22 + 8}px` },
        children: [
          jsx("button", {
            type: "button",
            onClick: () => hasChildren && onToggle(tag.id),
            className: `flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${hasChildren ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-transparent"}`,
            "aria-label": isExpanded ? "طي الوسم" : "توسيع الوسم",
            children: hasChildren ? isExpanded ? jsx(ChevronDown, { className: "h-4 w-4" }) : jsx(ChevronLeft, { className: "h-4 w-4" }) : jsx(ChevronLeft, { className: "h-4 w-4" })
          }),
          jsx("span", { className: "h-3 w-3 shrink-0 rounded-full transition-shadow", style: { backgroundColor: tag.color || "#10b981", boxShadow: `0 0 0 2px ${tag.color || "#10b981"}28` } }),
          jsxs("div", { className: "min-w-0 flex-1", children: [
            jsx("p", { className: "truncate text-sm font-semibold text-white group-hover:text-emerald-200", children: tag.name || "وسم بدون اسم" }),
            level > 0 && jsx("p", { className: "truncate text-xs text-gray-600", children: getHierarchicalTagPath(tag.id, tags) }),
            tag.aliases?.length ? jsx("p", { className: "truncate text-[11px] text-gray-600", children: `مرادفات: ${tag.aliases.slice(0, 3).join("، ")}` }) : null
          ] }),
          usageCount > 0 && jsx("span", { className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-500", children: formatNumber(usageCount) }),
          jsxs("div", { className: "flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100", children: [
            jsx("button", { type: "button", onClick: () => onCreateChild(tag), className: "rounded-lg p-2 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-300", "aria-label": `إضافة فرع داخل ${tag.name}`, children: jsx(Plus, { className: "h-4 w-4" }) }),
            jsx("button", { type: "button", onClick: () => onMove(tag, "up"), className: "rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white", "aria-label": "رفع الوسم", children: jsx(ArrowUp, { className: "h-4 w-4" }) }),
            jsx("button", { type: "button", onClick: () => onMove(tag, "down"), className: "rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white", "aria-label": "خفض الوسم", children: jsx(ArrowDown, { className: "h-4 w-4" }) }),
            jsx("button", { type: "button", onClick: () => onEdit(tag), className: "rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white", "aria-label": `تعديل ${tag.name}`, children: jsx(PenLine, { className: "h-4 w-4" }) }),
            jsx("button", { type: "button", onClick: () => onDelete(tag), className: "rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-300", "aria-label": `حذف ${tag.name}`, children: jsx(Trash2, { className: "h-4 w-4" }) })
          ] })
        ]
      }),
      isExpanded && hasChildren && jsx("div", {
        className: "mt-1 space-y-1",
        role: "group",
        children: children.map((child) => jsx(TagNode, {
          tag: child,
          level: level + 1,
          tags,
          model,
          expandedIds,
          onToggle,
          onCreateChild,
          onEdit,
          onDelete,
          onMove,
          getTagUsageCount
        }, child.id))
      })
    ]
  });
}

function FlatTagCard({ tag, tags, index, onEdit, onDelete }) {
  const accentColor = tag.color || "#10b981";
  return jsxs(motion.article, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 10) * 0.025 },
    className: "va-entity-card rounded-2xl va-surface-muted border p-4 text-right transition-all hover:border-white/20",
    style: { boxShadow: `inset -3px 0 0 0 ${accentColor}44` },
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        jsxs("div", { className: "min-w-0 flex-1", children: [
          jsxs("div", { className: "flex items-center gap-2", children: [
            jsx("span", { className: "h-3 w-3 flex-shrink-0 rounded-full", style: { backgroundColor: accentColor, boxShadow: `0 0 0 2px ${accentColor}30` } }),
            jsx("h3", { className: "truncate text-base font-bold text-white", children: tag.name || "وسم بدون اسم" })
          ] }),
          jsx("p", { className: "mt-1.5 truncate text-xs text-gray-500", children: getHierarchicalTagPath(tag.id, tags) || tag.name })
        ] }),
        jsxs("div", { className: "flex shrink-0 gap-1", children: [
          jsx("button", { type: "button", onClick: onEdit, className: "rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white", "aria-label": `تعديل ${tag.name}`, children: jsx(PenLine, { className: "h-4 w-4" }) }),
          jsx("button", { type: "button", onClick: onDelete, className: "rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-300", "aria-label": `حذف ${tag.name}`, children: jsx(Trash2, { className: "h-4 w-4" }) })
        ] })
      ] })
    ]
  }, tag.id);
}

export function HierarchicalTagsPage() {
  const {
    hierarchicalTags = [],
    videoItems = [],
    vocabulary = [],
    addHierarchicalTag,
    updateHierarchicalTag,
    deleteHierarchicalTag,
    updateVideoItem,
    getTagUsageCount,
    showToast
  } = useAppStore();

  const [query, setQuery] = React.useState("");
  const [expandedIds, setExpandedIds] = React.useState(() => new Set());
  const [editingTag, setEditingTag] = React.useState(null);
  const [parentTag, setParentTag] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);

  const model = React.useMemo(() => buildHierarchicalTagModel(hierarchicalTags), [hierarchicalTags]);
  const filteredTags = React.useMemo(() => getFilteredHierarchicalTags(hierarchicalTags, query), [hierarchicalTags, query]);
  const workspace = React.useMemo(() => analyzeTagWorkspace({ tags: hierarchicalTags, videoItems, vocabulary }), [hierarchicalTags, videoItems, vocabulary]);

  const rootCount = model.roots.length;
  const childCount = Math.max(0, hierarchicalTags.length - rootCount);

  const toggleExpand = (id) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(hierarchicalTags.map((tag) => tag.id)));
  const collapseAll = () => setExpandedIds(new Set());

  const startCreateRoot = () => {
    setEditingTag(null);
    setParentTag(null);
    setShowForm(true);
  };

  const startCreateChild = (tag) => {
    setEditingTag(null);
    setParentTag(tag);
    setShowForm(true);
    setExpandedIds((previous) => new Set([...previous, tag.id]));
  };

  const saveTag = async (draft, opts = {}) => {
    try {
      if (editingTag) {
        await updateHierarchicalTag?.(createHierarchicalTagValue({
          ...editingTag,
          ...draft,
          createdAt: editingTag.createdAt
        }));
        showToast?.("تم تحديث الوسم", "success");
      } else {
        await addHierarchicalTag?.(createHierarchicalTagValue(draft));
        showToast?.("تم إنشاء الوسم", "success");
      }
      if (!opts.keepOpen) {
        setShowForm(false);
        setEditingTag(null);
        setParentTag(null);
      }
      return true;
    } catch (error) {
      showToast?.("تعذر حفظ الوسم", "error");
      return false;
    }
  };

  const deleteTag = async (tag) => {
    const descendantCount = getDescendantTagIds(tag.id, model.childrenByParent).length;
    const message = descendantCount
      ? `سيتم حذف "${tag.name}" و${descendantCount} وسم فرعي. هل تريد المتابعة؟`
      : `هل تريد حذف الوسم "${tag.name}"؟`;
    const confirmed = await appConfirm(message, {
      title: "حذف وسم هرمي",
      kind: "danger",
      confirmLabel: "حذف"
    });
    if (!confirmed) return;
    try {
      await deleteHierarchicalTag?.(tag.id);
      showToast?.("تم حذف الوسم", "info");
    } catch (error) {
      showToast?.("تعذر حذف الوسم", "error");
    }
  };

  const createSuggestedTag = async (row) => {
    try {
      await addHierarchicalTag?.(createHierarchicalTagValue({ name: row.name, order: getNextHierarchicalTagOrder(hierarchicalTags, null) }));
      showToast?.("تم إنشاء الوسم المقترح", "success");
    } catch (error) {
      showToast?.("تعذر إنشاء الوسم", "error");
    }
  };

  const deleteUnusedTag = async (tag) => {
    const confirmed = await appConfirm(`الوسم "${tag.name}" غير مستخدم في المواد الحالية. هل تريد حذفه؟`, {
      title: "حذف وسم غير مستخدم",
      kind: "danger",
      confirmLabel: "حذف"
    });
    if (!confirmed) return;
    try {
      await deleteHierarchicalTag?.(tag.id);
      showToast?.("تم حذف الوسم", "info");
    } catch (error) {
      showToast?.("تعذر حذف الوسم", "error");
    }
  };

  const mergeDuplicateTags = async (group) => {
    const [target, ...sources] = group.entries || [];
    if (!target || sources.length === 0) return;
    const sourceKeys = new Set(sources.map((tag) => normalizeArabicSearchText(tag.name)));
    const affectedItems = videoItems.filter((item) => (item.tags || []).some((tag) => sourceKeys.has(normalizeArabicSearchText(tag))));
    const confirmed = await appConfirm(`دمج ${sources.length} وسم مكرر داخل "${target.name}"؟ سيتم تحديث ${affectedItems.length} مادة ثم حذف المكرر.`, {
      title: "دمج وسوم مكررة",
      kind: "warning",
      confirmLabel: "دمج"
    });
    if (!confirmed) return;
    try {
      for (const item of affectedItems) {
        const tags = [...new Set((item.tags || []).map((tag) => sourceKeys.has(normalizeArabicSearchText(tag)) ? target.name : tag))];
        await updateVideoItem?.({ ...item, tags });
      }
      for (const source of sources) await deleteHierarchicalTag?.(source.id, { skipUndo: true });
      showToast?.("تم دمج الوسوم المكررة", "success");
    } catch (error) {
      showToast?.("تعذر دمج الوسوم", "error");
    }
  };

  const moveTag = async (tag, direction) => {
    const siblings = model.childrenByParent.get(tag.parentId || null) || [];
    const index = siblings.findIndex((item) => item.id === tag.id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
    const target = siblings[targetIndex];
    try {
      await updateHierarchicalTag?.({ ...tag, order: target.order ?? 0, updatedAt: new Date().toISOString() });
      await updateHierarchicalTag?.({ ...target, order: tag.order ?? 0, updatedAt: new Date().toISOString() });
    } catch (error) {
      showToast?.("تعذر تغيير ترتيب الوسوم", "error");
    }
  };

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(FolderTree, { className: "h-6 w-6 text-emerald-400" }),
        title: "الوسوم الهرمية",
        description: "وسوم جذرية وفرعية تظهر في حقول الوسوم عند كتابة الرمز # مع حفظ المسار الكامل للوسم.",
        actions: jsxs("div", { className: "flex flex-wrap gap-2", children: [
          hierarchicalTags.length > 0 && jsxs("button", { type: "button", onClick: expandAll, className: "inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5", children: [jsx(ChevronDown, { className: "h-4 w-4" }), "توسيع الكل"] }),
          hierarchicalTags.length > 0 && jsxs("button", { type: "button", onClick: collapseAll, className: "inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5", children: [jsx(ChevronLeft, { className: "h-4 w-4" }), "طي الكل"] }),
          jsxs("button", { type: "button", onClick: startCreateRoot, className: "va-primary-button inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white", children: [jsx(Plus, { className: "h-4 w-4" }), "وسم جذر"] })
        ] })
      }),
      showForm && jsx(TagForm, {
        tag: editingTag,
        parentTag,
        tags: hierarchicalTags,
        onCancel: () => {
          setShowForm(false);
          setEditingTag(null);
          setParentTag(null);
        },
        onSave: saveTag
      }),
      hierarchicalTags.length > 0 && jsxs("section", { className: "grid gap-3 xl:grid-cols-4", children: [
        jsxs("div", { className: "rounded-2xl va-surface-muted border p-4 text-right", children: [
          jsx("h2", { className: "text-sm font-bold text-white", children: "الأكثر استخداماً" }),
          workspace.usage.length ? jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: workspace.usage.slice(0, 10).map((row) => jsx("button", { type: "button", onClick: () => setQuery(row.name), className: "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 hover:bg-white/10", children: `${row.name} · ${formatNumber(row.count)}` }, row.key)) }) : jsx("p", { className: "mt-3 text-sm text-gray-500", children: "لا توجد وسوم مستخدمة بعد." })
        ] }),
        jsxs("div", { className: "rounded-2xl va-surface-muted border p-4 text-right", children: [
          jsx("h2", { className: "text-sm font-bold text-white", children: "مقترحة من المواد" }),
          workspace.suggestions.length ? jsx("div", { className: "mt-3 space-y-2", children: workspace.suggestions.slice(0, 5).map((row) => jsxs("div", { className: "flex items-center justify-between gap-2 rounded-xl va-surface-subtle border px-3 py-2", children: [
            jsx("span", { className: "truncate text-sm text-gray-200", children: row.name }),
            jsx("button", { type: "button", onClick: () => createSuggestedTag(row), className: "shrink-0 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15", children: "اعتماد" })
          ] }, row.key)) }) : jsx("p", { className: "mt-3 text-sm text-gray-500", children: "لا توجد وسوم غير رسمية متكررة." })
        ] }),
        jsxs("div", { className: "rounded-2xl va-surface-muted border p-4 text-right", children: [
          jsx("h2", { className: "text-sm font-bold text-white", children: "غير مستخدمة" }),
          workspace.unused.length ? jsx("div", { className: "mt-3 space-y-2", children: workspace.unused.slice(0, 5).map((tag) => jsxs("div", { className: "flex items-center justify-between gap-2 rounded-xl va-surface-subtle border px-3 py-2", children: [
            jsx("span", { className: "truncate text-sm text-gray-200", children: tag.name }),
            jsx("button", { type: "button", onClick: () => deleteUnusedTag(tag), className: "shrink-0 rounded-lg border border-red-500/25 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-100 hover:bg-red-500/15", children: "حذف" })
          ] }, tag.id)) }) : jsx("p", { className: "mt-3 text-sm text-gray-500", children: "كل الوسوم مستخدمة." })
        ] }),
        jsxs("div", { className: "rounded-2xl va-surface-muted border p-4 text-right", children: [
          jsx("h2", { className: "text-sm font-bold text-white", children: "مكررة أو متقاربة" }),
          workspace.duplicates.length ? jsx("div", { className: "mt-3 space-y-2", children: workspace.duplicates.slice(0, 4).map((group) => jsxs("div", { className: "rounded-xl va-surface-subtle border p-3", children: [
            jsx("p", { className: "text-sm font-semibold text-white", children: group.entries.map((tag) => tag.name).join("، ") }),
            jsx("button", { type: "button", onClick: () => mergeDuplicateTags(group), className: "mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/15", children: "دمج" })
          ] }, group.key)) }) : jsx("p", { className: "mt-3 text-sm text-gray-500", children: workspace.aliasWarnings.length ? workspace.aliasWarnings[0].message : "لا توجد مكررات ظاهرة." })
        ] })
      ] }),
      hierarchicalTags.length > 0 && jsx("section", {
        className: "grid gap-3 sm:grid-cols-3",
        children: [
          ["كل الوسوم", hierarchicalTags.length, Hash],
          ["وسوم جذر", rootCount, FolderTree],
          ["وسوم فرعية", childCount, ChevronLeft]
        ].map(([label, value, Icon]) => jsxs("div", {
          className: "va-metric-card rounded-2xl va-surface-muted border p-4 text-right",
          children: [
            jsxs("div", { className: "flex items-start justify-between gap-3", children: [
              jsxs("div", { className: "min-w-0", children: [
                jsx("p", { className: "text-xs text-gray-500", children: label }),
                jsx("p", { className: "mt-2 text-2xl font-bold text-white", children: formatNumber(value) })
              ] }),
              jsx("span", { className: "va-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", children: jsx(Icon, { className: "h-5 w-5" }) })
            ] })
          ]
        }, label))
      }),
      hierarchicalTags.length > 0 && jsxs("section", {
        className: "va-filter-surface rounded-2xl va-surface-muted border p-4",
        children: [
          jsxs("label", { className: "relative block", children: [
            jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
            jsx("input", {
              value: query,
              onChange: (event) => setQuery(event.target.value),
              placeholder: "بحث في أسماء الوسوم أو المسارات...",
              className: "min-h-11 w-full va-surface-deep rounded-xl border py-2 pl-3 pr-10 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-emerald-500/40"
            })
          ] }),
          jsx("p", { className: "mt-3 text-xs text-gray-500", children: query.trim() ? `${formatNumber(filteredTags.length)} نتيجة بحث` : "يمكن ترتيب الوسوم أو إضافة فروع من نفس الشجرة." })
        ]
      }),
      query.trim() ? filteredTags.length ? jsx("section", {
        className: "grid gap-3 lg:grid-cols-2",
        children: filteredTags.map((tag, index) => jsx(FlatTagCard, {
          tag,
          tags: hierarchicalTags,
          index,
          onEdit: () => {
            setEditingTag(tag);
            setParentTag(null);
            setShowForm(true);
          },
          onDelete: () => deleteTag(tag)
        }, tag.id))
      }) : jsx("section", {
        className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35",
        children: jsx(EmptyState, {
          type: "search",
          title: "لا توجد وسوم مطابقة",
          description: "جرب كلمة أبسط أو امسح البحث للعودة إلى الشجرة.",
          actionLabel: "مسح البحث",
          onAction: () => setQuery("")
        })
      }) : model.roots.length ? jsx("section", {
        className: "va-card rounded-2xl va-surface-muted border p-4",
        role: "tree",
        "aria-label": "شجرة الوسوم الهرمية",
        children: model.roots.map((tag) => jsx(TagNode, {
          tag,
          level: 0,
          tags: hierarchicalTags,
          model,
          expandedIds,
          onToggle: toggleExpand,
          onCreateChild: startCreateChild,
          onEdit: (item) => {
            setEditingTag(item);
            setParentTag(null);
            setShowForm(true);
          },
          onDelete: deleteTag,
          onMove: moveTag,
          getTagUsageCount
        }, tag.id))
      }) : jsx("section", {
        className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35",
        children: jsx(EmptyState, {
          icon: jsx(FolderTree, { className: "h-16 w-16" }),
          title: "ابدأ شجرة الوسوم",
          description: "أنشئ وسمًا جذرًا ثم أضف فروعًا لتسهيل الاستدعاء عبر #.",
          hintItems: ["# للاستدعاء", "وسوم متشعبة", "بحث فوري"],
          actionLabel: "إنشاء أول وسم",
          onAction: startCreateRoot
        })
      })
    ]
  });
}

HierarchicalTagsPage.pageId = "htags";
HierarchicalTagsPage.migrationStatus = "native";

export default HierarchicalTagsPage;
