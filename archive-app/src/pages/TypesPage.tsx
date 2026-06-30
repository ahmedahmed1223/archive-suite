import {
  useAppStore
} from "../stores/index.js";
import { useFocusOnMount } from "../components/common/useFocusOnMount.js";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  FolderOpen,
  Layers3,
  Palette,
  PenLine,
  Plus,
  Search,
  Trash2,
  Workflow,
  X
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";

import { EmptyState } from "../components/common/EmptyState.jsx";
import { EntityFoldersPanel } from "../components/folders/EntityFoldersPanel.jsx";
import { MotionPage, PageHero, WorkflowStepper } from "../components/ui/index.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import {
  FIELD_TYPE_OPTIONS,
  TYPE_COLORS,
  analyzeTypeImpact,
  createContentTypeValue,
  createCustomFieldValue,
  createSubtypeValue,
  getFilteredContentTypes,
  getTypeUsageCounts,
  parseFieldOptions,
  suggestSafeTypeSlug,
  validateContentTypeDraft
} from "../features/types/viewModel.js";
import { formatNumber } from "../utils/formatting.js";
import { reportError } from "../utils/errorReporting.js";


/**
 * Keyboard-accessible color radio group.
 *
 * WAI-ARIA radiogroup pattern: Arrow keys move the selection, Home/End jump to
 * the first/last swatch, and the active swatch is the tab stop (roving tabindex)
 * — so keyboard-only users can pick a type color without reaching for a mouse.
 */
function ColorPicker({ value, onChange }: any) {
  const colors = TYPE_COLORS;
  const activeIndex = Math.max(0, colors.indexOf(value));
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const focusAt = (index: any) => {
    const target = refs.current[index];
    if (target) (target as any).focus();
  };
  const selectAt = (index: any) => onChange(colors[index]);

  const onKeyDown = (event: any) => {
    const lastIndex = colors.length - 1;
    let next = activeIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = activeIndex >= lastIndex ? 0 : activeIndex + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = activeIndex <= 0 ? lastIndex : activeIndex - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = lastIndex;
    else return;
    event.preventDefault();
    selectAt(next);
    focusAt(next);
  };

  return jsx("div", {
    className: "flex flex-wrap gap-2",
    role: "radiogroup",
    "aria-label": "اختر لون النوع",
    onKeyDown,
    children: colors.map((color: any, index: any) => jsx("button", {
      ref: (el: any) => { refs.current[index] = el; },
      type: "button",
      role: "radio",
      "aria-checked": color === value,
      tabIndex: color === value || (value == null && index === 0) ? 0 : -1,
      onClick: () => onChange(color),
      className: `h-8 w-8 rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--va-text)_25%,transparent)] ${color === value ? "scale-110 border-[var(--va-text)] ring-2 ring-[color-mix(in_oklab,var(--va-text)_25%,transparent)]" : "border-[var(--va-border-soft)] hover:scale-105"}`,
      style: { backgroundColor: color },
      "aria-label": `اختيار لون ${color}`
    }, color))
  });
}

function TypeBasicsForm({ draft, setDraft }: any) {
  const updateName = (name: any) => {
    const previousAutoSlug = !draft.nameEn || draft.nameEn === suggestSafeTypeSlug(draft.name || "");
    setDraft({
      ...draft,
      name,
      nameEn: previousAutoSlug ? suggestSafeTypeSlug(name) : draft.nameEn
    });
  };

  // Switched the 3-column row to md: (≥768px). The previous lg: kept the
  // form vertical on standard 13-15" laptops in split-screen mode and on
  // most tablets. Icon column shrunk to 5rem so it doesn't dominate.
  return jsxs("div", {
    className: "grid gap-3 md:grid-cols-[5rem_1.5fr_1.2fr]",
    children: [
      jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)]", children: [
        jsx("span", { children: "الأيقونة" }),
        jsx("input", { value: draft.icon || "📁", onChange: (event: any) => setDraft({ ...draft, icon: event.target.value.slice(0, 4), iconSpec: { type: "emoji", value: event.target.value.slice(0, 4) || "📁" } }), className: "input input-bordered w-full text-center text-xl" })
      ] }),
      jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)]", children: [
        jsx("span", { children: "اسم النوع" }),
        jsx("input", { "data-autofocus": true, value: draft.name || "", onChange: (event: any) => updateName(event.target.value), className: "input input-bordered w-full", placeholder: "مثال: مقابلات" })
      ] }),
      jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)]", children: [
        jsx("span", { children: "اسم داخلي/إنجليزي" }),
        jsx("input", { value: draft.nameEn || "", onChange: (event: any) => setDraft({ ...draft, nameEn: event.target.value }), dir: "ltr", className: "input input-bordered w-full", placeholder: "interviews" })
      ] }),
      jsxs("div", { className: "space-y-1 md:col-span-3", children: [
        jsx("span", { className: "text-sm text-[var(--va-text-2)]", children: "اللون" }),
        jsx(ColorPicker, { value: draft.color, onChange: (color: any) => setDraft({ ...draft, color }) })
      ] })
    ]
  });
}

function SubtypesEditor({ draft, setDraft }: any) {
  const [name, setName] = React.useState("");
  const addSubtype = () => {
    if (!name.trim()) return;
    setDraft({
      ...draft,
      subtypes: [...(draft.subtypes || []), createSubtypeValue({ name, order: draft.subtypes?.length || 0 })]
    });
    setName("");
  };

  const removeSubtype = (id: any) => setDraft({ ...draft, subtypes: (draft.subtypes || []).filter((item: any) => item.id !== id) });

  const handleKey = (event: any) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubtype();
    }
  };
  const subtypes = draft.subtypes || [];

  return jsxs("section", {
    className: "rounded-2xl va-surface-muted border p-4",
    children: [
      jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
        jsx("h3", { className: "text-sm font-bold text-[var(--va-text)]", children: "الفروع" }),
        jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-muted)]", children: `${subtypes.length} فرع` })
      ] }),
      jsxs("div", { className: "mt-3 flex gap-2", children: [
        jsx("input", {
          value: name,
          onChange: (event: any) => setName(event.target.value),
          onKeyDown: handleKey,
          className: "input input-bordered w-full min-w-0 flex-1",
          placeholder: "اسم الفرع (مثلاً: مقابلات سياسية)",
          "aria-label": "اسم الفرع الجديد"
        }),
        jsx("button", {
          type: "button",
          onClick: addSubtype,
          disabled: !name.trim(),
          className: "btn btn-primary shrink-0",
          children: "إضافة"
        })
      ] }),
      subtypes.length ? jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: subtypes.map((subtype: any) => jsxs("span", { className: "inline-flex items-center gap-2 rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-1.5 text-sm text-[var(--va-text-2)]", children: [
        subtype.name,
        jsx("button", { type: "button", onClick: () => removeSubtype(subtype.id), className: "rounded-full p-0.5 text-[var(--va-text-muted)] hover:bg-red-500/15 hover:text-red-300", "aria-label": `حذف الفرع ${subtype.name}`, children: jsx(X, { className: "h-3.5 w-3.5" }) })
      ] }, subtype.id)) }) : jsx("p", { className: "mt-3 text-xs text-[var(--va-text-muted)]", children: "لا توجد فروع بعد. أضف فرعاً لتقسيم العناصر داخل هذا النوع." })
    ]
  });
}

const FIELD_OPTION_TYPES = ["select", "tags", "radio", "multiselect"];

function FieldsEditor({ draft, setDraft, fieldUsage = {} }: any) {
  const [fieldDraft, setFieldDraft] = React.useState({ label: "", type: "text", options: "", required: false, group: "" });
  const [editingFieldId, setEditingFieldId] = React.useState(null);
  const [pendingDeleteFieldId, setPendingDeleteFieldId] = React.useState(null);
  const fields = draft.fields || [];

  const addField = () => {
    if (!fieldDraft.label.trim()) return;
    const field = createCustomFieldValue({
      ...fieldDraft,
      options: parseFieldOptions(fieldDraft.options),
      order: fields.length
    });
    setDraft({ ...draft, fields: [...fields, field] });
    setFieldDraft({ label: "", type: "text", options: "", required: false, group: "" });
  };

  const removeField = (id: any) => {
    setDraft({ ...draft, fields: fields.filter((field: any) => field.id !== id) });
    if (pendingDeleteFieldId === id) setPendingDeleteFieldId(null);
  };
  const requestRemoveField = (field: any) => {
    const impact = fieldUsage[field.id] || fieldUsage[field.storageKey] || fieldUsage[field.name];
    if ((impact?.affectedCount || 0) > 0 && pendingDeleteFieldId !== field.id) {
      setPendingDeleteFieldId(field.id);
      return;
    }
    removeField(field.id);
  };
  const toggleField = (id: any, key: any) => setDraft({ ...draft, fields: fields.map((field: any) => field.id === id ? { ...field, [key]: !field[key] } : field) });
  const updateField = (id: any, patch: any) => setDraft({ ...draft, fields: fields.map((field: any) => field.id === id ? { ...field, ...patch } : field) });
  const moveField = (index: any, dir: any) => {
    const j = index + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[index], next[j]] = [next[j], next[index]];
    setDraft({ ...draft, fields: next.map((field: any, i: any) => ({ ...field, order: i })) });
  };

  const showOptionsInput = FIELD_OPTION_TYPES.includes(fieldDraft.type);

  return jsxs("section", {
    className: "rounded-2xl va-surface-muted border p-4",
    children: [
      jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
        jsxs("div", { className: "flex items-center gap-2", children: [
          jsx("h3", { className: "text-sm font-bold text-[var(--va-text)]", children: "الحقول المخصصة" }),
          fields.length ? jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--va-text-2)]", children: `${fields.length}` }) : null
        ] }),
        jsx("span", { className: "rounded-full border va-accent-border va-accent-bg-soft px-2 py-0.5 text-xs va-accent-text-on-soft", children: "يدعم ملف محلي" })
      ] }),
      jsxs("div", { className: "mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto_auto]", children: [
        jsx("input", {
          value: fieldDraft.label,
          onChange: (event: any) => setFieldDraft({ ...fieldDraft, label: event.target.value }),
          className: "input input-bordered w-full",
          placeholder: "اسم الحقل",
          "aria-label": "اسم الحقل المخصص"
        }),
        jsx("select", {
          value: fieldDraft.type,
          onChange: (event: any) => setFieldDraft({ ...fieldDraft, type: event.target.value }),
          className: "select select-bordered w-full",
          "aria-label": "نوع الحقل",
          children: FIELD_TYPE_OPTIONS.map((type: any) => jsx("option", { value: type.id, children: type.label }, type.id))
        }),
        jsxs("label", {
          className: `inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors ${fieldDraft.required ? "border-amber-500/35 bg-amber-500/15 text-amber-100" : "border-[var(--va-border-soft)] bg-[var(--va-surface-2)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]"}`,
          children: [
            jsx("input", { type: "checkbox", checked: fieldDraft.required, onChange: (event: any) => setFieldDraft({ ...fieldDraft, required: event.target.checked }) }),
            "مطلوب"
          ]
        }),
        jsx("button", {
          type: "button",
          onClick: addField,
          disabled: !fieldDraft.label.trim(),
          className: "btn btn-primary",
          children: "إضافة الحقل"
        })
      ] }),
      jsxs("div", { className: "mt-2 grid gap-2 sm:grid-cols-2", children: [
        jsxs("label", { className: "rounded-xl va-surface-muted border px-3 py-2", children: [
          jsx("span", { className: "block text-[11px] font-medium text-[var(--va-text-muted)]", children: "المجموعة / التبويب (اختياري)" }),
          jsx("input", { value: fieldDraft.group, onChange: (event: any) => setFieldDraft({ ...fieldDraft, group: event.target.value }), className: "mt-1 min-h-9 w-full bg-transparent text-sm text-[var(--va-text)] outline-none", placeholder: "مثال: معلومات أساسية", "aria-label": "مجموعة الحقل" })
        ] }),
        showOptionsInput ? jsxs("label", { className: "rounded-xl va-surface-muted border px-3 py-2", children: [
          jsx("span", { className: "block text-[11px] font-medium text-[var(--va-text-muted)]", children: "خيارات الحقل (مفصولة بفاصلة)" }),
          jsx("input", { value: fieldDraft.options, onChange: (event: any) => setFieldDraft({ ...fieldDraft, options: event.target.value }), className: "mt-1 min-h-9 w-full bg-transparent text-sm text-[var(--va-text)] outline-none", placeholder: "خيار 1، خيار 2، خيار 3", "aria-label": "قيم الخيارات" })
        ] }) : null
      ] }),
      fields.length ? jsx("div", { className: "mt-3 space-y-2", children: fields.map((field: any, index: any) => {
        const impact = fieldUsage[field.id] || fieldUsage[field.storageKey] || fieldUsage[field.name];
        const affectedCount = impact?.affectedCount || 0;
        return jsxs("div", {
        className: "rounded-xl va-surface-muted border p-3",
        children: [
          jsxs("div", { className: "grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]", children: [
            jsxs("div", { className: "min-w-0", children: [
              jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold text-[var(--va-text)]", children: [
                jsx("span", { className: "truncate", children: field.label }),
                field.group ? jsx("span", { className: "shrink-0 rounded border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--va-text-muted)]", children: field.group }) : null
              ] }),
              jsx("p", { className: "truncate text-xs text-[var(--va-text-muted)] font-mono", dir: "ltr", children: field.storageKey || field.name })
            ] }),
            jsxs("div", { className: "flex flex-wrap items-center gap-1", children: [
              jsx("span", { className: "shrink-0 rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2.5 py-1 text-xs text-[var(--va-text-2)]", children: FIELD_TYPE_OPTIONS.find((type: any) => type.id === field.type)?.label || field.type }),
              affectedCount > 0 && jsx("span", { className: "shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-100", children: `مستخدم في ${affectedCount}` })
            ] }),
            jsxs("div", { className: "flex shrink-0 items-center gap-1", children: [
              jsx("button", { type: "button", onClick: () => moveField(index, -1), disabled: index === 0, "aria-label": "تحريك لأعلى", className: "rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-1.5 text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-elevated)] disabled:opacity-30", children: jsx(ChevronUp, { className: "h-3.5 w-3.5" }) }),
              jsx("button", { type: "button", onClick: () => moveField(index, 1), disabled: index === fields.length - 1, "aria-label": "تحريك لأسفل", className: "rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-1.5 text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-elevated)] disabled:opacity-30", children: jsx(ChevronDown, { className: "h-3.5 w-3.5" }) })
            ] }),
            jsxs("div", { className: "flex shrink-0 items-center gap-1", children: [
              jsx("button", { type: "button", onClick: () => toggleField(field.id, "required"), "aria-pressed": !!field.required, className: `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${field.required ? "border-amber-500/35 bg-amber-500/15 text-amber-100" : "border-[var(--va-border-soft)] bg-[var(--va-surface-2)] text-[var(--va-text-muted)] hover:bg-[var(--va-elevated)]"}`, children: field.required ? "مطلوب" : "اختياري" }),
              jsx("button", { type: "button", onClick: () => setEditingFieldId(editingFieldId === field.id ? null : field.id), "aria-pressed": editingFieldId === field.id, "aria-label": "تحرير الحقل", className: `rounded-lg border p-1.5 transition-colors ${editingFieldId === field.id ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-[var(--va-border-soft)] bg-[var(--va-surface-2)] text-[var(--va-text-2)] hover:bg-[var(--va-elevated)]"}`, children: jsx(PenLine, { className: "h-3.5 w-3.5" }) }),
              jsx("button", { type: "button", onClick: () => requestRemoveField(field), "aria-label": `حذف الحقل ${field.label}`, className: "rounded-lg border border-transparent p-1.5 text-red-300 transition-colors hover:border-red-500/25 hover:bg-red-500/10", children: jsx(Trash2, { className: "h-3.5 w-3.5" }) })
            ] })
          ] }),
          pendingDeleteFieldId === field.id && affectedCount > 0 ? jsxs("div", { className: "mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-6 text-amber-50", children: [
            jsxs("div", { className: "flex items-start gap-2", children: [
              jsx(AlertTriangle, { className: "mt-0.5 h-4 w-4 shrink-0 text-amber-200" }),
              jsxs("p", { children: [
                "هذا الحقل يحتوي بيانات في ",
                formatNumber(affectedCount),
                " مادة. حذفه من النموذج سيخفي هذه القيم من واجهات التحرير، ولن يحذف المواد نفسها."
              ] })
            ] }),
            impact?.sampleItems?.length ? jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: impact.sampleItems.map((item: any) => jsx("span", { className: "rounded-full border border-amber-500/20 bg-[var(--va-surface-2)] px-2 py-0.5 text-[11px]", children: item.title }, item.id)) }) : null,
            jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [
              jsx("button", { type: "button", onClick: () => setPendingDeleteFieldId(null), className: "rounded-lg border border-[var(--va-border-soft)] px-3 py-1.5 text-xs text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: "إلغاء" }),
              jsx("button", { type: "button", onClick: () => removeField(field.id), className: "rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20", children: "إخفاء الحقل من النوع" })
            ] })
          ] }) : null,
          editingFieldId === field.id ? jsxs("div", { className: "mt-3 grid gap-2 border-t border-[var(--va-border-soft)] pt-3 sm:grid-cols-2", children: [
            jsxs("label", { className: "block text-xs text-[var(--va-text-muted)]", children: [
              jsx("span", { className: "block", children: "المجموعة / التبويب" }),
              jsx("input", { value: field.group || "", onChange: (event: any) => updateField(field.id, { group: event.target.value }), className: "input input-bordered w-full mt-1", placeholder: "بدون مجموعة" })
            ] }),
            FIELD_OPTION_TYPES.includes(field.type) ? jsxs("label", { className: "block text-xs text-[var(--va-text-muted)]", children: [
              jsx("span", { className: "block", children: "الخيارات (مفصولة بفاصلة)" }),
              jsx("input", { value: (field.options || []).join("، "), onChange: (event: any) => updateField(field.id, { options: parseFieldOptions(event.target.value) }), className: "input input-bordered w-full mt-1", placeholder: "خيار 1، خيار 2" })
            ] }) : null,
            jsxs("div", { className: "block text-xs text-[var(--va-text-muted)]", children: [
              jsx("span", { className: "block", children: "إلزامية الحفظ" }),
              jsx("button", { type: "button", onClick: () => updateField(field.id, { requiredToSave: !field.requiredToSave }), "aria-pressed": !!field.requiredToSave, className: `mt-1 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm transition-colors ${field.requiredToSave ? "border-amber-500/35 bg-amber-500/15 text-amber-100" : "border-[var(--va-border-soft)] bg-[var(--va-surface-2)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]"}`, children: field.requiredToSave ? "يمنع الحفظ إن كان فارغاً" : "غير إلزامي للحفظ" })
            ] }),
            jsxs("div", { className: "block text-xs text-[var(--va-text-muted)] sm:col-span-2", children: [
              jsx("span", { className: "block", children: "إظهار شرطي — أظهر هذا الحقل فقط عندما يساوي حقلٌ آخر قيمةً معيّنة" }),
              jsxs("div", { className: "mt-1 grid gap-2 sm:grid-cols-2", children: [
                jsxs("select", { value: field.showWhen?.fieldKey || "", onChange: (event: any) => updateField(field.id, { showWhen: event.target.value ? { fieldKey: event.target.value, equals: field.showWhen?.equals ?? "" } : null }), className: "select select-bordered w-full", children: [
                  jsx("option", { value: "", children: "دائماً (بلا شرط)" }),
                  ...fields.filter((other: any) => other.id !== field.id).map((other: any) => jsx("option", { value: other.storageKey || other.name, children: other.label }, other.id))
                ] }),
                jsx("input", { value: field.showWhen?.equals ?? "", onChange: (event: any) => updateField(field.id, { showWhen: field.showWhen?.fieldKey ? { fieldKey: field.showWhen.fieldKey, equals: event.target.value } : null }), disabled: !field.showWhen?.fieldKey, placeholder: "القيمة المطلوبة", className: "input input-bordered w-full disabled:opacity-40" })
              ] })
            ] })
          ] }) : null
        ]
      }, field.id);
      }) }) : jsx("p", { className: "mt-3 text-xs text-[var(--va-text-muted)]", children: "لا توجد حقول مخصصة بعد." })
    ]
  });
}

function TypeValidationPanel({ validation }: any) {
  if (!validation?.conflicts?.length) {
    return jsx("p", {
      className: "rounded-xl border va-accent-border va-accent-bg-soft p-3 text-xs leading-6 va-accent-text-on-soft",
      role: "status",
      "aria-live": "polite",
      children: "لا توجد تعارضات ظاهرة. راجع الملخص ثم احفظ النوع."
    });
  }

  return jsxs("section", {
    className: "rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-right",
    role: validation.canSave ? "status" : "alert",
    "aria-live": validation.canSave ? "polite" : "assertive",
    children: [
      jsx("h3", { className: "text-sm font-bold text-amber-100", children: validation.canSave ? "تنبيهات قبل الحفظ" : "أصلح هذه النقاط قبل الحفظ" }),
      jsx("ul", { className: "va-rtl-list mt-2 space-y-1 text-xs leading-6 text-amber-50", children: validation.conflicts.map((issue: any, index: any) => jsx("li", { children: issue.message }, `${issue.code}-${index}`)) }),
      validation.suggestedNameEn ? jsxs("p", { className: "mt-2 text-xs text-amber-100", children: [
        "اقتراح الاسم الداخلي: ",
        jsx("span", { dir: "ltr", className: "font-mono", children: validation.suggestedNameEn })
      ] }) : null
    ]
  });
}

import { getProgramTypeOptions, getGenreOptions, getRoleOptions } from "../utils/broadcastVocabulary.js";

const BROADCAST_PROGRAM_LABELS = getProgramTypeOptions().slice(0, 12).map((o: any) => o.label);
const BROADCAST_GENRE_LABELS = getGenreOptions().map((o: any) => o.label);
const BROADCAST_ROLE_LABELS = getRoleOptions().map((o: any) => o.label);

const TYPE_CREATION_TEMPLATES = [
  { id: "news_bulletin", name: "نشرة إخبارية", icon: "📡", color: "#ef4444", subtypes: ["عاجلة", "رئيسية", "إقليمية", "دولية"], fields: [["المقدم", "anchor", "text"], ["نوع البرنامج", "programType", "select", BROADCAST_PROGRAM_LABELS], ["التصنيف", "genre", "select", BROADCAST_GENRE_LABELS], ["موعد البث", "broadcastAt", "date"]] },
  { id: "tv_interview", name: "مقابلة تلفزيونية", icon: "🎙️", color: "#10b981", subtypes: ["استوديو", "ميدانية", "هاتفية", "عن بعد"], fields: [["الضيف", "guest", "text"], ["الدور", "guestRole", "select", BROADCAST_ROLE_LABELS], ["الموقع", "location", "text"], ["تاريخ التسجيل", "recordedAt", "date"]] },
  { id: "interview", name: "مقابلة", icon: "🎙️", color: "#10b981", subtypes: ["كاملة", "مقتطف", "عن بعد"], fields: [["الضيف", "guest", "text"], ["الموقع", "location", "text"], ["تاريخ التسجيل", "recordedAt", "date"]] },
  { id: "report", name: "تقرير", icon: "📋", color: "#f59e0b", subtypes: ["إخباري", "تحقيقي", "تحليلي", "ميداني"], fields: [["المراسل", "reporter", "text"], ["المنطقة", "region", "text"], ["المصدر", "source", "text"], ["حالة المراجعة", "reviewStatus", "select", ["يحتاج مراجعة", "قيد المراجعة", "معتمد"]]] },
  { id: "rawfootage", name: "لقطة خام", icon: "🎞️", color: "#14b8a6", subtypes: ["ميدانية", "استوديو", "B-roll", "كواليس"], fields: [["الموقع", "location", "text"], ["المصور", "cameraman", "text"], ["حقوق الاستخدام", "rights", "select", ["داخلي", "مرخص", "غير معروف"]]] },
  { id: "archive_material", name: "مادة أرشيفية", icon: "🗄️", color: "#6366f1", subtypes: ["تاريخية", "وثائقية", "إعلامية", "شخصية"], fields: [["السنة", "year", "text"], ["الجهة المانحة", "donor", "text"], ["حقوق الاستخدام", "rights", "select", ["داخلي", "مرخص", "مقيد", "غير معروف"]], ["الحالة المادية", "condition", "select", ["ممتازة", "جيدة", "متدهورة", "تحتاج ترميم"]]] },
  { id: "lecture", name: "محاضرة", icon: "🎓", color: "#3b82f6", subtypes: ["كاملة", "جزء", "أسئلة"], fields: [["المحاضر", "speaker", "text"], ["المحور", "topic", "text"], ["المدة", "duration", "duration"]] },
  { id: "news", name: "خبر", icon: "🧾", color: "#ef4444", subtypes: ["عاجل", "عادي", "تحليل"], fields: [["المصدر", "source", "text"], ["حالة المراجعة", "reviewStatus", "select", ["يحتاج مراجعة", "قيد المراجعة", "معتمد"]]] },
  { id: "photo", name: "صورة", icon: "🖼️", color: "#8b5cf6", subtypes: ["لقطة", "غلاف", "كواليس"], fields: [["المصور", "photographer", "text"], ["حقوق الاستخدام", "rights", "select", ["داخلي", "مرخص", "غير معروف"]]] },
  { id: "document", name: "مستند", icon: "📄", color: "#6b7280", subtypes: ["PDF", "Word", "ملف داعم"], fields: [["الجهة المالكة", "owner", "text"], ["رقم المرجع", "referenceId", "text"]] }
];

const TYPE_EDITOR_STEPS = [
  { id: "basics", label: "أساسيات", detail: "اسم وأيقونة وقالب" },
  { id: "subtypes", label: "فروع", detail: "تقسيم داخلي" },
  { id: "fields", label: "حقول", detail: "محرر ومعاينة" },
  { id: "review", label: "مراجعة", detail: "كيف سيظهر قبل الحفظ" }
];

function createTypeFromTemplate(template: any) {
  return createContentTypeValue({
    name: template.name,
    nameEn: template.id,
    icon: template.icon,
    iconSpec: { type: "emoji", value: template.icon },
    color: template.color,
    subtypes: template.subtypes.map((name: any, index: any) => createSubtypeValue({ name, order: index })),
    fields: template.fields.map(([label, storageKey, fieldType, options]: any, index: any) => createCustomFieldValue({
      label,
      storageKey,
      type: fieldType,
      options,
      order: index,
      required: index === 0
    }))
  });
}

function TypeFormPreview({ draft }: any) {
  return jsxs("section", {
    className: "rounded-2xl va-surface-muted border p-4",
    children: [
      jsxs("div", { className: "flex items-start gap-3", children: [
        jsx("span", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl", style: { backgroundColor: `${draft.color || "#6366f1"}22`, color: draft.color || "#6366f1" }, children: draft.icon || "📁" }),
        jsxs("div", { className: "min-w-0", children: [
          jsx("h3", { className: "text-base font-bold text-[var(--va-text)]", children: draft.name || "نوع جديد" }),
          jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", children: `${formatNumber(draft.subtypes?.length || 0)} فروع · ${formatNumber(draft.fields?.length || 0)} حقول` })
        ] })
      ] }),
      jsx("div", { className: "mt-4 grid gap-2 sm:grid-cols-2", children: (draft.fields || []).slice(0, 6).map((field: any) => jsxs("label", { className: "rounded-xl va-surface-muted border p-3 text-xs text-[var(--va-text-muted)]", children: [
        jsx("span", { className: "block", children: field.label }),
        jsx("span", { className: "mt-2 block min-h-9 rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-2 text-[var(--va-text-muted)]", children: FIELD_TYPE_OPTIONS.find((option: any) => option.id === field.type)?.label || field.type })
      ] }, field.id)) }),
      !(draft.fields || []).length && jsx("p", { className: "mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100", children: "لا توجد حقول بعد. سيظهر نموذج إضافة المادة بالحقول الأساسية فقط." })
    ]
  });
}

function TypeEditor({ type, fieldUsage = {}, contentTypes = [], videoItems = [], saving = false, onCancel, onSave }: any) {
  const [draft, setDraft] = React.useState(() => createContentTypeValue(type || { name: "", icon: "📁", color: "#6366f1" }));
  const [activeStep, setActiveStep] = React.useState("basics");
  const formRef = useFocusOnMount();
  const activeStepIndex = TYPE_EDITOR_STEPS.findIndex((step: any) => step.id === activeStep);
  const validation = React.useMemo(() => validateContentTypeDraft(draft, {
    contentTypes,
    previousType: type,
    videoItems
  }), [contentTypes, draft, type, videoItems]);

  const save = () => {
    if (!draft.name.trim() || !validation.canSave || saving) return;
    onSave(createContentTypeValue(draft));
  };
  const goNext = () => setActiveStep(TYPE_EDITOR_STEPS[Math.min(TYPE_EDITOR_STEPS.length - 1, activeStepIndex + 1)]?.id || "review");
  const goBack = () => setActiveStep(TYPE_EDITOR_STEPS[Math.max(0, activeStepIndex - 1)]?.id || "basics");
  const applyTemplate = (template: any) => setDraft(createTypeFromTemplate(template));

  return jsxs("section", {
    ref: formRef,
    className: "space-y-5 rounded-2xl border va-accent-border va-accent-bg-soft p-5 text-right",
    dir: "rtl",
    children: [
      jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        jsx("h2", { className: "text-base font-bold text-[var(--va-text)]", children: type ? "تعديل نوع محتوى" : "نوع محتوى جديد" }),
        jsxs("div", { className: "flex flex-wrap gap-2", children: [
          jsx("button", { type: "button", onClick: onCancel, disabled: saving, className: "rounded-xl border border-[var(--va-border-soft)] px-4 py-2 text-sm text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] disabled:cursor-not-allowed disabled:opacity-40", children: "إلغاء" }),
          activeStepIndex > 0 && jsx("button", { type: "button", onClick: goBack, className: "rounded-xl border border-[var(--va-border-soft)] px-4 py-2 text-sm text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: "السابق" }),
          activeStep !== "review" ? jsx("button", { type: "button", onClick: goNext, disabled: activeStep === "basics" && !draft.name.trim(), className: "btn btn-primary", children: "التالي" }) : jsx("button", { type: "button", onClick: save, disabled: !draft.name.trim() || !validation.canSave || saving, className: "btn btn-primary", children: saving ? "يحفظ..." : type ? "حفظ النوع" : "إنشاء النوع" })
        ] })
      ] }),
      jsx(WorkflowStepper, { steps: TYPE_EDITOR_STEPS, activeStepId: activeStep, completedStepIds: TYPE_EDITOR_STEPS.slice(0, activeStepIndex).map((step: any) => step.id), compact: true, className: "sm:grid-cols-2 xl:grid-cols-4" }),
      jsx(TypeValidationPanel, { validation }),
      activeStep === "basics" && jsxs("div", { className: "space-y-4", children: [
        !type && jsx("div", { className: "grid gap-2 sm:grid-cols-2 xl:grid-cols-3", children: TYPE_CREATION_TEMPLATES.map((template: any) => jsxs("button", { type: "button", onClick: () => applyTemplate(template), className: "rounded-xl va-surface-muted border p-3 text-right hover:border-emerald-500/25", children: [
          jsx("span", { className: "text-xl", children: template.icon }),
          jsx("span", { className: "mt-2 block text-sm font-semibold text-[var(--va-text)]", children: template.name }),
          jsx("span", { className: "mt-1 block text-xs text-[var(--va-text-muted)]", children: `${template.subtypes.length} فروع · ${template.fields.length} حقول` })
        ] }, template.id)) }),
        jsx(TypeBasicsForm, { draft, setDraft })
      ] }),
      activeStep === "subtypes" && jsx(SubtypesEditor, { draft, setDraft }),
      activeStep === "fields" && jsxs("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]", children: [
        jsx(FieldsEditor, { draft, setDraft, fieldUsage }),
        jsx(TypeFormPreview, { draft })
      ] }),
      activeStep === "review" && jsxs("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]", children: [
        jsx(TypeFormPreview, { draft }),
        jsxs("div", { className: "space-y-4", children: [
          jsxs("div", { className: "rounded-2xl va-surface-muted border p-4", children: [
            jsx("h3", { className: "text-sm font-bold text-[var(--va-text)]", children: "ملخص قبل الحفظ" }),
            jsx("ul", { className: "va-rtl-list mt-3 space-y-2 text-sm text-[var(--va-text-muted)]", children: [
              `الاسم: ${draft.name || "بدون اسم"}`,
              `الفروع: ${draft.subtypes?.length || 0}`,
              `الحقول: ${draft.fields?.length || 0}`,
              `حقول مطلوبة: ${(draft.fields || []).filter((field: any) => field.required || field.requiredToSave).length}`
            ].map((line: any) => jsx("li", { children: line }, line)) }),
            jsx("p", { className: "mt-4 rounded-xl border va-accent-border va-accent-bg-soft p-3 text-xs leading-6 va-accent-text-on-soft", children: "بعد الحفظ سيظهر هذا النوع في صفحة الإضافة وصفحة التفاصيل بنفس ترتيب الحقول." })
          ] }),
          (() => {
            if (!type) return null;
            const impact = analyzeTypeImpact(type, videoItems);
            if (!impact.affectedCount) return null;
            const removedFields = (type.fields || []).filter((f: any) => !(draft.fields || []).some((df: any) => df.id === f.id));
            const addedFields = (draft.fields || []).filter((f: any) => !(type.fields || []).some((tf: any) => tf.id === f.id));
            const hasChanges = removedFields.length > 0 || addedFields.length > 0 || draft.name !== type.name;
            if (!hasChanges) return null;
            return jsxs("div", { className: "rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4", children: [
              jsxs("div", { className: "flex items-start gap-2", children: [
                jsx(AlertTriangle, { className: "mt-0.5 h-4 w-4 shrink-0 text-amber-300" }),
                jsxs("div", { children: [
                  jsx("h3", { className: "text-sm font-bold text-amber-100", children: `تأثير التعديل على ${formatNumber(impact.affectedCount)} مادة` }),
                  jsx("p", { className: "mt-1 text-xs text-amber-200/80", children: "التعديلات التالية ستؤثر على المواد المرتبطة بهذا النوع:" })
                ] })
              ] }),
              jsxs("div", { className: "mt-3 space-y-2", children: [
                removedFields.length > 0 && jsxs("div", { className: "rounded-lg border border-red-500/20 bg-red-500/10 p-2.5", children: [
                  jsx("p", { className: "text-xs font-semibold text-red-200", children: `حقول ستُزال (${formatNumber(removedFields.length)}):` }),
                  jsx("p", { className: "mt-1 text-xs text-red-200/70", children: removedFields.map((f: any) => f.label).join(" · ") })
                ] }),
                addedFields.length > 0 && jsxs("div", { className: "rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5", children: [
                  jsx("p", { className: "text-xs font-semibold text-emerald-200", children: `حقول جديدة (${formatNumber(addedFields.length)}):` }),
                  jsx("p", { className: "mt-1 text-xs text-emerald-200/70", children: addedFields.map((f: any) => f.label).join(" · ") })
                ] }),
                impact.sampleItems.length > 0 && jsxs("div", { className: "rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2.5", children: [
                  jsx("p", { className: "text-xs font-semibold text-[var(--va-text-2)]", children: "عينة من المواد المتأثرة:" }),
                  jsx("div", { className: "mt-1.5 space-y-1", children: impact.sampleItems.slice(0, 3).map((item: any) => jsx("p", { className: "truncate text-xs text-[var(--va-text-muted)]", children: item.title }, item.id)) })
                ] })
              ] })
            ] });
          })()
        ] })
      ] })
    ]
  });
}

function TypeImpactSheet({ type, impact, settings = {}, onCancel, onArchive }: any) {
  const numberSystem = settings.numberSystem;
  const fieldImpacts = (impact?.fieldImpacts || []).filter((item: any) => item.affectedCount > 0);
  const subtypeRows = (type?.subtypes || []).map((subtype: any) => ({
    id: subtype.id,
    name: subtype.name,
    count: impact?.subtypeCounts?.[subtype.id] || 0
  })).filter((row: any) => row.count > 0);

  return jsx("div", {
    className: "fixed inset-0 z-50 flex items-end bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:justify-center",
    role: "dialog",
    "aria-modal": true,
    "aria-labelledby": "type-impact-title",
    dir: "rtl",
    children: jsxs("section", {
      className: "max-h-[calc(100vh-2rem)] w-full overflow-auto rounded-2xl border border-amber-500/25 bg-[var(--va-elevated)] p-5 text-right shadow-2xl sm:max-w-2xl",
      children: [
        jsxs("div", { className: "flex items-start justify-between gap-3", children: [
          jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
            jsx("span", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-100", children: jsx(AlertTriangle, { className: "h-5 w-5" }) }),
            jsxs("div", { className: "min-w-0", children: [
              jsx("h2", { id: "type-impact-title", className: "text-base font-bold text-[var(--va-text)]", children: `تحليل أثر أرشفة ${type?.name || "نوع المحتوى"}` }),
              jsx("p", { className: "mt-1 text-sm leading-6 text-[var(--va-text-muted)]", children: "الأرشفة لا تحذف المواد، لكنها تمنع استخدام النوع في إنشاء مواد جديدة وقد تخفي حقوله من مسارات التحرير اليومية." })
            ] })
          ] }),
          jsx("button", { type: "button", onClick: onCancel, className: "rounded-lg p-2 text-[var(--va-text-muted)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]", "aria-label": "إغلاق", children: jsx(X, { className: "h-4 w-4" }) })
        ] }),
        jsx("div", { className: "mt-5 grid gap-3 sm:grid-cols-3", children: [
          ["مواد مرتبطة", impact?.affectedCount || 0],
          ["قيم حقول محفوظة", impact?.filledFieldCount || 0],
          ["حقول متأثرة", fieldImpacts.length]
        ].map(([label, value]: any) => jsxs("div", { className: "rounded-xl va-surface-muted border p-3", children: [
          jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: label }),
          jsx("p", { className: "mt-2 text-xl font-bold text-[var(--va-text)]", children: formatNumber(value, numberSystem) })
        ] }, label)) }),
        fieldImpacts.length ? jsxs("section", { className: "mt-4 rounded-xl va-surface-muted border p-3", children: [
          jsx("h3", { className: "text-sm font-bold text-[var(--va-text)]", children: "الحقول التي تحتوي بيانات" }),
          jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: fieldImpacts.map((field: any) => jsxs("span", { className: "rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-100", children: [
            field.label,
            " · ",
            formatNumber(field.affectedCount, numberSystem)
          ] }, field.fieldId)) })
        ] }) : null,
        subtypeRows.length ? jsxs("section", { className: "mt-4 rounded-xl va-surface-muted border p-3", children: [
          jsx("h3", { className: "text-sm font-bold text-[var(--va-text)]", children: "الفروع المستخدمة" }),
          jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: subtypeRows.map((subtype: any) => jsxs("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-1 text-xs text-[var(--va-text-2)]", children: [
            subtype.name,
            " · ",
            formatNumber(subtype.count, numberSystem)
          ] }, subtype.id)) })
        ] }) : null,
        impact?.sampleItems?.length ? jsxs("section", { className: "mt-4 rounded-xl va-surface-muted border p-3", children: [
          jsx("h3", { className: "text-sm font-bold text-[var(--va-text)]", children: "عينات مواد مرتبطة" }),
          jsx("div", { className: "mt-2 grid gap-2 sm:grid-cols-2", children: impact.sampleItems.map((item: any) => jsx("div", { className: "truncate rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text-2)]", children: item.title }, item.id)) })
        ] }) : null,
        jsxs("div", { className: "mt-5 flex flex-wrap justify-end gap-2", children: [
          jsx("button", { type: "button", onClick: onCancel, className: "rounded-xl border border-[var(--va-border-soft)] px-4 py-2 text-sm text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: "إلغاء" }),
          jsx("button", { type: "button", onClick: onArchive, className: "rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-50 hover:bg-red-500/20", children: "أرشفة مع إبقاء المواد" })
        ] })
      ]
    })
  });
}

function TypeCard({ type, count, active, index, onOpen, onEdit, onArchive }: any) {
  const accentColor = type.color || "#6366f1";
  return jsxs(motion.article, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 10) * 0.025 },
    onClick: onOpen,
    className: `va-entity-card cursor-pointer rounded-2xl border p-4 text-right transition-all ${active ? "va-accent-border va-accent-bg-soft" : "border-[var(--va-border-soft)] bg-[var(--va-surface)] hover:border-[var(--va-border-strong)]"}`,
    style: { boxShadow: `inset -3px 0 0 0 ${accentColor}${active ? "88" : "44"}` },
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
          jsx("span", {
            className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl",
            style: { backgroundColor: `${accentColor}22`, color: accentColor, boxShadow: `0 0 0 1px ${accentColor}30` },
            children: type.icon || "📁"
          }),
          jsxs("div", { className: "min-w-0", children: [
            jsx("h3", { className: "truncate text-base font-bold text-[var(--va-text)]", children: type.name || "نوع بدون اسم" }),
            jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", children: `${formatNumber(count)} عنصر، ${formatNumber(type.subtypes?.length || 0)} فرع، ${formatNumber(type.fields?.length || 0)} حقل` }),
            type.status === "archived" && jsx("span", { className: "mt-2 inline-block rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200", children: "مؤرشف" })
          ] })
        ] }),
        jsxs("div", { className: "flex shrink-0 gap-1", onClick: (event: any) => event.stopPropagation(), children: [
          jsx("button", { type: "button", onClick: onEdit, className: "rounded-lg p-2 text-[var(--va-text-muted)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]", "aria-label": `تعديل ${type.name}`, children: jsx(PenLine, { className: "h-4 w-4" }) }),
          jsx("button", { type: "button", onClick: onArchive, className: "rounded-lg p-2 text-[var(--va-text-muted)] hover:bg-red-500/10 hover:text-red-300", "aria-label": `أرشفة ${type.name}`, children: jsx(Trash2, { className: "h-4 w-4" }) })
        ] })
      ] })
    ]
  }, type.id);
}

function TypeDetailScreen({ type, count = 0, settings = {}, onBack, onEdit, onArchive }: any) {
  const fields = type?.fields || [];
  const subtypes = type?.subtypes || [];
  const accent = type?.color || "#6366f1";
  const numberSystem = settings.numberSystem;

  return jsxs("section", {
    className: "va-preview-panel space-y-5 rounded-2xl va-surface-muted border p-4 text-right",
    dir: "rtl",
    children: [
      jsxs("header", { className: "grid gap-4 border-b border-[var(--va-border-soft)] pb-4 lg:grid-cols-[auto_1fr_auto]", children: [
        jsxs("button", {
          type: "button",
          onClick: onBack,
          className: "btn btn-ghost btn-sm gap-2 self-start",
          "aria-label": "رجوع إلى قائمة الأنواع",
          children: [jsx(ArrowRight, { className: "h-4 w-4" }), "رجوع"]
        }),
        jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
          jsx("span", {
            className: "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl",
            style: { backgroundColor: `${accent}22`, color: accent, boxShadow: `0 0 0 1px ${accent}35` },
            children: type?.icon || "📁"
          }),
          jsxs("div", { className: "min-w-0", children: [
            jsx("h2", { className: "text-xl font-bold text-[var(--va-text)]", children: type?.name || "نوع محتوى" }),
            jsx("p", { className: "mt-1 truncate text-xs text-[var(--va-text-muted)]", dir: "ltr", children: type?.nameEn || type?.id || "" }),
            type?.status === "archived" && jsx("span", { className: "mt-2 inline-block rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200", children: "مؤرشف" })
          ] })
        ] }),
        jsxs("div", { className: "flex flex-wrap gap-2 self-start", children: [
          jsxs("button", { type: "button", onClick: onEdit, className: "btn btn-primary gap-2", children: [jsx(PenLine, { className: "h-4 w-4" }), "تعديل النوع والحقول"] }),
          jsxs("button", { type: "button", onClick: onArchive, className: "btn btn-ghost gap-2 text-red-200 hover:bg-red-500/10", children: [jsx(Trash2, { className: "h-4 w-4" }), "أرشفة"] })
        ] })
      ] }),
      jsx("div", { className: "grid gap-3 sm:grid-cols-3", children: [
        ["مواد تستخدمه", count],
        ["الفروع", subtypes.length],
        ["الحقول المخصصة", fields.length]
      ].map(([label, value]: any) => jsxs("div", { className: "rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-4", children: [
        jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: label }),
        jsx("p", { className: "mt-2 text-2xl font-bold text-[var(--va-text)]", children: formatNumber(value, numberSystem) })
      ] }, label)) }),
      jsxs("section", { className: "rounded-2xl va-surface-muted border p-4", children: [
        jsxs("div", { className: "flex items-center justify-between gap-2", children: [
          jsx("h3", { className: "text-sm font-bold text-[var(--va-text)]", children: "الفروع" }),
          jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-muted)]", children: formatNumber(subtypes.length, numberSystem) })
        ] }),
        subtypes.length ? jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: subtypes.map((subtype: any) => jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-1.5 text-sm text-[var(--va-text-2)]", children: subtype.name }, subtype.id)) }) : jsx("p", { className: "mt-3 rounded-xl border border-dashed border-[var(--va-border-soft)] p-4 text-center text-sm text-[var(--va-text-muted)]", children: "لا توجد فروع لهذا النوع." })
      ] }),
      jsxs("section", { className: "rounded-2xl va-surface-muted border p-4", children: [
        jsxs("div", { className: "flex items-center justify-between gap-2", children: [
          jsx("h3", { className: "text-sm font-bold text-[var(--va-text)]", children: "الحقول المخصصة" }),
          jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-muted)]", children: formatNumber(fields.length, numberSystem) })
        ] }),
        fields.length ? jsx("div", { className: "mt-3 grid gap-3 md:grid-cols-2", children: fields.map((field: any) => {
          const fieldType = FIELD_TYPE_OPTIONS.find((typeOption: any) => typeOption.id === field.type)?.label || field.type;
          return jsxs("article", { className: "rounded-xl va-surface-muted border p-3", children: [
            jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [
              jsxs("div", { className: "min-w-0", children: [
                jsxs("p", { className: "flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--va-text)]", children: [
                  field.label,
                  field.required || field.requiredToSave ? jsx("span", { className: "rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100", children: "مطلوب" }) : null
                ] }),
                jsx("p", { className: "mt-1 truncate font-mono text-xs text-[var(--va-text-muted)]", dir: "ltr", children: field.storageKey || field.name })
              ] }),
              jsx("span", { className: "shrink-0 rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2.5 py-1 text-xs text-[var(--va-text-2)]", children: fieldType })
            ] }),
            field.group && jsx("p", { className: "mt-2 text-xs text-[var(--va-text-muted)]", children: `المجموعة: ${field.group}` }),
            (field.options || []).length ? jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: field.options.slice(0, 8).map((option: any) => jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-[11px] text-[var(--va-text-muted)]", children: option }, option)) }) : null
          ] }, field.id);
        }) }) : jsx("p", { className: "mt-3 rounded-xl border border-dashed border-[var(--va-border-soft)] p-4 text-center text-sm text-[var(--va-text-muted)]", children: "لا توجد حقول مخصصة لهذا النوع." })
      ] })
    ]
  });
}

export function TypesPage() {
  const {
    contentTypes = [],
    videoItems = [],
    settings = {},
    addContentType,
    updateContentType,
    deleteContentType,
    showToast,
    showNotification
  } = useAppStore();

  const [query, setQuery] = React.useState("");
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [selectedTypeId, setSelectedTypeId] = React.useState(contentTypes.find((type: any) => type.status !== "archived")?.id || contentTypes[0]?.id || null);
  const [openedTypeId, setOpenedTypeId] = React.useState(null);
  const [editingType, setEditingType] = React.useState(null);
  const [showEditor, setShowEditor] = React.useState(false);
  const [impactType, setImpactType] = React.useState(null);
  const typeSaveAction = useAsyncAction({ label: "حفظ نوع المحتوى" });
  const [journeyOpen, setJourneyOpen] = React.useState(() => {
    try { return localStorage.getItem("videoArchive:typesJourney") === "1"; } catch (error: any) { return false; }
  });
  const toggleJourney = () => setJourneyOpen((value: any) => {
    const next = !value;
    try { localStorage.setItem("videoArchive:typesJourney", next ? "1" : "0"); } catch (error: any) { /* ignore */ }
    return next;
  });

  const filteredTypes = React.useMemo(() => getFilteredContentTypes(contentTypes, query, includeArchived), [contentTypes, includeArchived, query]);
  const usageCounts = React.useMemo(() => getTypeUsageCounts(contentTypes, videoItems), [contentTypes, videoItems]);
  const typeImpactsById = React.useMemo(() => Object.fromEntries(contentTypes.map((type: any) => [type.id, analyzeTypeImpact(type, videoItems)])), [contentTypes, videoItems]);
  const editingFieldUsage = React.useMemo(() => {
    const impact = editingType ? typeImpactsById[(editingType as any).id] : null;
    return Object.fromEntries((impact?.fieldImpacts || []).flatMap((field: any) => [
      [field.fieldId, field],
      [field.key, field]
    ]));
  }, [editingType, typeImpactsById]);
  const selectedType = contentTypes.find((type: any) => type.id === selectedTypeId) || filteredTypes[0] || null;
  const openedType = openedTypeId ? contentTypes.find((type: any) => type.id === openedTypeId) || null : null;
  const activeTypes = contentTypes.filter((type: any) => type.status !== "archived");
  const totalSubtypes = contentTypes.reduce((sum: any, type: any) => sum + (type.subtypes?.length || 0), 0);
  const totalFields = contentTypes.reduce((sum: any, type: any) => sum + (type.fields?.length || 0), 0);

  React.useEffect(() => {
    if (selectedTypeId && contentTypes.some((type: any) => type.id === selectedTypeId)) return;
    setSelectedTypeId((filteredTypes[0] as any)?.id || null);
  }, [contentTypes, filteredTypes, selectedTypeId]);

  React.useEffect(() => {
    if (openedTypeId && !contentTypes.some((type: any) => type.id === openedTypeId)) setOpenedTypeId(null);
  }, [contentTypes, openedTypeId]);

  const openCreateType = () => {
    setOpenedTypeId(null);
    setEditingType(null);
    setShowEditor(true);
  };

  const openTypeDetail = (type: any) => {
    setSelectedTypeId(type.id);
    setOpenedTypeId(type.id);
  };

  const openTypeEditor = (type: any) => {
    setSelectedTypeId(type.id);
    setOpenedTypeId(type.id);
    setEditingType(type);
    setShowEditor(true);
  };

  const saveType = async (type: any) => {
    return typeSaveAction.run(async () => {
      try {
        if (editingType) await updateContentType?.(type);
        else await addContentType?.(type);
        setSelectedTypeId(type.id);
        setOpenedTypeId(type.id);
        setShowEditor(false);
        setEditingType(null);
      } catch (error: any) {
        reportError(showNotification, error, { context: "حفظ نوع المحتوى", recovery: { label: "إعادة الحفظ", run: () => saveType(type) } });
      }
    });
  };

  const archiveType = (type: any) => {
    setImpactType(type);
  };

  const confirmArchiveType = async () => {
    if (!impactType) return;
    try {
      await deleteContentType?.((impactType as any).id);
      showToast?.("تمت أرشفة نوع المحتوى مع إبقاء المواد المرتبطة", "success");
      if (selectedTypeId === (impactType as any).id) setSelectedTypeId((filteredTypes.find((type: any) => type.id !== (impactType as any).id) as any)?.id || null);
      if (openedTypeId === (impactType as any).id) setOpenedTypeId(null);
    } catch (error: any) {
      reportError(showNotification, error, { context: "أرشفة نوع المحتوى", recovery: { label: "إعادة الأرشفة", run: confirmArchiveType } });
    } finally {
      setImpactType(null);
    }
  };

  if (showEditor) {
    return jsx(MotionPage, {
      className: "p-4 sm:p-6",
      children: jsx(TypeEditor, {
        type: editingType,
        fieldUsage: editingFieldUsage,
        contentTypes,
        videoItems,
        saving: typeSaveAction.busy,
        onCancel: () => { setShowEditor(false); setEditingType(null); },
        onSave: saveType
      })
    });
  }

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(Database, { className: "h-6 w-6 va-accent-text" }),
        title: "إدارة الأنواع والحقول",
        description: "أنواع المحتوى والفروع والحقول المخصصة، مع دعم حقل ملف محلي يحفظ metadata فقط.",
        actions: jsxs("button", { type: "button", onClick: openCreateType, className: "btn btn-primary gap-2", children: [jsx(Plus, { className: "h-4 w-4" }), "نوع جديد"] }),
        children: jsx("div", { className: "mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: [
          { id: "types", label: "أنواع نشطة", value: formatNumber(activeTypes.length, settings.numberSystem), icon: Layers3 },
          { id: "subtypes", label: "فروع", value: formatNumber(totalSubtypes, settings.numberSystem), icon: Workflow },
          { id: "fields", label: "حقول مخصصة", value: formatNumber(totalFields, settings.numberSystem), icon: Database },
          { id: "items", label: "عناصر مرتبطة", value: formatNumber(videoItems.length, settings.numberSystem), icon: Eye }
        ].map((stat: any, index: any) => {
          const Icon = stat.icon;
          return jsxs(motion.div, {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.18, delay: index * 0.03 },
            className: "rounded-2xl va-surface-muted border p-4",
            children: [
              jsxs("div", { className: "flex items-start justify-between gap-3", children: [
                jsxs("div", { className: "min-w-0", children: [
                  jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: stat.label }),
                  jsx("p", { className: "mt-2 text-2xl font-bold text-[var(--va-text)]", children: stat.value })
                ] }),
                jsx("span", { className: "va-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", children: jsx(Icon, { className: "h-5 w-5" }) })
              ] })
            ]
          }, stat.id);
        }) })
      }),
      contentTypes.length > 0 && jsx(EntityFoldersPanel, {
        scope: "types",
        entityType: "content-type",
        entities: contentTypes,
        title: "مجلدات الأنواع",
        description: "اجمع أنواع المحتوى والفروع المنطقية داخل مجلدات تنظيمية مستقلة عن المواد نفسها.",
        getEntityLabel: (type: any) => type.name || type.id,
        getEntityMeta: (type: any) => type.status === "archived" ? "مؤرشف" : `${formatNumber(type.fields?.length || 0, settings.numberSystem)} حقل`
      }),
      openedType ? jsx(TypeDetailScreen, {
        type: openedType,
        count: usageCounts[openedType.id] || 0,
        settings,
        onBack: () => setOpenedTypeId(null),
        onEdit: () => openTypeEditor(openedType),
        onArchive: () => archiveType(openedType)
      }) : jsxs(React.Fragment, { children: [
      jsxs("section", { className: "va-control-surface overflow-hidden rounded-2xl va-surface-muted border text-right", children: [
        jsxs("button", {
          type: "button",
          onClick: toggleJourney,
          "aria-expanded": journeyOpen,
          className: "flex w-full items-center justify-between gap-3 p-4 text-right transition-colors hover:bg-[var(--va-surface-2)]",
          children: [
            jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [
              jsx(Palette, { className: "h-5 w-5 shrink-0 va-accent-text" }),
              jsx("h2", { className: "text-sm font-bold text-[var(--va-text)]", children: "رحلة بناء نوع محتوى" }),
              jsx("span", { className: "hidden truncate text-xs text-[var(--va-text-muted)] sm:inline", children: "الهوية ← الفروع ← الحقول ← الاستخدام" })
            ] }),
            jsx(ChevronDown, { className: `h-4 w-4 shrink-0 text-[var(--va-text-muted)] transition-transform ${journeyOpen ? "rotate-180" : ""}` })
          ]
        }),
        journeyOpen && jsx("div", { className: "grid gap-2 px-4 pb-4 md:grid-cols-4", children: [
          ["الهوية", "اسم وأيقونة ولون"],
          ["الفروع", "تقسيم داخلي واضح"],
          ["الحقول", "بيانات مخصصة لكل نوع"],
          ["الاستخدام", "ظهور منظم في الإضافة والأرشيف"]
        ].map(([label, detail]: any, index: any) => jsxs("div", { className: "rounded-xl va-surface-muted border p-3", children: [
          jsxs("div", { className: "flex items-center gap-2", children: [
            jsx("span", { className: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border va-accent-border va-accent-bg-soft text-[10px] font-bold va-accent-text-on-soft", children: index + 1 }),
            jsx("p", { className: "text-sm font-semibold text-[var(--va-text)]", children: label })
          ] }),
          jsx("p", { className: "mt-1 text-xs leading-5 text-[var(--va-text-muted)]", children: detail })
        ] }, label)) })
      ] }),
      jsxs("section", { className: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]", children: [
        jsxs("div", { className: "space-y-4", children: [
          jsxs("div", { className: "va-filter-surface grid gap-3 rounded-2xl va-surface-muted border p-3 md:grid-cols-[minmax(0,1fr)_auto]", children: [
            jsxs("label", { className: "relative block", children: [
              jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--va-text-muted)]" }),
              jsx("input", { value: query, onChange: (event: any) => setQuery(event.target.value), placeholder: "بحث في الأنواع والفروع...", className: "input input-bordered w-full py-2 ps-3 pe-10 placeholder:text-[var(--va-text-muted)]" })
            ] }),
            jsxs("label", { className: "inline-flex min-h-11 items-center gap-2 va-surface-muted rounded-xl border px-3 text-sm text-[var(--va-text-2)]", children: [
              jsx("input", { type: "checkbox", checked: includeArchived, onChange: (event: any) => setIncludeArchived(event.target.checked) }),
              "إظهار المؤرشف"
            ] })
          ] }),
          filteredTypes.length ? jsx("div", { className: "grid gap-3 lg:grid-cols-2", children: filteredTypes.map((type: any, index: any) => jsx(TypeCard, { type, index, count: usageCounts[type.id] || 0, active: selectedType?.id === type.id, onOpen: () => openTypeDetail(type), onEdit: () => openTypeEditor(type), onArchive: () => archiveType(type) }, type.id)) }) : jsx("div", { className: "va-card rounded-2xl border border-dashed border-[var(--va-border-soft)] bg-[var(--va-surface)]", children: jsx(EmptyState, {
            type: "types",
            title: "لا توجد أنواع مطابقة",
            description: "امسح البحث أو أنشئ نوعًا جديدًا."
          }) })
        ] }),
        jsxs("aside", { className: "va-preview-panel rounded-2xl va-surface-muted border p-4 text-right", children: selectedType ? [
          jsxs("div", { className: "flex items-start gap-3", children: [
            jsx("span", { className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl", style: { backgroundColor: `${selectedType.color || "#6366f1"}22`, color: selectedType.color || "#6366f1" }, children: selectedType.icon || "📁" }),
            jsxs("div", { className: "min-w-0", children: [
              jsx("h2", { className: "text-lg font-bold text-[var(--va-text)]", children: selectedType.name }),
              jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", dir: "ltr", children: selectedType.nameEn || selectedType.id }),
              jsx("p", { className: "mt-2 text-sm text-[var(--va-text-muted)]", children: `${formatNumber(usageCounts[selectedType.id] || 0, settings.numberSystem)} عنصر يستخدم هذا النوع` })
            ] })
          ] }),
          jsxs("div", { className: "mt-5 space-y-4", children: [
            jsxs("section", { children: [
              jsx("h3", { className: "mb-2 text-sm font-bold text-[var(--va-text)]", children: "الفروع" }),
              (selectedType.subtypes || []).length ? jsx("div", { className: "flex flex-wrap gap-2", children: selectedType.subtypes.map((subtype: any) => jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-1 text-sm text-[var(--va-text-2)]", children: subtype.name }, subtype.id)) }) : jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: "لا توجد فروع." })
            ] }),
            jsxs("section", { children: [
              jsx("h3", { className: "mb-2 text-sm font-bold text-[var(--va-text)]", children: "الحقول" }),
              (selectedType.fields || []).length ? jsx("div", { className: "space-y-2", children: selectedType.fields.map((field: any) => jsxs("div", { className: "rounded-xl va-surface-muted border p-3", children: [
                jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
                  jsx("p", { className: "text-sm font-semibold text-[var(--va-text)]", children: field.label }),
                  jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-muted)]", children: FIELD_TYPE_OPTIONS.find((type: any) => type.id === field.type)?.label || field.type })
                ] }),
                jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", dir: "ltr", children: field.storageKey || field.name })
              ] }, field.id)) }) : jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: "لا توجد حقول مخصصة." })
            ] })
          ] })
        ] : [
          jsxs("div", { className: "flex flex-col items-center justify-center py-8 text-center", children: [
            jsx(FolderOpen, { className: "h-12 w-12 text-[var(--va-text-muted)]" }),
            jsx("p", { className: "mt-3 text-sm font-medium text-[var(--va-text-muted)]", children: "اختر نوعًا لعرض تفاصيله" }),
            jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", children: "انقر على أي نوع في القائمة لعرض الفروع والحقول هنا." })
          ] })
        ] })
      ] })
      ] }),
      impactType && jsx(TypeImpactSheet, { type: impactType, impact: typeImpactsById[(impactType as any).id] || analyzeTypeImpact(impactType, videoItems), settings, onCancel: () => setImpactType(null), onArchive: confirmArchiveType })
    ]
  });
}

TypesPage.pageId = "types";
TypesPage.migrationStatus = "native";

export default TypesPage;
