import {
  parseAppRoute,
  writeAppRoute
} from "../services/router/index.js";
import {
  useAppStore
} from "../stores/index.js";
import { EntityFormModal } from "../components/common/EntityFormModal.jsx";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { appConfirm, showConfirm } from "../components/common/ConfirmDialog.js";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { MotionPage, PageHero } from "../components/ui/V1Primitives.jsx";
import { reportError } from "../utils/errorReporting.js";
import {
  VOCABULARY_CATEGORIES,
  analyzeVocabularyWorkspace,
  createVocabularyEntryValue,
  createVocabularyRouteParams,
  getFilteredVocabularyEntries,
  getVocabularyCategoryCounts,
  mergeVocabularyEntries,
  parseVocabularyAliases,
  parseVocabularyRouteParams
} from "../features/vocabulary/viewModel.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";


function getCategoryInfo(categoryId) {
  return VOCABULARY_CATEGORIES.find((category) => category.id === categoryId) || VOCABULARY_CATEGORIES[VOCABULARY_CATEGORIES.length - 1];
}

function CategoryButton({ category, count, active, onClick }) {
  return jsxs("button", {
    type: "button",
    onClick,
    className: `inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${active ? "bg-white/10 text-white" : "border-white/10 bg-gray-950/35 text-gray-400 hover:bg-white/5"}`,
    style: active && category.color ? { borderColor: `${category.color}55`, backgroundColor: `${category.color}18` } : undefined,
    children: [
      jsx("span", { className: "h-2.5 w-2.5 rounded-full", style: { backgroundColor: category.color || "#10b981" } }),
      category.label,
      jsx("span", { className: "rounded-full bg-black/20 px-2 py-0.5 text-xs text-gray-300", children: formatNumber(count || 0) })
    ]
  });
}

function VocabularyForm({ entry, activeCategory, onCancel, onSave }) {
  const [term, setTerm] = React.useState(entry?.term || "");
  const [category, setCategory] = React.useState(entry?.category || (activeCategory === "all" ? "other" : activeCategory));
  const [description, setDescription] = React.useState(entry?.description || "");
  const [aliases, setAliases] = React.useState((entry?.aliases || []).join("، "));
  const termId = React.useId();
  const categoryId = React.useId();
  const aliasesId = React.useId();
  const descriptionId = React.useId();
  const termRef = React.useRef(null);
  const defaultCategory = activeCategory === "all" ? "other" : activeCategory;

  const submit = async (keepOpen) => {
    if (!term.trim()) return;
    const ok = await onSave({
      ...entry,
      term,
      category,
      description,
      aliases: parseVocabularyAliases(aliases)
    }, { keepOpen });
    if (ok && keepOpen) {
      setTerm("");
      setDescription("");
      setAliases("");
      setCategory(defaultCategory);
      window.requestAnimationFrame(() => termRef.current?.focus());
    }
  };

  return jsx(EntityFormModal, {
    title: entry ? "تعديل مصطلح" : "مصطلح جديد",
    icon: jsx(BookOpen, { className: "h-4 w-4" }),
    onCancel,
    onSubmit: () => submit(false),
    onSubmitAndNew: () => submit(true),
    canSubmit: Boolean(term.trim()),
    submitLabel: entry ? "حفظ التعديل" : "إضافة المصطلح",
    isEditing: Boolean(entry),
    children: jsxs("div", {
      className: "grid gap-3 md:grid-cols-2",
      children: [
        jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("label", { htmlFor: termId, className: "block", children: "المصطلح" }),
          jsx("input", {
            id: termId,
            ref: termRef,
            "data-autofocus": true,
            value: term,
            onChange: (event) => setTerm(event.target.value),
            className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40",
            placeholder: "مثال: القدس"
          })
        ] }),
        jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
          jsx("label", { htmlFor: categoryId, className: "block", children: "الفئة" }),
          jsx("select", {
            id: categoryId,
            value: category,
            onChange: (event) => setCategory(event.target.value),
            className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40",
            children: VOCABULARY_CATEGORIES.map((item) => jsx("option", { value: item.id, children: item.label }, item.id))
          })
        ] }),
        jsxs("div", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [
          jsx("label", { htmlFor: aliasesId, className: "block", children: "الأسماء المستعارة" }),
          jsx("input", {
            id: aliasesId,
            value: aliases,
            onChange: (event) => setAliases(event.target.value),
            className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40",
            placeholder: "أسماء بديلة مفصولة بفاصلة"
          })
        ] }),
        jsxs("div", { className: "space-y-1 text-sm text-gray-300 md:col-span-2", children: [
          jsx("label", { htmlFor: descriptionId, className: "block", children: "الوصف" }),
          jsx("textarea", {
            id: descriptionId,
            value: description,
            onChange: (event) => setDescription(event.target.value),
            className: "min-h-[86px] w-full va-surface-deep rounded-xl border p-3 text-sm text-white outline-none focus:border-emerald-500/40",
            placeholder: "معلومة قصيرة تساعد فريق الأرشفة على استخدام المصطلح الصحيح"
          })
        ] })
      ]
    })
  });
}

function VocabularyCard({ entry, index, onEdit, onDelete }) {
  const category = getCategoryInfo(entry.category);
  const accentColor = category.color || "#10b981";
  return jsxs(motion.article, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 10) * 0.025 },
    className: "va-entity-card rounded-2xl va-surface-muted border p-4 text-right transition-all hover:border-white/20",
    style: { boxShadow: `inset -3px 0 0 0 ${accentColor}44` },
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "flex items-start justify-between gap-3",
        children: [
          jsxs("div", {
            className: "min-w-0 flex-1",
            children: [
              jsxs("div", {
                className: "flex flex-wrap items-center gap-2",
                children: [
                  jsx("h3", { className: "truncate text-base font-bold text-white", children: entry.term || "مصطلح بدون اسم" }),
                  jsxs("span", {
                    className: "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                    style: { borderColor: `${accentColor}35`, backgroundColor: `${accentColor}14`, color: accentColor },
                    children: [jsx("span", { className: "h-1.5 w-1.5 rounded-full", style: { backgroundColor: accentColor } }), category.label]
                  })
                ]
              }),
              entry.description && jsx("p", { className: "mt-2 line-clamp-2 text-sm leading-relaxed text-gray-400", children: entry.description }),
              entry.aliases?.length > 0 && jsxs("div", {
                className: "mt-3 flex flex-wrap items-center gap-1.5",
                children: [
                  jsx(Tag, { className: "h-3 w-3 shrink-0 text-gray-600" }),
                  entry.aliases.map((alias) => jsx("span", {
                    className: "va-tag-chip inline-flex items-center rounded-full border border-white/8 bg-gray-950/50 px-2 py-0.5 text-xs text-gray-400",
                    children: alias
                  }, alias))
                ]
              })
            ]
          }),
          jsxs("div", {
            className: "flex shrink-0 gap-1",
            children: [
              jsx("button", { type: "button", onClick: onEdit, className: "rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white", "aria-label": `تعديل ${entry.term}`, children: jsx(PenLine, { className: "h-4 w-4" }) }),
              jsx("button", { type: "button", onClick: onDelete, className: "rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-300", "aria-label": `حذف ${entry.term}`, children: jsx(Trash2, { className: "h-4 w-4" }) })
            ]
          })
        ]
      }),
      entry.updatedAt && jsx("p", { className: "mt-3 text-xs text-gray-700", children: `آخر تحديث: ${formatDateTime(entry.updatedAt)}` })
    ]
  }, entry.id);
}

export function VocabularyPage() {
  const {
    vocabulary = [],
    videoItems = [],
    hierarchicalTags = [],
    settings = {},
    addVocabularyEntry,
    updateVocabularyEntry,
    deleteVocabularyEntry,
    showToast,
    showNotification
  } = useAppStore();

  const initialRouteState = React.useMemo(() => parseVocabularyRouteParams(parseAppRoute().params), []);
  const [query, setQuery] = React.useState(initialRouteState.query);
  const [category, setCategory] = React.useState(initialRouteState.category);
  const [page, setPage] = React.useState(initialRouteState.page);
  const [pageSize, setPageSize] = React.useState(initialRouteState.pageSize);
  const [editingEntry, setEditingEntry] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const skipPageReset = React.useRef(true);

  const counts = React.useMemo(() => getVocabularyCategoryCounts(vocabulary), [vocabulary]);
  const filteredEntries = React.useMemo(() => getFilteredVocabularyEntries({ vocabulary, query, category }), [category, query, vocabulary]);
  const workspace = React.useMemo(() => analyzeVocabularyWorkspace({ vocabulary, videoItems, hierarchicalTags }), [hierarchicalTags, videoItems, vocabulary]);
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    const applyRouteState = () => {
      const next = parseVocabularyRouteParams(parseAppRoute().params);
      setQuery(next.query);
      setCategory(next.category);
      setPage(next.page);
      setPageSize(next.pageSize);
    };
    window.addEventListener("hashchange", applyRouteState);
    window.addEventListener("popstate", applyRouteState);
    return () => {
      window.removeEventListener("hashchange", applyRouteState);
      window.removeEventListener("popstate", applyRouteState);
    };
  }, []);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      writeAppRoute("vocabulary", {
        params: createVocabularyRouteParams({ query, category, page: currentPage, pageSize })
      }, settings, true);
    }, 120);
    return () => window.clearTimeout(handle);
  }, [category, currentPage, pageSize, query, settings]);

  React.useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    setPage(1);
  }, [category, pageSize, query]);

  React.useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  const startCreate = () => {
    setEditingEntry(null);
    setShowForm(true);
  };

  const saveEntry = async (draft, opts = {}) => {
    try {
      if (editingEntry) {
        await updateVocabularyEntry?.(createVocabularyEntryValue({
          ...editingEntry,
          ...draft,
          createdAt: editingEntry.createdAt
        }));
        showToast?.("تم تحديث المصطلح", "success");
      } else {
        await addVocabularyEntry?.(createVocabularyEntryValue(draft));
        showToast?.("تمت إضافة المصطلح", "success");
      }
      if (!opts.keepOpen) {
        setShowForm(false);
        setEditingEntry(null);
      }
      return true;
    } catch (error) {
      reportError(showNotification, error, {
        context: "حفظ المصطلح",
        recovery: { run: () => saveEntry(draft, opts) }
      });
      return false;
    }
  };

  const deleteEntry = async (entry) => {
    const confirmed = await showConfirm({
      level: 1,
      title: "حذف مصطلح",
      message: `هل أنت متأكد من حذف المصطلح "${entry.term}"؟`
    });
    if (!confirmed) return;
    try {
      await deleteVocabularyEntry?.(entry.id);
      // Slice now emits its own toast with an "تراجع" action.
    } catch (error) {
      reportError(showNotification, error, {
        context: "حذف المصطلح",
        recovery: { run: () => deleteEntry(entry) }
      });
    }
  };

  const mergeDuplicateGroup = async (group) => {
    const [target, source] = group.entries || [];
    if (!target || !source) return;
    const confirmed = await appConfirm(`دمج "${source.term}" داخل "${target.term}"؟ سيتم نقل المرادفات والوصف ثم حذف النسخة المكررة.`, {
      title: "دمج مصطلحين",
      kind: "warning",
      confirmLabel: "دمج"
    });
    if (!confirmed) return;
    try {
      await updateVocabularyEntry?.(mergeVocabularyEntries(target, source));
      await deleteVocabularyEntry?.(source.id, { skipUndo: true });
      showToast?.("تم دمج المصطلحين", "success");
    } catch (error) {
      reportError(showNotification, error, {
        context: "دمج مصطلحين",
        recovery: { run: () => mergeDuplicateGroup(group) }
      });
    }
  };

  const createTermFromTag = async (tag) => {
    try {
      await addVocabularyEntry?.(createVocabularyEntryValue({ term: tag.name, category: "other", description: "أُنشئ من قائمة وسوم بلا مصطلح." }));
      showToast?.("تم إنشاء مصطلح للوسم", "success");
    } catch (error) {
      reportError(showNotification, error, { context: "إنشاء مصطلح من وسم" });
    }
  };

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(BookOpen, { className: "h-6 w-6 va-accent-text" }),
        title: "القاموس المتحكم به",
        description: "مصطلحات موحدة تظهر في حقول الوسوم والاستدعاء الذكي عند كتابة الرمز @.",
        actions: jsxs("button", { type: "button", onClick: startCreate, className: "va-primary-button inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white", children: [jsx(Plus, { className: "h-4 w-4" }), "مصطلح جديد"] })
      }),
      showForm && jsx(VocabularyForm, {
        entry: editingEntry,
        activeCategory: category,
        onCancel: () => {
          setShowForm(false);
          setEditingEntry(null);
        },
        onSave: saveEntry
      }),
      vocabulary.length > 0 && jsxs("section", { className: "grid gap-3 xl:grid-cols-3", children: [
        jsxs("div", { className: "rounded-2xl va-surface-muted border p-4 text-right", children: [
          jsx("h2", { className: "text-sm font-bold text-white", children: "مكررات تحتاج دمج" }),
          workspace.duplicates.length ? jsx("div", { className: "mt-3 space-y-2", children: workspace.duplicates.slice(0, 4).map((group) => jsxs("div", { className: "rounded-xl va-surface-subtle border p-3", children: [
            jsxs("p", { className: "text-sm font-semibold text-white", children: [group.key, " · ", formatNumber(group.count, settings.numberSystem)] }),
            jsx("p", { className: "mt-1 text-xs text-gray-500", children: group.entries.map((entry) => entry.term).join("، ") }),
            jsx("button", { type: "button", onClick: () => mergeDuplicateGroup(group), className: "mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/15", children: "معاينة ودمج" })
          ] }, group.key)) }) : jsx("p", { className: "mt-3 text-sm text-gray-500", children: "لا توجد مكررات واضحة." })
        ] }),
        jsxs("div", { className: "rounded-2xl va-surface-muted border p-4 text-right", children: [
          jsx("h2", { className: "text-sm font-bold text-white", children: "مصطلحات بلا استخدام" }),
          workspace.unusedTerms.length ? jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: workspace.unusedTerms.slice(0, 10).map((entry) => jsx("button", { type: "button", onClick: () => { setQuery(entry.term); setCategory("all"); }, className: "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 hover:bg-white/10", children: entry.term }, entry.id)) }) : jsx("p", { className: "mt-3 text-sm text-gray-500", children: "كل المصطلحات تظهر في مواد أو وسوم." })
        ] }),
        jsxs("div", { className: "rounded-2xl va-surface-muted border p-4 text-right", children: [
          jsx("h2", { className: "text-sm font-bold text-white", children: "وسوم بلا مصطلح" }),
          workspace.tagsWithoutTerms.length ? jsx("div", { className: "mt-3 space-y-2", children: workspace.tagsWithoutTerms.slice(0, 6).map((tag) => jsxs("div", { className: "flex items-center justify-between gap-2 rounded-xl va-surface-subtle border px-3 py-2", children: [
            jsx("span", { className: "min-w-0 truncate text-sm text-gray-200", children: tag.name }),
            jsx("button", { type: "button", onClick: () => createTermFromTag(tag), className: "shrink-0 rounded-lg border va-accent-border va-accent-bg-soft px-2 py-1 text-xs font-semibold va-accent-text-on-soft hover:bg-emerald-500/15", children: "أنشئ مصطلح" })
          ] }, tag.id)) }) : jsx("p", { className: "mt-3 text-sm text-gray-500", children: "كل الوسوم لها مقابل قاموسي." })
        ] })
      ] }),
      vocabulary.length > 0 && jsxs("section", {
        className: "va-filter-surface rounded-2xl va-surface-muted border p-4",
        children: [
          jsxs("div", {
            className: "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]",
            children: [
              jsxs("label", {
                className: "relative block",
                children: [
                  jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
                  jsx("input", {
                    value: query,
                    onChange: (event) => setQuery(event.target.value),
                    placeholder: "بحث في المصطلحات والأسماء المستعارة...",
                    className: "min-h-11 w-full va-surface-deep rounded-xl border py-2 pl-3 pr-10 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-emerald-500/40"
                  })
                ]
              }),
              jsx("select", {
                value: pageSize,
                onChange: (event) => setPageSize(Number(event.target.value)),
                className: "min-h-11 va-surface-deep rounded-xl border px-3 text-sm text-white outline-none",
                children: [24, 48, 96].map((size) => jsx("option", { value: size, children: `${size} مصطلح` }, size))
              })
            ]
          }),
          jsxs("div", {
            className: "mt-4 flex flex-wrap gap-2",
            children: [
              jsx(CategoryButton, { category: { id: "all", label: "الكل", color: "#10b981" }, count: counts.all, active: category === "all", onClick: () => setCategory("all") }, "all"),
              ...VOCABULARY_CATEGORIES.map((item) => jsx(CategoryButton, { category: item, count: counts[item.id], active: category === item.id, onClick: () => setCategory(item.id) }, item.id))
            ]
          }),
          jsxs("p", { className: "mt-3 flex items-center gap-2 text-xs text-gray-500", children: [jsx(Tag, { className: "h-3.5 w-3.5" }), `${formatNumber(filteredEntries.length, settings.numberSystem)} نتيجة من ${formatNumber(vocabulary.length, settings.numberSystem)} مصطلح`] })
        ]
      }),
      visibleEntries.length ? jsx("section", {
        className: "grid gap-3 lg:grid-cols-2",
        children: visibleEntries.map((entry, index) => jsx(VocabularyCard, {
          entry,
          index,
          onEdit: () => {
            setEditingEntry(entry);
            setShowForm(true);
          },
          onDelete: () => deleteEntry(entry)
        }, entry.id))
      }) : jsx("section", {
        className: "rounded-2xl border border-dashed border-white/10 bg-gray-900/35",
        children: jsx(EmptyState, {
          icon: jsx(BookOpen, { className: "h-16 w-16" }),
          title: vocabulary.length ? "لا توجد مصطلحات مطابقة" : "ابدأ قاموس المصطلحات",
          description: vocabulary.length
            ? "غيّر الفئة أو امسح البحث لعرض المصطلحات."
            : "أضف مصطلحات موحدة ليستخدمها الفريق من خلال الاستدعاء الذكي @.",
          actionLabel: vocabulary.length ? "مسح الفلاتر" : "إضافة أول مصطلح",
          actionIcon: vocabulary.length ? RefreshCw : undefined,
          hintItems: vocabulary.length ? [] : ["@ للاستدعاء", "أسماء مستعارة", "تصنيف بالفئات"],
          onAction: vocabulary.length ? () => { setQuery(""); setCategory("all"); } : startCreate
        })
      }),
      totalPages > 1 && jsxs("div", {
        className: "va-control-surface flex flex-wrap items-center justify-between gap-3 va-surface-muted rounded-2xl border p-3",
        role: "navigation",
        "aria-label": "التنقل بين الصفحات",
        children: [
          jsxs("button", { type: "button", disabled: currentPage <= 1, onClick: () => setPage(currentPage - 1), className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40", children: [jsx(ChevronRight, { className: "h-4 w-4" }), "السابق"] }),
          jsx("p", { className: "text-sm text-gray-500", children: `الصفحة ${formatNumber(currentPage)} من ${formatNumber(totalPages)}` }),
          jsxs("button", { type: "button", disabled: currentPage >= totalPages, onClick: () => setPage(currentPage + 1), className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40", children: ["التالي", jsx(ChevronLeft, { className: "h-4 w-4" })] })
        ]
      })
    ]
  });
}

VocabularyPage.pageId = "vocabulary";
VocabularyPage.migrationStatus = "native";

export default VocabularyPage;
