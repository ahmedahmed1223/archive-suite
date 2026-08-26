// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TimelineCanvas from "./TimelineCanvas";
import { type EditorState } from "@/lib/montage-editor";

const copy = {
  timelineAriaLabel: "Timeline clips",
  selectHint: "Select a clip to start editing",
  selectedHint: "Clip selected — S to split",
};

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

afterEach(cleanup);

function renderCanvas(over: Partial<Parameters<typeof TimelineCanvas>[0]> = {}) {
  const props = {
    state: makeState(),
    dispatch: vi.fn(),
    selectedClipId: null as string | null,
    onSelectClip: vi.fn(),
    copy,
    ...over,
  };
  render(<TimelineCanvas {...props} />);
  return props;
}

describe("TimelineCanvas (Task 5)", () => {
  it("dispatches split when the selected clip receives the s key", () => {
    const props = renderCanvas({ selectedClipId: "clip-1" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "s" });
    expect(props.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "split", clipId: "clip-1" }),
    );
  });

  it("selects a clip on click and marks it aria-selected", () => {
    const { onSelectClip } = renderCanvas();
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-selected", "false");
    fireEvent.click(option);
    expect(onSelectClip).toHaveBeenCalledWith("clip-1");
  });

  it("renders timecode LTR inside the RTL layout", () => {
    renderCanvas();
    const tc = screen.getByText(/\d{2}:\d{2}/);
    expect(tc.getAttribute("dir")).toBe("ltr");
  });

  it("announces selection guidance through the status region", () => {
    renderCanvas({ selectedClipId: "clip-1" });
    expect(screen.getByRole("status")).toHaveTextContent(copy.selectedHint);
  });

  it("moves the selected clip with arrow keys one frame at a time", () => {
    const props = renderCanvas({ selectedClipId: "clip-1" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowRight" });
    expect(props.dispatch).toHaveBeenCalledWith({
      type: "move",
      clipId: "clip-1",
      trackId: "t1",
      start: 0.04,
    });
  });

  it("ripple-trims with the t key", () => {
    const props = renderCanvas({ selectedClipId: "clip-1" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "t" });
    expect(props.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "rippleTrim", clipId: "clip-1" }),
    );
  });
});
