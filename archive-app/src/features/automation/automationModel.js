import {
  createSmartRuleset,
  matchItemAgainstRules,
  describeRuleset
} from "../collections/smartCollectionRules.js";
import { isWorkflowState, STATE_META } from "../archive/itemStatus.js";

/**
 * Visual automation rules model (§1758).
 *
 * A rule fires "when <trigger> [if <conditions>] then <actions>". Conditions
 * reuse the SAME engine as smart collections (createSmartRuleset /
 * matchItemAgainstRules) — there is no second condition DSL here.
 *
 * Everything in this module is PURE: evaluateRule returns a plan of actions,
 * applyActionPlanToItem returns a NEW item. Nothing mutates state or touches
 * the store. By design the action set is SAFE-only (no delete / destructive
 * operations); collection membership is returned as a descriptor for a caller
 * to apply, never applied here.
 *
 * Shapes:
 *   rule    = { id, name, enabled, trigger, conditions[], actions[],
 *               createdAt, updatedAt, lastRunAt }
 *   action  = { type, value }
 *   plan    = action[]  (the subset that would run for a given item)
 */

export const AUTOMATION_TRIGGERS = {
  ITEM_ADDED: "item_added",
  ITEM_UPDATED: "item_updated"
};

export const TRIGGER_LABELS = {
  [AUTOMATION_TRIGGERS.ITEM_ADDED]: "عند إضافة عنصر",
  [AUTOMATION_TRIGGERS.ITEM_UPDATED]: "عند تعديل عنصر"
};

const TRIGGER_VALUES = new Set(Object.values(AUTOMATION_TRIGGERS));

// SAFE-only actions. NOT delete / move-out / overwrite. add_to_collection is
// returned as a side-effect descriptor, applied by the caller, never here.
export const AUTOMATION_ACTIONS = {
  ADD_TAGS: "add_tags",
  ADD_TO_COLLECTION: "add_to_collection",
  SET_STATUS: "set_status"
};

export const ACTION_LABELS = {
  [AUTOMATION_ACTIONS.ADD_TAGS]: "أضف وسوماً",
  [AUTOMATION_ACTIONS.ADD_TO_COLLECTION]: "أضف إلى مجموعة",
  [AUTOMATION_ACTIONS.SET_STATUS]: "عيّن الحالة"
};

const ACTION_VALUES = new Set(Object.values(AUTOMATION_ACTIONS));

function generateRuleId() {
  return `auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toTagList(value) {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return String(value)
    .split(/[,،#\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Normalizes a single action. Returns null for unknown action types so callers
 * can drop malformed actions defensively.
 */
export function createAutomationAction(partial = {}) {
  const type = partial?.type;
  if (!ACTION_VALUES.has(type)) return null;
  if (type === AUTOMATION_ACTIONS.ADD_TAGS) {
    return { type, value: toTagList(partial.value) };
  }
  if (type === AUTOMATION_ACTIONS.SET_STATUS) {
    const status = partial.value;
    return { type, value: isWorkflowState(status) ? status : null };
  }
  // add_to_collection — value is a collection id string.
  const id = partial.value === undefined || partial.value === null ? "" : String(partial.value);
  return { type, value: id };
}

/**
 * Normalizes a full automation rule.
 * @returns {{ id, name, enabled, trigger, conditions, actions, createdAt, updatedAt, lastRunAt }}
 */
export function createAutomationRule(partial = {}) {
  const nowIso = new Date().toISOString();
  const ruleset = createSmartRuleset({
    match: partial.match,
    conditions: partial.conditions
  });
  const trigger = TRIGGER_VALUES.has(partial.trigger)
    ? partial.trigger
    : AUTOMATION_TRIGGERS.ITEM_ADDED;
  const actions = Array.isArray(partial.actions)
    ? partial.actions.map(createAutomationAction).filter(Boolean)
    : [];
  return {
    id: partial.id || generateRuleId(),
    name: (partial.name || "").trim(),
    enabled: partial.enabled !== false,
    trigger,
    match: ruleset.match,
    conditions: ruleset.conditions,
    actions,
    createdAt: partial.createdAt || nowIso,
    updatedAt: nowIso,
    lastRunAt: partial.lastRunAt || null
  };
}

/**
 * PURE planner. Returns the list of actions to apply when:
 *   - the rule is enabled
 *   - its trigger matches context.trigger
 *   - its conditions match the item (via the smart-rules engine)
 * Returns [] otherwise. Does NOT mutate or call the store.
 *
 * context: { trigger, now?, folders? }
 */
export function evaluateRule(rule, item, context = {}) {
  if (!rule || !item || !rule.enabled) return [];
  if (rule.trigger !== context.trigger) return [];
  const ruleset = { kind: "rules", match: rule.match, conditions: rule.conditions };
  // No conditions => the trigger alone fires the rule (matchItemAgainstRules
  // returns false for an empty ruleset, so short-circuit to "always").
  const conditionsMatch =
    !Array.isArray(rule.conditions) || rule.conditions.length === 0
      ? true
      : matchItemAgainstRules(item, ruleset, context);
  return conditionsMatch ? rule.actions : [];
}

/**
 * PURE. Applies an action plan to a single item and returns a NEW item.
 * - add_tags: union + dedup (preserves existing order, appends new)
 * - set_status: sets workflowStatus when it is a valid state
 * - add_to_collection: NOT applied here (membership is a store concern);
 *   surface it via collectionTargetsFromPlan instead.
 */
export function applyActionPlanToItem(item, actions = []) {
  if (!item) return item;
  let next = { ...item };
  for (const action of Array.isArray(actions) ? actions : []) {
    if (!action) continue;
    if (action.type === AUTOMATION_ACTIONS.ADD_TAGS) {
      const existing = Array.isArray(next.tags) ? next.tags : [];
      const merged = [...existing];
      for (const tag of toTagList(action.value)) {
        if (!merged.includes(tag)) merged.push(tag);
      }
      next = { ...next, tags: merged };
    } else if (action.type === AUTOMATION_ACTIONS.SET_STATUS) {
      if (isWorkflowState(action.value)) {
        next = { ...next, workflowStatus: action.value };
      }
    }
    // add_to_collection: intentionally not applied to the item.
  }
  return next;
}

/**
 * Extracts collection ids referenced by add_to_collection actions in a plan —
 * the side-effect descriptor a caller applies against the collections store.
 */
export function collectionTargetsFromPlan(actions = []) {
  return (Array.isArray(actions) ? actions : [])
    .filter((action) => action?.type === AUTOMATION_ACTIONS.ADD_TO_COLLECTION && action.value)
    .map((action) => action.value);
}

function describeAction(action) {
  const label = ACTION_LABELS[action.type] || action.type;
  if (action.type === AUTOMATION_ACTIONS.ADD_TAGS) {
    const tags = toTagList(action.value);
    return tags.length ? `${label} [${tags.join("، ")}]` : label;
  }
  if (action.type === AUTOMATION_ACTIONS.SET_STATUS) {
    return `${label}: ${STATE_META[action.value]?.label || action.value || "—"}`;
  }
  return `${label}: ${action.value || "—"}`;
}

/**
 * Human-readable Arabic summary of a rule, e.g.
 * "عند إضافة عنصر · تطابق الكل: الوسوم يحتوي أحد [عمل] ← أضف وسوماً [مهم]".
 */
export function describeRule(rule) {
  if (!rule) return "";
  const triggerLabel = TRIGGER_LABELS[rule.trigger] || rule.trigger;
  const hasConditions = Array.isArray(rule.conditions) && rule.conditions.length > 0;
  const conditionLabel = hasConditions
    ? describeRuleset({ match: rule.match, conditions: rule.conditions })
    : "بلا شروط";
  const actions = Array.isArray(rule.actions) ? rule.actions : [];
  const actionLabel = actions.length ? actions.map(describeAction).join("، ") : "بلا إجراءات";
  return `${triggerLabel} · ${conditionLabel} ← ${actionLabel}`;
}
