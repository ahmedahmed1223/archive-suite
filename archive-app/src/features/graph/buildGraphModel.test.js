import { describe, expect, test } from "vitest";

import { buildGraphModel, toCytoscapeElements, DOCUMENT_TYPE_COLORS } from "./buildGraphModel.js";

const item = (id, partial = {}) => ({ id, title: `مادة ${id}`, tags: [], isDeleted: false, ...partial });

describe("buildGraphModel", () => {
  test("returns empty graph for empty items", () => {
    // Arrange + Act
    const model = buildGraphModel({ videoItems: [] });

    // Assert
    expect(model.nodes).toEqual([]);
    expect(model.edges).toEqual([]);
    expect(model.truncated).toBe(false);
  });

  test("two items sharing a tag produce one edge with weight 1", () => {
    const model = buildGraphModel({
      videoItems: [item("a", { tags: ["تاريخ"] }), item("b", { tags: ["تاريخ"] })]
    });

    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({ source: "a", target: "b", weight: 1, sharedTags: ["تاريخ"] });
    expect(model.nodes.map((node) => node.degree)).toEqual([1, 1]);
  });

  test("items with no shared tags produce zero edges", () => {
    const model = buildGraphModel({
      videoItems: [item("a", { tags: ["تاريخ"] }), item("b", { tags: ["جغرافيا"] })]
    });

    expect(model.edges).toHaveLength(0);
    expect(model.nodes).toHaveLength(2);
  });

  test("manual item relations produce directed edges without shared tags", () => {
    const model = buildGraphModel({
      videoItems: [item("a"), item("b")],
      itemRelations: [{ id: "r1", sourceId: "a", targetId: "b", type: "depends_on", note: "context" }]
    });

    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({
      id: "rel:r1",
      source: "a",
      target: "b",
      edgeKind: "manual",
      relationLabel: "يعتمد على",
      weight: 2
    });
    expect(model.nodes.map((node) => node.degree)).toEqual([1, 1]);
  });

  test("manual mirror relations are ignored to avoid duplicate graph edges", () => {
    const model = buildGraphModel({
      videoItems: [item("a"), item("b")],
      itemRelations: [
        { id: "r1", sourceId: "a", targetId: "b", type: "related_to" },
        { id: "r2", sourceId: "b", targetId: "a", type: "related_to", mirrorOf: "r1" }
      ]
    });

    expect(model.edges).toHaveLength(1);
    expect(model.edges[0].id).toBe("rel:r1");
  });

  test("Arabic tag variants (همزة/تاء مربوطة) still match", () => {
    const model = buildGraphModel({
      videoItems: [item("a", { tags: ["المدرسة الأولى"] }), item("b", { tags: ["المدرسه الاولى"] })]
    });

    expect(model.edges).toHaveLength(1);
  });

  test("hierarchical-tag aliases unify into one edge", () => {
    const model = buildGraphModel({
      videoItems: [item("a", { tags: ["القدس"] }), item("b", { tags: ["بيت المقدس"] })],
      hierarchicalTags: [{ id: "t1", name: "القدس", aliases: ["بيت المقدس"] }]
    });

    expect(model.edges).toHaveLength(1);
    expect(model.edges[0].sharedTags).toEqual(["القدس"]);
  });

  test("same-collection membership produces an edge and stacks with shared tags", () => {
    const model = buildGraphModel({
      videoItems: [item("a", { tags: ["وثائق"] }), item("b", { tags: ["وثائق"] }), item("c")],
      collections: [{ id: "c1", name: "مجموعة", itemIds: ["a", "b", "c"] }]
    });

    const ab = model.edges.find((edge) => edge.source === "a" && edge.target === "b");
    expect(ab.weight).toBe(2); // shared tag + shared collection
    expect(model.edges).toHaveLength(3); // a-b, a-c, b-c
  });

  test("deleted items are excluded", () => {
    const model = buildGraphModel({
      videoItems: [item("a", { tags: ["x"] }), item("b", { tags: ["x"], isDeleted: true })]
    });

    expect(model.nodes).toHaveLength(1);
    expect(model.edges).toHaveLength(0);
  });

  test("typeFilter and maxNodes cap apply", () => {
    const model = buildGraphModel(
      {
        videoItems: [
          item("a", { documentType: "pdf", tags: ["x"] }),
          item("b", { documentType: "pdf", tags: ["x"] }),
          item("c", { documentType: "image", tags: ["x"] })
        ]
      },
      { typeFilter: "pdf", maxNodes: 1 }
    );

    expect(model.nodes).toHaveLength(1);
    expect(model.totalEligible).toBe(2);
    expect(model.truncated).toBe(true);
  });

  test("nodes are colored by documentType with video fallback", () => {
    const model = buildGraphModel({ videoItems: [item("a", { documentType: "pdf" }), item("b")] });

    expect(model.nodes[0].color).toBe(DOCUMENT_TYPE_COLORS.pdf);
    expect(model.nodes[1].documentType).toBe("video");
    expect(model.nodes[1].color).toBe(DOCUMENT_TYPE_COLORS.video);
  });

  test("toCytoscapeElements maps nodes and edges", () => {
    const model = buildGraphModel({
      videoItems: [item("a", { tags: ["x"] }), item("b", { tags: ["x"] })]
    });

    const elements = toCytoscapeElements(model);
    expect(elements.filter((el) => el.group === "nodes")).toHaveLength(2);
    expect(elements.filter((el) => el.group === "edges")).toHaveLength(1);
    expect(elements.at(-1).data).toMatchObject({ source: "a", target: "b", weight: 1, edgeKind: "shared" });
  });

  test("expanded node kinds add entity nodes without changing default behavior", () => {
    const defaultModel = buildGraphModel({
      videoItems: [item("a", { tags: ["x"] }), item("b", { tags: ["x"] })],
      collections: [{ id: "c1", name: "مجموعة", itemIds: ["a", "b"] }]
    });
    const expandedModel = buildGraphModel(
      {
        videoItems: [
          item("a", { tags: ["x"], documentType: "pdf", type: "type_reports" }),
          item("b", { tags: ["x"], documentType: "pdf", type: "type_reports" })
        ],
        collections: [{ id: "c1", name: "مجموعة", itemIds: ["a", "b"] }],
        contentTypes: [{ id: "type_reports", name: "تقارير", color: "#3b82f6" }]
      },
      { nodeKinds: ["item", "tag", "collection", "documentType", "contentType"] }
    );

    expect(defaultModel.nodes).toHaveLength(2);
    expect(expandedModel.nodes.some((node) => node.kind === "tag" && node.label === "x")).toBe(true);
    expect(expandedModel.nodes.some((node) => node.kind === "collection" && node.label === "مجموعة")).toBe(true);
    expect(expandedModel.nodes.some((node) => node.kind === "documentType" && node.label === "pdf")).toBe(true);
    expect(expandedModel.nodes.some((node) => node.kind === "contentType" && node.label === "تقارير")).toBe(true);
    expect(expandedModel.edges.some((edge) => edge.edgeKind === "tag")).toBe(true);
  });

  test("vocabulary and folder node kinds connect matching archive items", () => {
    const model = buildGraphModel(
      {
        videoItems: [
          item("a", { title: "لقاء في القدس", tags: ["سياسة"] }),
          item("b", { title: "مادة أخرى" })
        ],
        vocabulary: [{ id: "v1", term: "القدس", aliases: ["بيت المقدس"], category: "city" }],
        folders: [{ id: "f1", name: "ملف القدس", entityRefs: [{ type: "archive-item", id: "a" }] }]
      },
      { nodeKinds: ["item", "vocabulary", "folder"] }
    );

    expect(model.nodes.some((node) => node.kind === "vocabulary" && node.label === "القدس")).toBe(true);
    expect(model.nodes.some((node) => node.kind === "folder" && node.label === "ملف القدس")).toBe(true);
    expect(model.edges.some((edge) => edge.edgeKind === "vocabulary" && edge.source === "a")).toBe(true);
    expect(model.edges.some((edge) => edge.edgeKind === "folder" && edge.source === "a")).toBe(true);
  });
});
