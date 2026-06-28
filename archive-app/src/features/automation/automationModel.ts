import {
  createSmartRuleset,
  matchItemAgainstRules,
  describeRuleset
} from "../collections/smartCollectionRules.js";
import { isWorkflowState, STATE_META } from "../archive/itemStatus.js";
import type { RuleCondition, SmartRuleset } from "../collections/smartCollectionRules.js";

export const AUTOMATION_TRIGGERS = {
  ITEM_ADDED: "item_added",
  ITEM_UPDATED: "item_updated"
} as const;

export const TRIGGER_LABELS: Record<string, string> = {
  [AUTOMATION_TRIGGERS.ITEM_ADDED]: "عند إضافة عنصر",
  [AUTOMATION_TRIGGERS.ITEM_UPDATED]: "عند تعديل عنصر"
};

const TRIGGER_VALUES = new Set(Object.values(AUTOMATION_TRIGGERS));

export const AUTOMATION_ACTIONS = {
  ADD_TAGS: "add_tags",
  ADD_TO_COLLECTION: "add_to_collection",
  SET_STATUS: "set_status"
} as const;

export const ACTION_LABELS: Record<string, string> = {
  [AUTOMATION_ACTIONS.ADD_TAGS]: "أضف وسوماً",
  [AUTOMATION_ACTIONS.ADD_TO_COLLECTION]: "أضف إلى مجموعة",
  [AUTOMATION_ACTIONS.SET_STATUS]: "عيّن الحالة"
};

export type AutomationActionType = typeof AUTOMATION_ACTIONS[keyof typeof AUTOMATION_ACTIONS];
export type AutomationTrigger = typeof AUTOMATION_TRIGGERS[keyof typeof AUTOMATION_TRIGGERS];

export type AutomationAction = { type: AutomationActionType; value: unknown };
export type AutomationRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  match: SmartRuleset["match"];
  conditions: RuleCondition[];
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
};

type PartialAction = { type?: string; value?: unknown };
type PartialRule = {
  id?: string;
  name?: string;
  enabled?: boolean;
  trigger?: AutomationTrigger;
  match?: SmartRuleset["match"];
  conditions?: RuleCondition[];
  actions?: PartialAction[];
  createdAt?: string;
  updatedAt?: string;
  lastRunAt?: string | null;
};
type ItemLike = { tags?: unknown[]; workflowStatus?: string };

function generateRuleId() {
  return `auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toTagList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return String(value)
    .split(/[,،#\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Normalizes a single action. Returns null for unknown action types. */
export function createAutomationAction(partial: PartialAction = {}): AutomationAction | null {
  const type = partial?.type;
  if (!Object.values(AUTOMATION_ACTIONS).includes(type as AutomationActionType)) return null;
  const actionType = type as AutomationActionType;
  if (type === AUTOMATION_ACTIONS.ADD_TAGS) {
    return { type: actionType, value: toTagList(partial.value) };
  }
  if (type === AUTOMATION_ACTIONS.SET_STATUS) {
    const status = partial.value;
    return { type: actionType, value: isWorkflowState(status) ? status : null };
  }
  const id = partial.value === undefined || partial.value === null ? "" : String(partial.value);
  return { type: actionType, value: id };
}

/** Normalizes a full automation rule. */
export function createAutomationRule(partial: PartialRule = {}): AutomationRule {
  const nowIso = new Date().toISOString();
  const ruleset: any = createSmartRuleset({
    match: partial.match,
    conditions: partial.conditions
  });
  const trigger = TRIGGER_VALUES.has(partial.trigger as AutomationTrigger)
    ? (partial.trigger as AutomationTrigger)
    : AUTOMATION_TRIGGERS.ITEM_ADDED;
  const actions = Array.isArray(partial.actions)
    ? partial.actions.map(createAutomationAction).filter((action): action is AutomationAction => Boolean(action))
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

/** PURE planner. Returns the list of actions to apply when the rule matches. */
export function evaluateRule(rule: AutomationRule | null | undefined, item: Record<string, any>, context: { trigger?: string } = {}) {
  if (!rule || !item || !rule.enabled) return [];
  if (rule.trigger !== context.trigger) return [];
  const ruleset = { kind: "rules" as const, match: rule.match, conditions: rule.conditions };
  const conditionsMatch =
    !Array.isArray(rule.conditions) || rule.conditions.length === 0
      ? true
      : matchItemAgainstRules(item as any, ruleset as any, context as any);
  return conditionsMatch ? rule.actions : [];
}

/** PURE. Applies an action plan to a single item and returns a NEW item. */
export function applyActionPlanToItem(item: ItemLike | null | undefined, actions: AutomationAction[] = []) {
  if (!item) return item;
  let next: ItemLike = { ...item };
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
  }
  return next;
}

/** Extracts collection ids referenced by add_to_collection actions. */
export function collectionTargetsFromPlan(actions: AutomationAction[] = []) {
  return (Array.isArray(actions) ? actions : [])
    .filter((action) => action?.type === AUTOMATION_ACTIONS.ADD_TO_COLLECTION && action.value)
    .map((action) => action.value as string);
}

function describeAction(action: AutomationAction) {
  const label = ACTION_LABELS[action.type] || action.type;
  const stateMeta = STATE_META as Record<string, { label: string }>;
  if (action.type === AUTOMATION_ACTIONS.ADD_TAGS) {
    const tags = toTagList(action.value);
    return tags.length ? `${label} [${tags.join("، ")}]` : label;
  }
  if (action.type === AUTOMATION_ACTIONS.SET_STATUS) {
    return `${label}: ${stateMeta[String(action.value)]?.label || action.value || "—"}`;
  }
  return `${label}: ${action.value || "—"}`;
}

/** Human-readable Arabic summary of a rule. */
export function describeRule(rule: AutomationRule | null | undefined) {
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
