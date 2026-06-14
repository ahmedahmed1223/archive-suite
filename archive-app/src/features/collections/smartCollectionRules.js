import { normalizeArabicSearchText } from "../../utils/formatting.js";

/**
 * Smart-collection rule engine (§1560).
 *
 * A ruleset is a small DSL evaluated against archive items so that a
 * collection's membership is recomputed automatically whenever items are
 * added or edited — no manual itemIds management.
 *
 * Shape:
 *   {
 *     match: "all" | "any",          // AND / OR across conditions
 *     conditions: [{ field, operator, value }]
 *   }
 */

export const RULE_MATCH_MODES = ["all", "any"];

// Supported fields and the operators each one accepts. Used by the UI builder
// to offer only valid operators per field, and by the evaluator to validate.
export const RULE_FIELDS = {
  tags: {
    label: "الوسوم",
    type: "tags",
    operators: ["includesAny", "includesAll", "notIncludes"]
  },
  type: {
    label: "النوع",
    type: "enum",
    operators: ["equals", "notEquals", "in"]
  },
  subtype: {
    label: "النوع الفرعي",
    type: "enum",
    operators: ["equals", "notEquals", "in"]
  },
  status: {
    label: "حالة سير العمل",
    type: "enum",
    operators: ["equals", "notEquals", "in"]
  },
  folder: {
    label: "المجلد",
    type: "enum",
    operators: ["equals", "notEquals", "in"]
  },
  title: {
    label: "العنوان",
    type: "text",
    operators: ["contains", "notContains", "startsWith"]
  },
  notes: {
    label: "الملاحظات",
    type: "text",
    operators: ["contains", "notContains"]
  },
  favorite: {
    label: "المفضلة",
    type: "boolean",
    operators: ["isTrue", "isFalse"]
  },
  createdAt: {
    label: "تاريخ الإنشاء",
    type: "date",
    operators: ["before", "after", "withinDays"]
  },
  updatedAt: {
    label: "تاريخ التعديل",
    type: "date",
    operators: ["before", "after", "withinDays"]
  },
  size: {
    label: "الحجم (بايت)",
    type: "number",
    operators: ["gt", "lt", "between"]
  }
};

const FIELD_SET = new Set(Object.keys(RULE_FIELDS));

export const OPERATOR_LABELS = {
  includesAny: "يحتوي أحد",
  includesAll: "يحتوي الكل",
  notIncludes: "لا يحتوي",
  equals: "يساوي",
  notEquals: "لا يساوي",
  in: "ضمن",
  contains: "يتضمّن",
  notContains: "لا يتضمّن",
  startsWith: "يبدأ بـ",
  isTrue: "نعم",
  isFalse: "لا",
  before: "قبل",
  after: "بعد",
  withinDays: "خلال آخر (أيام)",
  gt: "أكبر من",
  lt: "أصغر من",
  between: "بين"
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return String(value)
    .split(/[,،#\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Normalizes a single condition. Returns null when the field/operator is
 * unknown so callers can drop malformed conditions defensively.
 */
export function createRuleCondition(partial = {}) {
  const field = partial.field;
  if (!FIELD_SET.has(field)) return null;
  const allowed = RULE_FIELDS[field].operators;
  const operator = allowed.includes(partial.operator) ? partial.operator : allowed[0];
  return { field, operator, value: partial.value === undefined ? null : partial.value };
}

/**
 * Normalizes a full ruleset value.
 */
export function createSmartRuleset(partial = {}) {
  const match = RULE_MATCH_MODES.includes(partial.match) ? partial.match : "all";
  const conditions = Array.isArray(partial.conditions)
    ? partial.conditions.map(createRuleCondition).filter(Boolean)
    : [];
  return { kind: "rules", match, conditions };
}

function itemSize(item) {
  const meta = item?.metadata || {};
  const raw = meta.size ?? meta.fileSize ?? meta.bytes ?? item?.size;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function textIncludes(haystack, needle) {
  return normalizeArabicSearchText(haystack).includes(normalizeArabicSearchText(needle));
}

function resolveItemFolderId(item, context) {
  if (item.parentId) return item.parentId;
  const folders = Array.isArray(context.folders) ? context.folders : [];
  const owner = folders.find((folder) => (folder.itemIds || []).includes(item.id));
  return owner ? owner.id : "";
}

function evaluateCondition(item, condition, context = {}) {
  if (!item || !condition) return false;
  const { field, operator, value } = condition;
  switch (field) {
    case "tags": {
      const itemTags = (Array.isArray(item.tags) ? item.tags : []).map((tag) =>
        normalizeArabicSearchText(tag)
      );
      const wanted = toArray(value).map((tag) => normalizeArabicSearchText(tag));
      if (wanted.length === 0) return operator === "notIncludes";
      if (operator === "includesAny") return wanted.some((tag) => itemTags.includes(tag));
      if (operator === "includesAll") return wanted.every((tag) => itemTags.includes(tag));
      if (operator === "notIncludes") return !wanted.some((tag) => itemTags.includes(tag));
      return false;
    }
    case "type":
    case "subtype":
    case "status":
    case "folder": {
      const itemValue =
        field === "status"
          ? item.workflowStatus || ""
          : field === "folder"
            ? resolveItemFolderId(item, context)
            : item[field] || "";
      if (operator === "equals") return itemValue === value;
      if (operator === "notEquals") return itemValue !== value;
      if (operator === "in") return toArray(value).includes(itemValue);
      return false;
    }
    case "title":
    case "notes": {
      const itemValue = item[field] || "";
      if (!value) return operator === "notContains";
      if (operator === "contains") return textIncludes(itemValue, value);
      if (operator === "notContains") return !textIncludes(itemValue, value);
      if (operator === "startsWith") {
        return normalizeArabicSearchText(itemValue).startsWith(normalizeArabicSearchText(value));
      }
      return false;
    }
    case "favorite": {
      const fav = !!item.isFavorite;
      return operator === "isTrue" ? fav : !fav;
    }
    case "createdAt":
    case "updatedAt": {
      const time = new Date(item[field]).getTime();
      if (Number.isNaN(time)) return false;
      if (operator === "withinDays") {
        const days = Number(value);
        if (!Number.isFinite(days) || days <= 0) return false;
        const cutoff = (context.now ?? Date.now()) - days * 86400000;
        return time >= cutoff;
      }
      const bound = new Date(value).getTime();
      if (Number.isNaN(bound)) return false;
      if (operator === "before") return time < bound;
      if (operator === "after") return time > bound;
      return false;
    }
    case "size": {
      const size = itemSize(item);
      if (operator === "gt") return size > Number(value);
      if (operator === "lt") return size < Number(value);
      if (operator === "between") {
        const [min, max] = Array.isArray(value) ? value : [];
        return size >= Number(min) && size <= Number(max);
      }
      return false;
    }
    default:
      return false;
  }
}

/**
 * Returns true when an item satisfies the ruleset.
 * context: { now?: number, folders?: [] }
 */
export function matchItemAgainstRules(item, ruleset, context = {}) {
  const rules = createSmartRuleset(ruleset);
  if (rules.conditions.length === 0) return false;
  const results = rules.conditions.map((condition) =>
    evaluateCondition(item, condition, context)
  );
  return rules.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

/**
 * Filters a list of items by the ruleset, excluding deleted items.
 */
export function evaluateSmartCollection(ruleset, items = [], context = {}) {
  const rules = createSmartRuleset(ruleset);
  if (rules.conditions.length === 0) return [];
  const list = Array.isArray(items) ? items : [];
  return list.filter((item) => !item?.isDeleted && matchItemAgainstRules(item, rules, context));
}

/**
 * Counts matching items — used for the "preview match count before save" UX.
 */
export function countSmartMatches(ruleset, items = [], context = {}) {
  return evaluateSmartCollection(ruleset, items, context).length;
}

/**
 * Human-readable Arabic summary of a ruleset, e.g.
 * "تطابق الكل: الوسوم يحتوي أحد [عمل]، النوع يساوي video".
 */
export function describeRuleset(ruleset) {
  const rules = createSmartRuleset(ruleset);
  if (rules.conditions.length === 0) return "بلا قواعد";
  const joiner = rules.match === "any" ? "تطابق أي" : "تطابق الكل";
  const parts = rules.conditions.map((condition) => {
    const fieldLabel = RULE_FIELDS[condition.field]?.label || condition.field;
    const opLabel = OPERATOR_LABELS[condition.operator] || condition.operator;
    const valueLabel = Array.isArray(condition.value)
      ? `[${condition.value.join("، ")}]`
      : condition.value === null || condition.value === ""
        ? ""
        : String(condition.value);
    return `${fieldLabel} ${opLabel} ${valueLabel}`.trim();
  });
  return `${joiner}: ${parts.join("، ")}`;
}
