// @ts-nocheck
import { normalizeArabicSearchText } from "../../utils/formatting.js";

/**
 * Dynamic field formula functions. Each receives a context object and
 * optional arguments, and returns a string value used to pre-fill a form.
 */
export const FORMULA_FUNCTIONS = {
  today: () => new Date().toISOString().slice(0, 10),
  autoNumber: (ctx = {}) => String((Number(ctx.counter) || 0) + 1).padStart(4, "0"),
  copyFromLast: (ctx = {}, field) => (ctx.lastValues?.[field] ?? "") + "",
  concat: (...parts) => parts.filter(Boolean).join(" ")
};

const TEMPLATE_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1"];

function nowIso() {
  return new Date().toISOString();
}

function generateTemplateId() {
  return `template_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeFields(fields) {
  if (!fields || typeof fields !== "object") return {};
  return Object.entries(fields).reduce((acc, [key, value]) => {
    if (Array.isArray(value)) {
      acc[key] = value.map((entry) => String(entry));
    } else if (value !== undefined && value !== null) {
      acc[key] = typeof value === "string" ? value : String(value);
    }
    return acc;
  }, {});
}

function normalizeDynamicFields(dynamicFields) {
  if (!dynamicFields || typeof dynamicFields !== "object") return {};
  return Object.entries(dynamicFields).reduce((acc, [key, formula]) => {
    const trimmed = String(formula || "").trim();
    if (trimmed) acc[key] = trimmed;
    return acc;
  }, {});
}

/**
 * Creates a normalized template value.
 * @param {Object} partial
 * @returns {Object} normalized template
 */
export function createItemTemplate(partial = {}) {
  const now = nowIso();
  return {
    id: partial.id || generateTemplateId(),
    name: String(partial.name || "").trim(),
    description: String(partial.description || "").trim(),
    icon: partial.icon || "📋",
    color: partial.color || TEMPLATE_COLORS[0],
    fields: normalizeFields(partial.fields),
    dynamicFields: normalizeDynamicFields(partial.dynamicFields),
    isBuiltIn: !!partial.isBuiltIn,
    usageCount: Math.max(0, Number(partial.usageCount) || 0),
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
}

/**
 * Three built-in templates (read-only, cannot be deleted).
 */
export const BUILT_IN_TEMPLATES = [
  createItemTemplate({
    id: "builtin_lecture",
    name: "محاضرة جامعية",
    description: "قالب جاهز لتوثيق المحاضرات الجامعية مع ترقيم تلقائي.",
    icon: "🎓",
    color: "#3b82f6",
    isBuiltIn: true,
    fields: {
      type: "video",
      tags: ["محاضرة", "تعليم"],
      notes: "محاضرة مسجلة"
    },
    dynamicFields: {
      title: "concat(محاضرة, autoNumber())",
      date: "today()"
    }
  }),
  createItemTemplate({
    id: "builtin_document",
    name: "مستند عمل",
    description: "قالب لتوثيق مستندات العمل اليومية.",
    icon: "📄",
    color: "#f59e0b",
    isBuiltIn: true,
    fields: {
      type: "document",
      tags: ["عمل", "مستند"]
    },
    dynamicFields: {
      title: "concat(مستند, today())",
      date: "today()"
    }
  }),
  createItemTemplate({
    id: "builtin_audio",
    name: "مقطع صوتي",
    description: "قالب لأرشفة المقاطع الصوتية والتسجيلات.",
    icon: "🎵",
    color: "#8b5cf6",
    isBuiltIn: true,
    fields: {
      type: "audio",
      tags: ["صوت", "تسجيل"]
    },
    dynamicFields: {
      title: "concat(تسجيل, autoNumber())",
      date: "today()"
    }
  })
];

// Matches "name(arg1, arg2)" — name is a known formula function.
const FORMULA_PATTERN = /^([a-zA-Z]+)\s*\((.*)\)$/;

function parseFormulaArgs(raw = "") {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * Evaluates a single formula string against a context.
 * Supports nested zero-arg formulas as arguments (e.g. concat(x, today())).
 * Falls back to the literal string when the formula is unknown.
 */
function evaluateFormula(formula, context) {
  const match = FORMULA_PATTERN.exec(String(formula || "").trim());
  if (!match) return String(formula || "");
  const [, name, rawArgs] = match;
  const fn = FORMULA_FUNCTIONS[name];
  if (typeof fn !== "function") return String(formula);

  const args = parseFormulaArgs(rawArgs).map((arg) => {
    const nested = FORMULA_PATTERN.exec(arg);
    return nested ? evaluateFormula(arg, context) : arg;
  });

  if (name === "copyFromLast") return fn(context, args[0]);
  if (name === "concat") return fn(...args);
  return fn(context);
}

/**
 * Resolves dynamic fields in a template to their current values, merged
 * over the template's static fields.
 * @param {Object} template
 * @param {Object} context - { counter, lastValues }
 * @returns {Object} resolved field values ready to pre-fill a form
 */
export function resolveDynamicFields(template, context = {}) {
  if (!template) return {};
  const resolved = { ...(template.fields || {}) };
  const dynamic = template.dynamicFields || {};
  for (const [field, formula] of Object.entries(dynamic)) {
    resolved[field] = evaluateFormula(formula, context);
  }
  return resolved;
}

/**
 * Filters templates by a search query and sorts by usage count (desc),
 * then by most recently updated.
 * @param {Object[]} templates
 * @param {string} query
 * @returns {Object[]}
 */
export function filterTemplates(templates = [], query = "") {
  const normalizedQuery = normalizeArabicSearchText(query);
  return [...templates]
    .filter((template) => {
      if (!normalizedQuery) return true;
      return [template.name, template.description, template.icon]
        .some((value) => normalizeArabicSearchText(value).includes(normalizedQuery));
    })
    .sort((a, b) => {
      const usageDiff = (b.usageCount || 0) - (a.usageCount || 0);
      if (usageDiff !== 0) return usageDiff;
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
}

