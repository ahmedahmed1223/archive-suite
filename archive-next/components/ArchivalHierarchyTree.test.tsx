// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ArchivalNode } from "@/lib/archive-api";
import ArchivalHierarchyTree from "./ArchivalHierarchyTree";

const nodes: ArchivalNode[] = [
  { id: "fonds", title: "News archive", level: "fonds", parentId: null, path: [], position: 1, recordStore: null, recordUid: null, referenceCode: "F-01" },
  { id: "series", title: "Evening news", level: "series", parentId: "fonds", path: [{ id: "fonds", title: "News archive", level: "fonds" }], position: 1, recordStore: null, recordUid: null, referenceCode: "S-01" },
  { id: "item", title: "Bulletin 2026-09-14", level: "item", parentId: "series", path: [{ id: "fonds", title: "News archive", level: "fonds" }, { id: "series", title: "Evening news", level: "series" }], position: 1, recordStore: "archive-items", recordUid: "record-1", referenceCode: null },
];

const copy = {
  expand: "Expand children of {title}",
  collapse: "Collapse children of {title}",
  childCount: "{count} children",
  move: "Move",
  levelLabels: {
    institution: "Institution", fonds: "Fonds", series: "Series", program: "Program",
    season: "Season", episode: "Episode", item: "Item", segment: "Segment",
  },
};

describe("ArchivalHierarchyTree", () => {
  afterEach(() => cleanup());

  test("renders each node under its real parent and supports collapsing a branch", () => {
    render(<ArchivalHierarchyTree nodes={nodes} copy={copy} onMove={vi.fn()} />);

    expect(screen.getByRole("tree", { name: "Archival hierarchy" })).toBeVisible();
    expect(screen.getByText("News archive")).toBeVisible();
    expect(screen.getByText("Evening news")).toBeVisible();
    expect(screen.getByText("Bulletin 2026-09-14")).toBeVisible();
    expect(screen.getAllByText("1 children")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Collapse children of News archive" }));
    expect(screen.queryByText("Evening news")).not.toBeInTheDocument();
  });

  test("keeps the movement action available on every hierarchy node", () => {
    const onMove = vi.fn();
    render(<ArchivalHierarchyTree nodes={nodes} copy={copy} onMove={onMove} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Move" })[2]);
    expect(onMove).toHaveBeenCalledWith(nodes[2]);
  });
});
