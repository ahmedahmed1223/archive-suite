import { describe, expect, it, vi } from "vitest";
import type { ArchiveApiClient } from "@/lib/archive-api";
import { getVocabTemplateCatalog } from "./catalog";
import { applyVocabTemplatePlan, loadExistingVocabState, planVocabTemplateApply, type ExistingVocabState } from "./apply";

const broadcast = getVocabTemplateCatalog("ar").find((entry) => entry.key === "broadcast")!;
const emptyExisting: ExistingVocabState = { typeIds: [], templates: [], tags: [] };

function mockApi(overrides: Partial<ArchiveApiClient> = {}): ArchiveApiClient {
  return {
    saveType: vi.fn(async (payload) => ({ ok: true, type: payload })),
    createTagNode: vi.fn(async (payload) => ({ ok: true, node: { id: "node-id", ...payload, color: null, order: 0, icon: null, createdAt: null, updatedAt: null } })),
    createMetadataTemplate: vi.fn(async (payload) => ({
      ok: true,
      template: {
        id: "template-id",
        typeId: payload.typeId ?? null,
        departmentId: payload.departmentId ?? null,
        name: payload.name ?? "",
        fields: payload.fields ?? {},
        tags: payload.tags ?? [],
        enabled: payload.enabled ?? true,
        usageRoles: payload.usageRoles ?? [],
        currentVersion: 1,
        createdById: null,
        updatedById: null,
        publishedVersion: null,
        publishedById: null,
        publishedAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    })),
    ...overrides,
  } as unknown as ArchiveApiClient;
}

describe("planVocabTemplateApply", () => {
  it("marks everything for creation when nothing exists yet", () => {
    const plan = planVocabTemplateApply(broadcast, emptyExisting);
    expect(plan.type.status).toBe("create");
    expect(plan.metadataTemplate.status).toBe("create");
    expect(plan.tags.every((tag) => tag.status === "create")).toBe(true);
  });

  it("marks the type as existing by id, case/whitespace-insensitively, without touching its data", () => {
    const plan = planVocabTemplateApply(broadcast, { ...emptyExisting, typeIds: [" Pattern-Broadcast-Program "] });
    expect(plan.type.status).toBe("exists");
    // The plan carries the catalog's own blueprint even for an "exists" entry
    // — the caller must never substitute it into a create call.
    expect(plan.type.blueprint).toBe(broadcast.type);
  });

  it("marks the metadata template as existing only when both typeId and name match", () => {
    const sameNameDifferentType = planVocabTemplateApply(broadcast, {
      ...emptyExisting,
      templates: [{ typeId: "some-other-type", name: broadcast.metadataTemplate.name }],
    });
    expect(sameNameDifferentType.metadataTemplate.status).toBe("create");

    const matching = planVocabTemplateApply(broadcast, {
      ...emptyExisting,
      templates: [{ typeId: broadcast.metadataTemplate.typeId, name: `  ${broadcast.metadataTemplate.name.toUpperCase()}  ` }],
    });
    expect(matching.metadataTemplate.status).toBe("exists");
  });

  it("marks a tag as existing only when its (tag, parent) pair matches", () => {
    const rootTag = broadcast.tags[0];
    const plan = planVocabTemplateApply(broadcast, { ...emptyExisting, tags: [{ tag: rootTag.tag, parent: rootTag.parent }] });
    expect(plan.tags[0].status).toBe("exists");
    expect(plan.tags.slice(1).every((tag) => tag.status === "create")).toBe(true);
  });

  it("returns every default when all defaults already exist — the reference case for a repeat apply", () => {
    const plan = planVocabTemplateApply(broadcast, {
      typeIds: [broadcast.type.id],
      templates: [{ typeId: broadcast.metadataTemplate.typeId, name: broadcast.metadataTemplate.name }],
      tags: broadcast.tags.map((tag) => ({ tag: tag.tag, parent: tag.parent })),
    });
    expect(plan.type.status).toBe("exists");
    expect(plan.metadataTemplate.status).toBe("exists");
    expect(plan.tags.every((tag) => tag.status === "exists")).toBe(true);
  });
});

describe("loadExistingVocabState", () => {
  it("paginates through /types, requests disabled metadata templates, and maps tag nodes", async () => {
    const typesCalls: Array<{ cursor?: string }> = [];
    const api = mockApi({
      types: vi.fn(async (params?: { cursor?: string }) => {
        typesCalls.push({ cursor: params?.cursor });
        if (!params?.cursor) {
          return { ok: true, types: [{ id: "a", name: "A", fields: [] }], nextCursor: "page-2" };
        }
        return { ok: true, types: [{ id: "b", name: "B", fields: [] }], nextCursor: null };
      }),
      metadataTemplates: vi.fn(async () => ({
        ok: true,
        templates: [{ id: "t1", typeId: "a", departmentId: "d", name: "Template A", fields: {}, tags: [], enabled: false, usageRoles: [], currentVersion: 1, createdById: null, updatedById: null, publishedVersion: null, publishedById: null, publishedAt: null, createdAt: "", updatedAt: "" }],
      })),
      tagNodes: vi.fn(async () => ({ ok: true, nodes: [{ id: "n1", tag: "X", parent: "", color: null, order: 0, icon: null, createdAt: null, updatedAt: null }] })),
    } as unknown as Partial<ArchiveApiClient>);

    const result = await loadExistingVocabState(api);

    expect(typesCalls).toEqual([{ cursor: undefined }, { cursor: "page-2" }]);
    expect(api.metadataTemplates).toHaveBeenCalledWith({ includeDisabled: true });
    expect(result).toEqual({
      ok: true,
      state: {
        typeIds: ["a", "b"],
        templates: [{ typeId: "a", name: "Template A" }],
        tags: [{ tag: "X", parent: "" }],
      },
    });
  });

  it("surfaces the first failing request instead of throwing", async () => {
    const api = mockApi({ types: vi.fn(async () => ({ ok: false, error: "network down" })) } as unknown as Partial<ArchiveApiClient>);
    const result = await loadExistingVocabState(api);
    expect(result).toEqual({ ok: false, error: "network down" });
  });
});

describe("applyVocabTemplatePlan", () => {
  it("creates the type, then its tags, then the metadata template, with the given department id and the template disabled", async () => {
    const api = mockApi();
    const plan = planVocabTemplateApply(broadcast, emptyExisting);
    const calls: string[] = [];
    (api.saveType as ReturnType<typeof vi.fn>).mockImplementation(async (payload: unknown) => { calls.push("type"); return { ok: true, type: payload }; });
    (api.createTagNode as ReturnType<typeof vi.fn>).mockImplementation(async (payload: { tag: string; parent: string }) => { calls.push("tag"); return { ok: true, node: { id: "n", ...payload, color: null, order: 0, icon: null, createdAt: null, updatedAt: null } }; });
    (api.createMetadataTemplate as ReturnType<typeof vi.fn>).mockImplementation(async (payload: { name: string }) => { calls.push("template"); return { ok: true, template: { id: "t", typeId: null, departmentId: null, name: payload.name, fields: {}, tags: [], enabled: false, usageRoles: [], currentVersion: 1, createdById: null, updatedById: null, publishedVersion: null, publishedById: null, publishedAt: null, createdAt: "", updatedAt: "" } }; });

    const result = await applyVocabTemplatePlan(api, plan, "general");

    expect(calls[0]).toBe("type");
    expect(calls[calls.length - 1]).toBe("template");
    expect(calls.filter((call) => call === "tag")).toHaveLength(broadcast.tags.length);
    expect(result.error).toBeUndefined();
    expect(result.createdTypeIds).toEqual([broadcast.type.id]);
    expect(result.createdTags).toHaveLength(broadcast.tags.length);
    expect(result.createdTemplateNames).toEqual([broadcast.metadataTemplate.name]);
    expect(api.createMetadataTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ departmentId: "general", enabled: false }),
    );
  });

  it("re-applying a fully-existing plan calls no API method at all — the idempotency guarantee", async () => {
    const api = mockApi();
    const plan = planVocabTemplateApply(broadcast, {
      typeIds: [broadcast.type.id],
      templates: [{ typeId: broadcast.metadataTemplate.typeId, name: broadcast.metadataTemplate.name }],
      tags: broadcast.tags.map((tag) => ({ tag: tag.tag, parent: tag.parent })),
    });

    const result = await applyVocabTemplatePlan(api, plan, "general");

    expect(api.saveType).not.toHaveBeenCalled();
    expect(api.createTagNode).not.toHaveBeenCalled();
    expect(api.createMetadataTemplate).not.toHaveBeenCalled();
    expect(result).toEqual({ createdTypeIds: [], createdTemplateNames: [], createdTags: [] });
  });

  it("creates only the missing pieces on a partial plan (e.g. type exists, tags and template do not)", async () => {
    const api = mockApi();
    const plan = planVocabTemplateApply(broadcast, { ...emptyExisting, typeIds: [broadcast.type.id] });

    await applyVocabTemplatePlan(api, plan, "general");

    expect(api.saveType).not.toHaveBeenCalled();
    expect(api.createTagNode).toHaveBeenCalledTimes(broadcast.tags.length);
    expect(api.createMetadataTemplate).toHaveBeenCalledTimes(1);
  });

  it("stops at the first failure and reports it, without attempting the remaining steps", async () => {
    const api = mockApi();
    (api.saveType as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "boom" });
    const plan = planVocabTemplateApply(broadcast, emptyExisting);

    const result = await applyVocabTemplatePlan(api, plan, "general");

    expect(result.error).toBe("boom");
    expect(api.createTagNode).not.toHaveBeenCalled();
    expect(api.createMetadataTemplate).not.toHaveBeenCalled();
  });
});
