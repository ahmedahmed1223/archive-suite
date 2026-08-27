// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MontageEditorPanel from "./MontageEditorPanel";
import { type EditorState } from "@/lib/montage-editor";

const { montageExportQc, collaborationPresence } = vi.hoisted(() => ({
  montageExportQc: vi.fn(),
  collaborationPresence: vi.fn(),
}));

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return {
    ...actual,
    createArchiveApiClient: () => ({ montageExportQc, collaborationPresence }),
  };
});

function makeState(): EditorState {
  return {
    projectId: "p1",
    revisionNumber: 1,
    timeline: {
      tracks: [{ id: "t1", kind: "video", name: "V1" }],
      clips: [
        {
          id: "clip-1",
          trackId: "t1",
          source: { recordId: "r1", sourceVersionToken: "sha256:a" },
          timelineStart: 0,
          sourceIn: 0,
          sourceOut: 10,
        },
      ],
    },
    past: [],
    future: [],
  };
}

const copy = {
  panelAriaLabel: "Montage editor panel",
  undoButton: "Undo",
  redoButton: "Redo",
  saveRevision: "Save revision",
  savingStatus: "Saving…",
  savedNewRevision: "Saved a new revision",
  saveFailed: "Could not save — try again",
  conflictPrefix: "Conflict: server is at revision",
  conflictSuffix: "Your edits were kept",
  clipsUnit: "clips",
  presenceLabel: "Other editors open",
  noOtherEditors: "No other editor",
  timelineAriaLabel: "Timeline clips",
  selectHint: "Select a clip to start editing",
  selectedHint: "Clip selected",
  binAriaLabel: "Material bin",
  materialsListLabel: "Available materials",
  emptyBin: "No materials yet",
  drawerAriaLabel: "Export drawer",
  exportTitle: "Export project",
  presetGroupLabel: "Choose export quality",
  runQc: "Check project",
  startExport: "Start export",
  qcRequiredHint: "QC must pass first",
} as const;

afterEach(cleanup);
beforeEach(() => {
  montageExportQc.mockResolvedValue({ ok: true, ready: true, revisionNumber: 1 });
  collaborationPresence.mockResolvedValue({ ok: true, participants: [] });
});

describe("MontageEditorPanel (Task 5/6) — structure & RTL baseline", () => {
  it("renders the editing surface with labelled regions", () => {
    render(
      <MontageEditorPanel
        projectId="p1"
        initialState={makeState()}
        materials={[]}
        copy={copy}
      />,
    );
    // The panel and each sub-region expose an accessible name.
    expect(screen.getByRole("region", { name: copy.panelAriaLabel })).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: copy.timelineAriaLabel })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: copy.presetGroupLabel })).toBeInTheDocument();
  });

  it("exposes undo/redo + save with the toolbar semantics", () => {
    render(
      <MontageEditorPanel
        projectId="p1"
        initialState={makeState()}
        materials={[]}
        copy={copy}
      />,
    );
    const undo = screen.getByRole("button", { name: copy.undoButton });
    const redo = screen.getByRole("button", { name: copy.redoButton });
    const save = screen.getByRole("button", { name: copy.saveRevision });
    expect(undo).toBeDisabled(); // nothing on the undo stack yet
    expect(redo).toBeDisabled(); // nothing on the redo stack yet
    expect(save).toBeEnabled();
  });

  it("announces save status through a live region for screen readers", () => {
    const { container } = render(
      <MontageEditorPanel
        projectId="p1"
        initialState={makeState()}
        materials={[]}
        copy={copy}
      />,
    );
    // A polite live region exists on the panel toolbar so async save results
    // are announced (scoped to the panel, not the timeline's own status).
    const panelStatus = container.querySelector(".montage-editor-panel__status");
    expect(panelStatus).not.toBeNull();
    expect(panelStatus?.getAttribute("role")).toBe("status");
  });

  it("groups columns side-by-side without leaking raw structural classes", () => {
    const { container } = render(
      <MontageEditorPanel
        projectId="p1"
        initialState={makeState()}
        materials={[]}
        copy={copy}
      />,
    );
    // RTL is the product default; the panel must not hard-code a physical
    // direction that would break Arabic. dir is set by the studio shell/page.
    const columns = container.querySelectorAll(".montage-editor-panel__columns");
    expect(columns).toHaveLength(1);
  });

  it("enables export only after the editor QC check passes", async () => {
    render(
      <MontageEditorPanel
        projectId="p1"
        initialState={makeState()}
        materials={[]}
        copy={copy}
      />,
    );

    const startExport = screen.getByRole("button", { name: copy.startExport });
    expect(startExport).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: copy.runQc }));
    await waitFor(() => expect(startExport).toBeEnabled());
  });

  it("adds material to the selected track from the material bin", () => {
    render(
      <MontageEditorPanel
        projectId="p1"
        initialState={makeState()}
        materials={[{
          id: "m1",
          name: "Interview",
          durationSeconds: 5,
          source: { recordId: "r2", sourceVersionToken: "sha256:two" },
        }]}
        copy={copy}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("option", { name: /Interview/ }));
    expect(screen.getByText(/rev 1 · 2 clips/)).toBeInTheDocument();
  });
});
