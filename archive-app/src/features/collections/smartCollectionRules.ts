import { normalizeArabicSearchText } from "../../utils/formatting.js";

export interface RuleCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface SmartRuleset {
  kind: "rules";
  match: "all" | "any";
  conditions: RuleCondition[];
}

export interface ArchiveItemLike {
  id: string;
  tags?: unknown;
  type?: string;
  subtype?: string;
  title?: string;
  notes?: string;
  isFavorite?: unknown;
  isDeleted?: boolean;
  workflowStatus?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
  size?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface RulesContext {
  now?: number;
  folders?: Array<{ id: string; itemIds?: string[] }>;
}

export const RULE_MATCH_MODES = ["all", "any"] as const;

export const RULE_FIELDS: Record<
  string,
  { label: string; type: string; operators: string[] }
> = {
  tags: { label: "الوسوم", type: "tags", operators: ["includesAny", "includesAll", "notIncludes"] },
  type: { label: "النوع", type: "enum", operators: ["equals", "notEquals", "in"] },
  subtype: { label: "النوع الفرعي", type: "enum", operators: ["equals", "notEquals", "in"] },
  status: { label: "حالة سير العمل", type: "enum", operators: ["equals", "notEquals", "in"] },
  folder: { label: "المجلد", type: "enum", operators: ["equals", "notEquals", "in"] },
  title: { label: "العنوان", type: "text", operators: ["contains", "notContains", "startsWith"] },
  notes: { label: "الملاحظات", type: "text", operators: ["contains", "notContains"] },
  favorite: { label: "المفضلة", type: "boolean", operators: ["isTrue", "isFalse"] },
  createdAt: { label: "تاريخ الإنشاء", type: "date", operators: ["before", "after", "withinDays"] },
  updatedAt: { label: "تاريخ التعديل", type: "date", operators: ["before", "after", "withinDays"] },
  size: { label: "الحجم (بايت)", type: "number", operators: ["gt", "lt", "between"] }
};

const FIELD_SET = new Set(Object.keys(RULE_FIELDS));

export const OPERATOR_LABELS: Record<string, string> = {
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

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((part) => String(part));
  if (value === null || value === undefined || value === "") return [];
  return String(value)
    .split(/[,،#\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function createRuleCondition(partial: Partial<RuleCondition> = {}): RuleCondition | null {
  const field = partial.field;
  if (!field || !FIELD_SET.has(field)) return null;
  const allowed = RULE_FIELDS[field].operators;
  const operator = allowed.includes(String(partial.operator)) ? String(partial.operator) : allowed[0];
  return { field, operator, value: partial.value === undefined ? null : partial.value };
}

export function createSmartRuleset(partial: Partial<SmartRuleset> & { conditions?: unknown } = {}): SmartRuleset {
  const match = RULE_MATCH_MODES.includes(partial.match as "all" | "any") ? (partial.match as "all" | "any") : "all";
  const conditions = Array.isArray(partial.conditions)
    ? partial.conditions.map((condition) => createRuleCondition(condition as Partial<RuleCondition>)).filter((condition): condition is RuleCondition => Boolean(condition))
    : [];
  return { kind: "rules", match, conditions };
}

function itemSize(item: ArchiveItemLike): number {
  const meta = item?.metadata || {};
  const raw = (meta.size ?? meta.fileSize ?? meta.bytes ?? item?.size) as unknown;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function textIncludes(haystack: unknown, needle: unknown): boolean {
  return normalizeArabicSearchText(String(haystack ?? "")).includes(normalizeArabicSearchText(String(needle ?? "")));
}

function resolveItemFolderId(item: ArchiveItemLike, context: RulesContext): string {
  if (item.parentId) return item.parentId;
  const folders = Array.isArray(context.folders) ? context.folders : [];
  const owner = folders.find((folder) => (folder.itemIds || []).includes(item.id));
  return owner ? owner.id : "";
}

function evaluateCondition(item: ArchiveItemLike, condition: RuleCondition, context: RulesContext = {}): boolean {
  if (!item || !condition) return false;
  const { field, operator, value } = condition;
  switch (field) {
    case "tags": {
      const itemTags = (Array.isArray(item.tags) ? item.tags : []).map((tag) => normalizeArabicSearchText(String(tag)));
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
      const itemRecord = item as unknown as Record<string, unknown>;
      const itemValue =
        field === "status"
          ? item.workflowStatus || ""
          : field === "folder"
            ? resolveItemFolderId(item, context)
            : itemRecord[field] || "";
      if (operator === "equals") return itemValue === value;
      if (operator === "notEquals") return itemValue !== value;
      if (operator === "in") return toArray(value).includes(String(itemValue));
      return false;
    }
    case "title":
    case "notes": {
      const itemValue = String((item as unknown as Record<string, unknown>)[field] || "");
      if (!value) return operator === "notContains";
      if (operator === "contains") return textIncludes(itemValue, value);
      if (operator === "notContains") return !textIncludes(itemValue, value);
      if (operator === "startsWith") {
        return normalizeArabicSearchText(itemValue).startsWith(normalizeArabicSearchText(String(value)));
      }
      return false;
    }
    case "favorite": {
      const fav = !!item.isFavorite;
      return operator === "isTrue" ? fav : !fav;
    }
    case "createdAt":
    case "updatedAt": {
      const time = new Date(item[field] || "").getTime();
      if (Number.isNaN(time)) return false;
      if (operator === "withinDays") {
        const days = Number(value);
        if (!Number.isFinite(days) || days <= 0) return false;
        const cutoff = (context.now ?? Date.now()) - days * 86400000;
        return time >= cutoff;
      }
      const bound = new Date(String(value)).getTime();
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

export function matchItemAgainstRules(item: ArchiveItemLike, ruleset: unknown, context: RulesContext = {}): boolean {
  const rules = createSmartRuleset(ruleset as Partial<SmartRuleset> & { conditions?: unknown });
  if (rules.conditions.length === 0) return false;
  const results = rules.conditions.map((condition) => evaluateCondition(item, condition, context));
  return rules.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

export function evaluateSmartCollection(ruleset: unknown, items: unknown[] = [], context: RulesContext = {}): ArchiveItemLike[] {
  const rules = createSmartRuleset(ruleset as Partial<SmartRuleset> & { conditions?: unknown });
  if (rules.conditions.length === 0) return [];
  const list = Array.isArray(items) ? (items as ArchiveItemLike[]) : [];
  return list.filter((item) => !item?.isDeleted && matchItemAgainstRules(item, rules, context));
}

export function countSmartMatches(ruleset: unknown, items: unknown[] = [], context: RulesContext = {}): number {
  return evaluateSmartCollection(ruleset, items, context).length;
}

export function describeRuleset(ruleset: unknown): string {
  const rules = createSmartRuleset(ruleset as Partial<SmartRuleset> & { conditions?: unknown });
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
