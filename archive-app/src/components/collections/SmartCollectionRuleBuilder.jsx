import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Plus, Sparkles, Trash2, Zap } from "lucide-react";

import { EntityFormModal } from "../common/EntityFormModal.jsx";
import { ColorSwatchPicker } from "../common/ColorSwatchPicker.jsx";
import {
  COLLECTION_COLORS,
  createVirtualCollectionValue
} from "../../features/collections/viewModel.js";
import {
  RULE_FIELDS,
  OPERATOR_LABELS,
  createSmartRuleset,
  countSmartMatches
} from "../../features/collections/smartCollectionRules.js";
import { formatNumber } from "../../utils/formatting.js";

const ARRAY_OPERATORS = new Set(["in", "includesAny", "includesAll", "notIncludes"]);
const VALUELESS_OPERATORS = new Set(["isTrue", "isFalse"]);

function blankCondition() {
  return { field: "tags", operator: RULE_FIELDS.tags.operators[0], value: "" };
}

function parseConditionValue(condition) {
  const { operator, value } = condition;
  if (VALUELESS_OPERATORS.has(operator)) return null;
  if (operator === "between") {
    const [min, max] = String(value).split(/[,،-]/).map((part) => Number(part.trim()));
    return [Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : 0];
  }
  if (ARRAY_OPERATORS.has(operator)) {
    return String(value)
      .split(/[,،\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (RULE_FIELDS[condition.field]?.type === "number") return Number(value);
  return value;
}

function toRuleset(match, conditions) {
  return createSmartRuleset({
    match,
    conditions: conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: parseConditionValue(condition)
    }))
  });
}

/**
 * Modal that builds/edits a rule-based smart collection (§1560).
 * Membership is recomputed live from the rules — no manual itemIds.
 */
export function SmartCollectionRuleBuilder({ collection, videoItems = [], folders = [], onCancel, onSave }) {
  const existingRules = collection?.filterRules?.kind === "rules" ? collection.filterRules : null;
  const [name, setName] = React.useState(collection?.name || "");
  const [icon, setIcon] = React.useState(collection?.icon || "⚡");
  const [color, setColor] = React.useState(collection?.color || "#06b6d4");
  const [match, setMatch] = React.useState(existingRules?.match || "all");
  const [conditions, setConditions] = React.useState(
    existingRules?.conditions?.length
      ? existingRules.conditions.map((condition) => ({
          field: condition.field,
          operator: condition.operator,
          value: Array.isArray(condition.value) ? condition.value.join("، ") : condition.value ?? ""
        }))
      : [blankCondition()]
  );

  const nameId = React.useId();
  const iconId = React.useId();
  const colorGroupId = React.useId();

  const ruleset = React.useMemo(() => toRuleset(match, conditions), [match, conditions]);
  const matchCount = React.useMemo(
    () => countSmartMatches(ruleset, videoItems, { folders }),
    [ruleset, videoItems, folders]
  );

  const updateCondition = (index, patch) => {
    setConditions((prev) => prev.map((condition, idx) => {
      if (idx !== index) return condition;
      const next = { ...condition, ...patch };
      // When the field changes, snap the operator to a valid one for that field.
      if (patch.field && !RULE_FIELDS[patch.field].operators.includes(next.operator)) {
        next.operator = RULE_FIELDS[patch.field].operators[0];
      }
      return next;
    }));
  };

  const addCondition = () => setConditions((prev) => [...prev, blankCondition()]);
  const removeCondition = (index) => setConditions((prev) =>
    prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)
  );

  const canSubmit = Boolean(name.trim()) && ruleset.conditions.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    const value = createVirtualCollectionValue({
      ...(collection || {}),
      id: collection?.id,
      createdAt: collection?.createdAt,
      name: name.trim(),
      icon,
      color,
      type: "smart",
      filterRules: ruleset,
      itemIds: []
    });
    await onSave(value);
  };

  const fieldOptions = Object.entries(RULE_FIELDS);

  return jsx(EntityFormModal, {
    title: collection ? "تعديل مجموعة ذكية بقواعد" : "مجموعة ذكية بقواعد",
    icon: jsx(Sparkles, { className: "h-4 w-4" }),
    onCancel,
    onSubmit: submit,
    canSubmit,
    submitLabel: collection ? "حفظ القواعد" : "إنشاء المجموعة الذكية",
    isEditing: Boolean(collection),
    size: "xl",
    children: jsxs("div", {
      className: "space-y-4",
      children: [
        jsxs("div", { className: "grid gap-3 md:grid-cols-[5rem_minmax(0,1fr)]", children: [
          jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
            jsx("label", { htmlFor: iconId, className: "block", children: "الرمز" }),
            jsx("input", { id: iconId, value: icon, onChange: (event) => setIcon(event.target.value.slice(0, 4)), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-center text-xl text-white outline-none focus:border-cyan-500/40" })
          ] }),
          jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
            jsx("label", { htmlFor: nameId, className: "block", children: "اسم المجموعة الذكية" }),
            jsx("input", { id: nameId, "data-autofocus": true, value: name, onChange: (event) => setName(event.target.value), className: "min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-cyan-500/40", placeholder: "مثال: مقاطع العمل الحديثة" })
          ] })
        ] }),
        jsxs("div", { className: "space-y-1 md:col-span-2", children: [
          jsx("span", { id: colorGroupId, className: "text-sm text-gray-300", children: "اللون" }),
          jsx(ColorSwatchPicker, { value: color, onChange: setColor, presets: COLLECTION_COLORS, labelId: colorGroupId })
        ] }),
        jsxs("div", { className: "flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2", children: [
          jsx("span", { className: "px-1 text-sm text-gray-400", children: "تطابق" }),
          ...["all", "any"].map((mode) => jsx("button", {
            type: "button",
            onClick: () => setMatch(mode),
            className: `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${match === mode ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30" : "text-gray-400 hover:text-white"}`,
            children: mode === "all" ? "كل الشروط (و)" : "أي شرط (أو)"
          }, mode))
        ] }),
        jsx("div", {
          className: "space-y-2",
          children: conditions.map((condition, index) => {
            const fieldSpec = RULE_FIELDS[condition.field];
            const showValue = !VALUELESS_OPERATORS.has(condition.operator);
            return jsxs("div", {
              className: "grid items-center gap-2 rounded-xl border border-white/10 bg-gray-950/30 p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]",
              children: [
                jsx("select", {
                  value: condition.field,
                  "aria-label": "الحقل",
                  onChange: (event) => updateCondition(index, { field: event.target.value }),
                  className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-white outline-none focus:border-cyan-500/40",
                  children: fieldOptions.map(([key, spec]) => jsx("option", { value: key, children: spec.label }, key))
                }),
                jsx("select", {
                  value: condition.operator,
                  "aria-label": "العملية",
                  onChange: (event) => updateCondition(index, { operator: event.target.value }),
                  className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-white outline-none focus:border-cyan-500/40",
                  children: fieldSpec.operators.map((op) => jsx("option", { value: op, children: OPERATOR_LABELS[op] || op }, op))
                }),
                showValue ? jsx("input", {
                  value: condition.value,
                  "aria-label": "القيمة",
                  onChange: (event) => updateCondition(index, { value: event.target.value }),
                  placeholder: ARRAY_OPERATORS.has(condition.operator) ? "افصل بفاصلة" : condition.operator === "between" ? "من، إلى" : fieldSpec.type === "date" ? (condition.operator === "withinDays" ? "عدد الأيام" : "YYYY-MM-DD") : "القيمة",
                  className: "min-h-10 w-full va-surface-deep rounded-lg border px-2 text-sm text-white outline-none focus:border-cyan-500/40"
                }) : jsx("span", { className: "px-2 text-xs text-gray-600", children: "—" }),
                jsx("button", {
                  type: "button",
                  onClick: () => removeCondition(index),
                  disabled: conditions.length <= 1,
                  "aria-label": "حذف الشرط",
                  className: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-300 hover:bg-red-500/10 disabled:opacity-30",
                  children: jsx(Trash2, { className: "h-4 w-4" })
                })
              ]
            }, index);
          })
        }),
        jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
          jsxs("button", {
            type: "button",
            onClick: addCondition,
            className: "inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/15",
            children: [jsx(Plus, { className: "h-3.5 w-3.5" }), "إضافة شرط"]
          }),
          jsxs("span", {
            className: "inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-200",
            children: [jsx(Zap, { className: "h-3.5 w-3.5" }), `${formatNumber(matchCount)} عنصر مطابق`]
          })
        ] })
      ]
    })
  });
}

export default SmartCollectionRuleBuilder;
