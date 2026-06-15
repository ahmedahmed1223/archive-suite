import { describe, expect, test } from "vitest";
import {
  AUTOMATION_TRIGGERS,
  AUTOMATION_ACTIONS,
  createAutomationRule,
  createAutomationAction,
  evaluateRule,
  applyActionPlanToItem,
  collectionTargetsFromPlan,
  describeRule
} from "./automationModel.js";

const item = (overrides = {}) => ({
  id: "v1",
  type: "video",
  subtype: "",
  title: "اجتماع الفريق",
  notes: "",
  tags: ["عمل", "2026"],
  isFavorite: false,
  isDeleted: false,
  workflowStatus: "draft",
  parentId: "",
  metadata: { size: 1000 },
  createdAt: "2026-06-10T10:00:00.000Z",
  updatedAt: "2026-06-10T10:00:00.000Z",
  ...overrides
});

describe("createAutomationRule", () => {
  test("normalizes partial input with defaults", () => {
    const rule = createAutomationRule({ name: "  tag work  " });
    expect(rule.id).toMatch(/^auto_/);
    expect(rule.name).toBe("tag work");
    expect(rule.enabled).toBe(true);
    expect(rule.trigger).toBe(AUTOMATION_TRIGGERS.ITEM_ADDED);
    expect(rule.conditions).toEqual([]);
    expect(rule.actions).toEqual([]);
    expect(rule.lastRunAt).toBeNull();
    expect(typeof rule.createdAt).toBe("string");
  });

  test("drops malformed conditions and actions defensively", () => {
    const rule = createAutomationRule({
      conditions: [{ field: "tags", operator: "includesAny", value: "عمل" }, { field: "nope" }],
      actions: [{ type: "add_tags", value: "مهم" }, { type: "delete_item" }]
    });
    expect(rule.conditions).toHaveLength(1);
    expect(rule.actions).toHaveLength(1);
    expect(rule.actions[0]).toEqual({ type: AUTOMATION_ACTIONS.ADD_TAGS, value: ["مهم"] });
  });
});

describe("createAutomationAction", () => {
  test("returns null for unknown action type", () => {
    expect(createAutomationAction({ type: "delete_item" })).toBeNull();
  });

  test("rejects invalid workflow status for set_status", () => {
    expect(createAutomationAction({ type: "set_status", value: "bogus" })).toEqual({
      type: "set_status",
      value: null
    });
  });
});

describe("evaluateRule", () => {
  test("trigger match: returns actions when trigger matches", () => {
    const rule = createAutomationRule({
      trigger: AUTOMATION_TRIGGERS.ITEM_ADDED,
      actions: [{ type: "add_tags", value: "مهم" }]
    });
    const plan = evaluateRule(rule, item(), { trigger: AUTOMATION_TRIGGERS.ITEM_ADDED });
    expect(plan).toHaveLength(1);
  });

  test("trigger mismatch: returns no actions", () => {
    const rule = createAutomationRule({
      trigger: AUTOMATION_TRIGGERS.ITEM_ADDED,
      actions: [{ type: "add_tags", value: "مهم" }]
    });
    const plan = evaluateRule(rule, item(), { trigger: AUTOMATION_TRIGGERS.ITEM_UPDATED });
    expect(plan).toEqual([]);
  });

  test("condition match via reused smart-rules engine", () => {
    const rule = createAutomationRule({
      trigger: AUTOMATION_TRIGGERS.ITEM_ADDED,
      conditions: [{ field: "tags", operator: "includesAny", value: ["عمل"] }],
      actions: [{ type: "add_tags", value: "مهم" }]
    });
    const matchPlan = evaluateRule(rule, item(), { trigger: AUTOMATION_TRIGGERS.ITEM_ADDED });
    expect(matchPlan).toHaveLength(1);

    const noMatchPlan = evaluateRule(rule, item({ tags: ["شخصي"] }), {
      trigger: AUTOMATION_TRIGGERS.ITEM_ADDED
    });
    expect(noMatchPlan).toEqual([]);
  });

  test("disabled rule yields no actions", () => {
    const rule = createAutomationRule({
      enabled: false,
      trigger: AUTOMATION_TRIGGERS.ITEM_ADDED,
      actions: [{ type: "add_tags", value: "مهم" }]
    });
    expect(evaluateRule(rule, item(), { trigger: AUTOMATION_TRIGGERS.ITEM_ADDED })).toEqual([]);
  });

  test("no conditions => trigger alone fires", () => {
    const rule = createAutomationRule({
      trigger: AUTOMATION_TRIGGERS.ITEM_ADDED,
      actions: [{ type: "set_status", value: "review" }]
    });
    expect(evaluateRule(rule, item(), { trigger: AUTOMATION_TRIGGERS.ITEM_ADDED })).toHaveLength(1);
  });
});

describe("applyActionPlanToItem", () => {
  test("add_tags union/dedup preserves existing and appends new", () => {
    const actions = [
      { type: AUTOMATION_ACTIONS.ADD_TAGS, value: ["عمل", "مهم", "مهم"] }
    ];
    const result = applyActionPlanToItem(item(), actions);
    expect(result.tags).toEqual(["عمل", "2026", "مهم"]);
  });

  test("set_status applied for valid state, ignored for invalid", () => {
    const result = applyActionPlanToItem(item(), [
      { type: AUTOMATION_ACTIONS.SET_STATUS, value: "review" }
    ]);
    expect(result.workflowStatus).toBe("review");

    const ignored = applyActionPlanToItem(item(), [
      { type: AUTOMATION_ACTIONS.SET_STATUS, value: null }
    ]);
    expect(ignored.workflowStatus).toBe("draft");
  });

  test("is pure — does not mutate the input item", () => {
    const original = item();
    const snapshot = JSON.parse(JSON.stringify(original));
    applyActionPlanToItem(original, [{ type: AUTOMATION_ACTIONS.ADD_TAGS, value: ["x"] }]);
    expect(original).toEqual(snapshot);
  });

  test("add_to_collection is not applied to the item", () => {
    const result = applyActionPlanToItem(item(), [
      { type: AUTOMATION_ACTIONS.ADD_TO_COLLECTION, value: "col_1" }
    ]);
    expect(result.tags).toEqual(["عمل", "2026"]);
    expect(result.workflowStatus).toBe("draft");
  });
});

describe("collectionTargetsFromPlan", () => {
  test("extracts collection ids from add_to_collection actions", () => {
    const plan = [
      { type: AUTOMATION_ACTIONS.ADD_TO_COLLECTION, value: "col_1" },
      { type: AUTOMATION_ACTIONS.ADD_TAGS, value: ["x"] },
      { type: AUTOMATION_ACTIONS.ADD_TO_COLLECTION, value: "col_2" }
    ];
    expect(collectionTargetsFromPlan(plan)).toEqual(["col_1", "col_2"]);
  });
});

describe("describeRule", () => {
  test("produces an Arabic summary with trigger, conditions, and actions", () => {
    const rule = createAutomationRule({
      trigger: AUTOMATION_TRIGGERS.ITEM_ADDED,
      conditions: [{ field: "tags", operator: "includesAny", value: ["عمل"] }],
      actions: [{ type: "add_tags", value: "مهم" }]
    });
    const summary = describeRule(rule);
    expect(summary).toContain("عند إضافة عنصر");
    expect(summary).toContain("الوسوم");
    expect(summary).toContain("أضف وسوماً");
  });

  test("summarizes a rule with no conditions", () => {
    const rule = createAutomationRule({
      trigger: AUTOMATION_TRIGGERS.ITEM_UPDATED,
      actions: [{ type: "set_status", value: "review" }]
    });
    const summary = describeRule(rule);
    expect(summary).toContain("بلا شروط");
    expect(summary).toContain("مراجعة");
  });
});
