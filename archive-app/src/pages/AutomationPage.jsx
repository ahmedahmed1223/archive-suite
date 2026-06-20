import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { Plus, Trash2, Workflow, Zap } from "lucide-react";

import { PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { EntityFormModal } from "../components/common/EntityFormModal.jsx";
import { useAppStore } from "../stores/index.js";
import { formatNumber } from "../utils/formatting.js";
import {
  RULE_FIELDS,
  OPERATOR_LABELS
} from "../features/collections/smartCollectionRules.js";
import { WORKFLOW_STATES, STATE_META } from "../features/archive/itemStatus.js";
import {
  AUTOMATION_TRIGGERS,
  AUTOMATION_ACTIONS,
  TRIGGER_LABELS,
  ACTION_LABELS,
  createAutomationRule,
  evaluateRule,
  describeRule
} from "../features/automation/automationModel.js";

const ARRAY_OPERATORS = new Set(["in", "includesAny", "includesAll", "notIncludes"]);
const VALUELESS_OPERATORS = new Set(["isTrue", "isFalse"]);

function blankCondition() {
  return { field: "tags", operator: RULE_FIELDS.tags.operators[0], value: "" };
}

function blankAction() {
  return { type: AUTOMATION_ACTIONS.ADD_TAGS, value: "" };
}

function parseConditionValue(condition) {
  const { operator, value } = condition;
  if (VALUELESS_OPERATORS.has(operator)) return null;
  if (operator === "between") {
    const [min, max] = String(value).split(/[,،-]/).map((part) => Number(part.trim()));
    return [Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 0];
  }
  if (ARRAY_OPERATORS.has(operator)) {
    return String(value).split(/[,،\n]/).map((part) => part.trim()).filter(Boolean);
  }
  if (RULE_FIELDS[condition.field]?.type === "number") return Number(value);
  return value;
}

function buildRuleDraft(name, trigger, match, conditions, actions) {
  return createAutomationRule({
    name,
    trigger,
    match,
    conditions: conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: parseConditionValue(condition)
    })),
    actions: actions.map((action) => ({ type: action.type, value: action.value }))
  });
}

function ConditionRow({ condition, index, onChange, onRemove, disableRemove }) {
  const fieldSpec = RULE_FIELDS[condition.field];
  const showValue = !VALUELESS_OPERATORS.has(condition.operator);
  return jsxs("div", {
    className:
      "grid items-center gap-2 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]",
    children: [
      jsx("select", {
        value: condition.field,
        "aria-label": "الحقل",
        onChange: (event) => onChange(index, { field: event.target.value }),
        className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-[var(--va-text)] outline-none focus:border-cyan-500/40",
        children: Object.entries(RULE_FIELDS).map(([key, spec]) => jsx("option", { value: key, children: spec.label }, key))
      }),
      jsx("select", {
        value: condition.operator,
        "aria-label": "العملية",
        onChange: (event) => onChange(index, { operator: event.target.value }),
        className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-[var(--va-text)] outline-none focus:border-cyan-500/40",
        children: fieldSpec.operators.map((op) => jsx("option", { value: op, children: OPERATOR_LABELS[op] || op }, op))
      }),
      showValue ? jsx("input", {
        value: condition.value,
        "aria-label": "قيمة الشرط",
        onChange: (event) => onChange(index, { value: event.target.value }),
        placeholder: ARRAY_OPERATORS.has(condition.operator) ? "افصل بفاصلة" : "القيمة",
        className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-[var(--va-text)] outline-none focus:border-cyan-500/40"
      }) : jsx("span", { className: "px-2 text-xs text-[var(--va-text-muted)]", children: "—" }),
      jsx("button", {
        type: "button",
        onClick: () => onRemove(index),
        disabled: disableRemove,
        "aria-label": "حذف الشرط",
        className: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-300 hover:bg-red-500/10 disabled:opacity-30",
        children: jsx(Trash2, { className: "h-4 w-4" })
      })
    ]
  });
}

function actionValueControl(action, index, onChange, collections) {
  if (action.type === AUTOMATION_ACTIONS.SET_STATUS) {
    return jsx("select", {
      value: action.value,
      "aria-label": "قيمة الإجراء",
      onChange: (event) => onChange(index, { value: event.target.value }),
      className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-[var(--va-text)] outline-none focus:border-cyan-500/40",
      children: [
        jsx("option", { value: "", children: "اختر الحالة" }, "blank"),
        ...WORKFLOW_STATES.map((state) => jsx("option", { value: state, children: STATE_META[state]?.label || state }, state))
      ]
    });
  }
  if (action.type === AUTOMATION_ACTIONS.ADD_TO_COLLECTION) {
    return jsx("select", {
      value: action.value,
      "aria-label": "قيمة الإجراء",
      onChange: (event) => onChange(index, { value: event.target.value }),
      className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-[var(--va-text)] outline-none focus:border-cyan-500/40",
      children: [
        jsx("option", { value: "", children: "اختر المجموعة" }, "blank"),
        ...collections.map((col) => jsx("option", { value: col.id, children: col.name || col.id }, col.id))
      ]
    });
  }
  return jsx("input", {
    value: action.value,
    "aria-label": "قيمة الإجراء",
    onChange: (event) => onChange(index, { value: event.target.value }),
    placeholder: "وسوم مفصولة بفاصلة",
    className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-[var(--va-text)] outline-none focus:border-cyan-500/40"
  });
}

function ActionRow({ action, index, onChange, onRemove, disableRemove, collections }) {
  return jsxs("div", {
    className:
      "grid items-center gap-2 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]",
    children: [
      jsx("select", {
        value: action.type,
        "aria-label": "نوع الإجراء",
        onChange: (event) => onChange(index, { type: event.target.value, value: "" }),
        className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-[var(--va-text)] outline-none focus:border-cyan-500/40",
        children: Object.values(AUTOMATION_ACTIONS).map((type) => jsx("option", { value: type, children: ACTION_LABELS[type] || type }, type))
      }),
      actionValueControl(action, index, onChange, collections),
      jsx("button", {
        type: "button",
        onClick: () => onRemove(index),
        disabled: disableRemove,
        "aria-label": "حذف الإجراء",
        className: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-300 hover:bg-red-500/10 disabled:opacity-30",
        children: jsx(Trash2, { className: "h-4 w-4" })
      })
    ]
  });
}

function useRuleForm(rule) {
  const [name, setName] = React.useState(rule?.name || "");
  const [trigger, setTrigger] = React.useState(rule?.trigger || AUTOMATION_TRIGGERS.ITEM_ADDED);
  const [match, setMatch] = React.useState(rule?.match || "all");
  const [conditions, setConditions] = React.useState(
    rule?.conditions?.length
      ? rule.conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: Array.isArray(c.value) ? c.value.join("، ") : c.value ?? ""
        }))
      : [blankCondition()]
  );
  const [actions, setActions] = React.useState(
    rule?.actions?.length
      ? rule.actions.map((a) => ({
          type: a.type,
          value: Array.isArray(a.value) ? a.value.join("، ") : a.value ?? ""
        }))
      : [blankAction()]
  );
  return { name, setName, trigger, setTrigger, match, setMatch, conditions, setConditions, actions, setActions };
}

function RuleEditorModal({ rule, videoItems, folders, collections, onCancel, onSave }) {
  const form = useRuleForm(rule);
  const nameId = React.useId();

  const updateCondition = (index, patch) => form.setConditions((prev) => prev.map((condition, idx) => {
    if (idx !== index) return condition;
    const next = { ...condition, ...patch };
    if (patch.field && !RULE_FIELDS[patch.field].operators.includes(next.operator)) {
      next.operator = RULE_FIELDS[patch.field].operators[0];
    }
    return next;
  }));
  const updateAction = (index, patch) => form.setActions((prev) =>
    prev.map((action, idx) => (idx === index ? { ...action, ...patch } : action)));

  const draft = React.useMemo(
    () => buildRuleDraft(form.name, form.trigger, form.match, form.conditions, form.actions),
    [form.name, form.trigger, form.match, form.conditions, form.actions]
  );
  const matchCount = React.useMemo(() => {
    const context = { trigger: form.trigger, folders };
    return videoItems.filter((item) => !item?.isDeleted && evaluateRule({ ...draft, actions: [{}] }, item, context).length > 0).length;
  }, [draft, form.trigger, videoItems, folders]);

  const canSubmit = Boolean(form.name.trim()) && draft.actions.length > 0;
  const submit = async () => {
    if (!canSubmit) return;
    await onSave({ ...draft, id: rule?.id, createdAt: rule?.createdAt, enabled: rule?.enabled !== false });
  };

  return jsx(EntityFormModal, {
    title: rule ? "تعديل قاعدة أتمتة" : "قاعدة أتمتة جديدة",
    icon: jsx(Workflow, { className: "h-4 w-4" }),
    onCancel,
    onSubmit: submit,
    canSubmit,
    submitLabel: rule ? "حفظ القاعدة" : "إنشاء القاعدة",
    isEditing: Boolean(rule),
    size: "xl",
    children: jsxs("div", { className: "space-y-4", children: [
      jsxs("div", { className: "space-y-1 text-sm text-[var(--va-text-2)]", children: [
        jsx("label", { htmlFor: nameId, className: "block", children: "اسم القاعدة" }),
        jsx("input", { id: nameId, "data-autofocus": true, value: form.name, onChange: (e) => form.setName(e.target.value), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-[var(--va-text)] outline-none focus:border-cyan-500/40", placeholder: "مثال: وسم مقاطع العمل تلقائياً" })
      ] }),
      jsxs("div", { className: "flex items-center gap-2 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2", children: [
        jsx("span", { className: "px-1 text-sm text-[var(--va-text-2)]", children: "عندما" }),
        ...Object.values(AUTOMATION_TRIGGERS).map((value) => jsx("button", {
          type: "button",
          onClick: () => form.setTrigger(value),
          className: `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${form.trigger === value ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30" : "text-[var(--va-text-muted)] hover:text-[var(--va-text)]"}`,
          children: TRIGGER_LABELS[value]
        }, value))
      ] }),
      jsxs("div", { className: "flex items-center gap-2 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2", children: [
        jsx("span", { className: "px-1 text-sm text-[var(--va-text-2)]", children: "إذا (تطابق)" }),
        ...["all", "any"].map((mode) => jsx("button", {
          type: "button",
          onClick: () => form.setMatch(mode),
          className: `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${form.match === mode ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30" : "text-[var(--va-text-muted)] hover:text-[var(--va-text)]"}`,
          children: mode === "all" ? "كل الشروط (و)" : "أي شرط (أو)"
        }, mode))
      ] }),
      jsx("div", { className: "space-y-2", children: form.conditions.map((condition, index) => jsx(ConditionRow, {
        condition, index, onChange: updateCondition,
        onRemove: (i) => form.setConditions((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))),
        disableRemove: form.conditions.length <= 1
      }, index)) }),
      jsxs("button", { type: "button", onClick: () => form.setConditions((prev) => [...prev, blankCondition()]), className: "inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/15", children: [jsx(Plus, { className: "h-3.5 w-3.5" }), "إضافة شرط"] }),
      jsx("div", { className: "border-t border-[var(--va-border-soft)] pt-3 text-sm font-semibold text-[var(--va-text-2)]", children: "عندئذٍ نفّذ" }),
      jsx("div", { className: "space-y-2", children: form.actions.map((action, index) => jsx(ActionRow, {
        action, index, onChange: updateAction, collections,
        onRemove: (i) => form.setActions((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))),
        disableRemove: form.actions.length <= 1
      }, index)) }),
      jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
        jsxs("button", { type: "button", onClick: () => form.setActions((prev) => [...prev, blankAction()]), className: "inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/15", children: [jsx(Plus, { className: "h-3.5 w-3.5" }), "إضافة إجراء"] }),
        jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-200", children: [jsx(Zap, { className: "h-3.5 w-3.5" }), `${formatNumber(matchCount)} عنصر مطابق`] })
      ] })
    ] })
  });
}

function RuleCard({ rule, onToggle, onEdit, onRemove }) {
  return jsxs("div", {
    className: "flex flex-col gap-2 rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 shadow-[var(--va-elev-1)]",
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        jsxs("div", { className: "min-w-0", children: [
          jsx("p", { className: "truncate text-sm font-bold text-[var(--va-text)]", dir: "auto", children: rule.name || "بدون اسم" }),
          jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", dir: "rtl", children: describeRule(rule) })
        ] }),
        jsx("button", {
          type: "button",
          role: "switch",
          "aria-checked": rule.enabled,
          "aria-label": rule.enabled ? "تعطيل القاعدة" : "تفعيل القاعدة",
          onClick: () => onToggle(rule.id),
          className: `relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${rule.enabled ? "bg-cyan-500/70" : "bg-[var(--va-surface-2)] border border-[var(--va-border-strong)]"}`,
          children: jsx("span", { className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.enabled ? "translate-x-1" : "translate-x-6"}` })
        })
      ] }),
      jsxs("div", { className: "flex items-center justify-end gap-2", children: [
        jsx("button", { type: "button", onClick: () => onEdit(rule), className: "rounded-lg border border-[var(--va-border-soft)] px-3 py-1 text-xs text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: "تعديل" }),
        jsx("button", { type: "button", onClick: () => onRemove(rule.id), "aria-label": "حذف القاعدة", className: "inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-300 hover:bg-red-500/10", children: jsx(Trash2, { className: "h-3.5 w-3.5" }) })
      ] })
    ]
  });
}

export function AutomationPage() {
  const {
    automationRules = [],
    videoItems = [],
    virtualCollections = [],
    archiveFolders = [],
    loadAutomationFromStorage,
    addAutomationRule,
    updateAutomationRule,
    removeAutomationRule,
    toggleAutomationRule
  } = useAppStore();
  const [editing, setEditing] = React.useState(null); // null | "new" | rule

  React.useEffect(() => {
    loadAutomationFromStorage?.();
  }, [loadAutomationFromStorage]);

  const closeEditor = () => setEditing(null);
  const saveRule = async (value) => {
    if (value.id && automationRules.some((rule) => rule.id === value.id)) {
      await updateAutomationRule?.(value.id, value);
    } else {
      await addAutomationRule?.(value);
    }
    closeEditor();
  };

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6",
    dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(Workflow, { className: "h-6 w-6 va-accent-text" }),
        title: "الأتمتة",
        description: "قواعد «عندما… إذا… عندئذٍ» لأتمتة الخطوات المتكررة بأمان — أضف وسوماً، عيّن الحالة، أو أضف لمجموعة."
      }),
      jsxs("section", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        jsxs("span", { className: "text-sm text-[var(--va-text-muted)]", children: [`${formatNumber(automationRules.length)} قاعدة`] }),
        jsxs("button", {
          type: "button",
          onClick: () => setEditing("new"),
          className: "inline-flex items-center gap-1.5 rounded-xl va-accent-bg-soft va-accent-text-on-soft border va-accent-border px-3 py-2 text-sm font-semibold",
          children: [jsx(Plus, { className: "h-4 w-4" }), "قاعدة جديدة"]
        })
      ] }),
      automationRules.length === 0 ? jsx("div", {
        className: "va-card rounded-2xl border border-dashed border-[var(--va-border-soft)] bg-[var(--va-surface)]",
        children: jsx(EmptyState, {
          icon: jsx(Workflow, { className: "h-16 w-16" }),
          title: "لا قواعد أتمتة بعد",
          description: "أنشئ قاعدة لأتمتة الخطوات المتكررة — مثل وسم العناصر الجديدة تلقائياً."
        })
      }) : jsx("section", {
        className: "grid gap-3 md:grid-cols-2",
        children: automationRules.map((rule) => jsx(RuleCard, {
          rule,
          onToggle: (id) => toggleAutomationRule?.(id),
          onEdit: (target) => setEditing(target),
          onRemove: (id) => removeAutomationRule?.(id)
        }, rule.id))
      }),
      editing ? jsx(RuleEditorModal, {
        rule: editing === "new" ? null : editing,
        videoItems,
        folders: archiveFolders,
        collections: virtualCollections,
        onCancel: closeEditor,
        onSave: saveRule
      }) : null
    ]
  });
}

AutomationPage.pageId = "automation";
AutomationPage.migrationStatus = "native";

export default AutomationPage;
