// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import MontageEditorPanel from "./MontageEditorPanel";
import ExportDrawer from "./ExportDrawer";
import MediaBin, { type MaterialBinItem } from "./MediaBin";
import TimelineCanvas from "./TimelineCanvas";
import { type EditorState } from "@/lib/montage-editor";

const editorCopy = {
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

const materials: MaterialBinItem[] = [
  { id: "m1", title: "Clip A", recordId: "r1", kind: "video" },
];

afterEach(cleanup);

describe("Montage component visual baselines (T10 step 3 stand-in)", () => {
  it("MontageEditorPanel structure snapshot", () => {
    const { container } = render(
      <MontageEditorPanel projectId="p1" initialState={makeState()} materials={[]} copy={editorCopy} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("ExportDrawer (QC not ready) snapshot", () => {
    const { container } = render(
      <ExportDrawer
        projectId="p1"
        currentRevision={1}
        qcReady={false}
        onRequestExport={() => undefined}
        copy={{
          drawerAriaLabel: editorCopy.drawerAriaLabel,
          title: editorCopy.exportTitle,
          presetGroupLabel: editorCopy.presetGroupLabel,
          runQc: editorCopy.runQc,
          startExport: editorCopy.startExport,
          qcRequiredHint: editorCopy.qcRequiredHint,
        }}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("MediaBin populated snapshot", () => {
    const { container } = render(
      <MediaBin
        items={materials}
        selectedId={null}
        onSelect={() => undefined}
        copy={{
          binAriaLabel: editorCopy.binAriaLabel,
          listLabel: editorCopy.materialsListLabel,
          emptyBin: editorCopy.emptyBin,
        }}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("TimelineCanvas with a clip snapshot", () => {
    const { container } = render(
      <TimelineCanvas
        state={makeState()}
        dispatch={() => undefined}
        fps={25}
        selectedClipId={null}
        onSelectClip={() => undefined}
        copy={{
          timelineAriaLabel: editorCopy.timelineAriaLabel,
          selectHint: editorCopy.selectHint,
          selectedHint: editorCopy.selectedHint,
        }}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
