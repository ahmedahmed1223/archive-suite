import { describe, expect, test } from "vitest";
import {
  createSmartRuleset,
  createRuleCondition,
  matchItemAgainstRules,
  evaluateSmartCollection,
  countSmartMatches,
  describeRuleset
} from "./smartCollectionRules.js";

const item = (overrides: Record<string, unknown> = {}) => ({
  id: typeof overrides.id === "string" ? overrides.id : "v1",
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

describe("createSmartRuleset", () => {
  test("defaults to all-match with empty conditions", () => {
    const rules = createSmartRuleset();
    expect(rules.match).toBe("all");
    expect(rules.conditions).toEqual([]);
    expect(rules.kind).toBe("rules");
  });

  test("drops conditions with unknown fields", () => {
    const rules = createSmartRuleset({
      conditions: [{ field: "bogus", operator: "equals", value: "x" }, { field: "type", operator: "equals", value: "video" }]
    });
    expect(rules.conditions).toHaveLength(1);
    expect(rules.conditions[0].field).toBe("type");
  });

  test("createRuleCondition falls back to first valid operator", () => {
    const condition = createRuleCondition({ field: "tags", operator: "nope", value: "x" });
    expect(condition).not.toBeNull();
    expect(condition!.operator).toBe("includesAny");
  });
});

describe("matchItemAgainstRules — tags", () => {
  test("includesAny matches when one tag overlaps", () => {
    const rules = { match: "all", conditions: [{ field: "tags", operator: "includesAny", value: ["شخصي", "عمل"] }] };
    expect(matchItemAgainstRules(item(), rules)).toBe(true);
  });

  test("includesAll requires every tag", () => {
    const rules = { match: "all", conditions: [{ field: "tags", operator: "includesAll", value: ["عمل", "2027"] }] };
    expect(matchItemAgainstRules(item(), rules)).toBe(false);
  });

  test("notIncludes excludes matching tag", () => {
    const rules = { match: "all", conditions: [{ field: "tags", operator: "notIncludes", value: ["عمل"] }] };
    expect(matchItemAgainstRules(item(), rules)).toBe(false);
  });
});

describe("matchItemAgainstRules — enums, text, boolean", () => {
  test("type equals", () => {
    const rules = { match: "all", conditions: [{ field: "type", operator: "equals", value: "video" }] };
    expect(matchItemAgainstRules(item(), rules)).toBe(true);
  });

  test("status in list", () => {
    const rules = { match: "all", conditions: [{ field: "status", operator: "in", value: ["draft", "review"] }] };
    expect(matchItemAgainstRules(item(), rules)).toBe(true);
  });

  test("title contains (Arabic-normalized)", () => {
    const rules = { match: "all", conditions: [{ field: "title", operator: "contains", value: "اجتماع" }] };
    expect(matchItemAgainstRules(item(), rules)).toBe(true);
  });

  test("favorite isTrue", () => {
    const rules = { match: "all", conditions: [{ field: "favorite", operator: "isTrue", value: null }] };
    expect(matchItemAgainstRules(item({ isFavorite: true }), rules)).toBe(true);
    expect(matchItemAgainstRules(item(), rules)).toBe(false);
  });
});

describe("matchItemAgainstRules — date & size", () => {
  test("createdAt withinDays uses context.now", () => {
    const now = new Date("2026-06-14T10:00:00.000Z").getTime();
    const rules = { match: "all", conditions: [{ field: "createdAt", operator: "withinDays", value: 7 }] };
    expect(matchItemAgainstRules(item(), rules, { now })).toBe(true);
    expect(matchItemAgainstRules(item({ createdAt: "2026-01-01T00:00:00.000Z" }), rules, { now })).toBe(false);
  });

  test("size between", () => {
    const rules = { match: "all", conditions: [{ field: "size", operator: "between", value: [500, 2000] }] };
    expect(matchItemAgainstRules(item(), rules)).toBe(true);
    expect(matchItemAgainstRules(item({ metadata: { size: 9000 } }), rules)).toBe(false);
  });

  test("folder resolves via context.folders when parentId is empty", () => {
    const rules = { match: "all", conditions: [{ field: "folder", operator: "equals", value: "f1" }] };
    const folders = [{ id: "f1", itemIds: ["v1"] }];
    expect(matchItemAgainstRules(item(), rules, { folders })).toBe(true);
  });
});

describe("match modes & evaluation", () => {
  test("any matches when a single condition passes", () => {
    const rules = {
      match: "any",
      conditions: [
        { field: "type", operator: "equals", value: "audio" },
        { field: "tags", operator: "includesAny", value: ["عمل"] }
      ]
    };
    expect(matchItemAgainstRules(item(), rules)).toBe(true);
  });

  test("all fails when one condition fails", () => {
    const rules = {
      match: "all",
      conditions: [
        { field: "type", operator: "equals", value: "video" },
        { field: "favorite", operator: "isTrue", value: null }
      ]
    };
    expect(matchItemAgainstRules(item(), rules)).toBe(false);
  });

  test("empty ruleset matches nothing", () => {
    expect(matchItemAgainstRules(item(), { match: "all", conditions: [] })).toBe(false);
  });

  test("evaluateSmartCollection excludes deleted and counts matches", () => {
    const items = [item({ id: "a" }), item({ id: "b", isDeleted: true }), item({ id: "c", type: "audio" })];
    const rules = { match: "all", conditions: [{ field: "type", operator: "equals", value: "video" }] };
    const matched = evaluateSmartCollection(rules, items);
    expect(matched.map((entry) => entry.id)).toEqual(["a"]);
    expect(countSmartMatches(rules, items)).toBe(1);
  });
});

describe("describeRuleset", () => {
  test("summarizes conditions in Arabic", () => {
    const text = describeRuleset({
      match: "all",
      conditions: [{ field: "tags", operator: "includesAny", value: ["عمل"] }]
    });
    expect(text).toContain("تطابق الكل");
    expect(text).toContain("الوسوم");
  });

  test("reports empty ruleset", () => {
    expect(describeRuleset({ conditions: [] })).toBe("بلا قواعد");
  });
});
