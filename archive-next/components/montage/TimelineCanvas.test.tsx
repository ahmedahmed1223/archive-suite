// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TimelineCanvas from "./TimelineCanvas";
import { reduceEditor, type EditorState } from "@/lib/montage-editor";

function makeState(): EditorState {
  return {
    projectId: "p1",
    revisionNumber: 1,
    timeline: {
      tracks: [{ id: "t1", kind: "video", name: "فيديو ١" }],
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

describe("TimelineCanvas (Task 5)", () => {
  it("dispatches split when the selected clip receives the s key", () => {
    const dispatch = vi.fn();
    const onSelectClip = vi.fn();
    render(
      <TimelineCanvas
        state={makeState()}
        dispatch={dispatch}
        selectedClipId="clip-1"
        onSelectClip={onSelectClip}
      />,
    );
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "s" });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "split", clipId: "clip-1" }),
    );
  });

  it("selects a clip on click and marks it aria-selected", () => {
    const onSelectClip = vi.fn();
    render(
      <TimelineCanvas
        state={makeState()}
        dispatch={vi.fn()}
        selectedClipId={null}
        onSelectClip={onSelectClip}
      />,
    );
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-selected", "false");
    fireEvent.click(option);
    expect(onSelectClip).toHaveBeenCalledWith("clip-1");
  });

  it("renders timecode LTR inside the RTL layout", () => {
    render(
      <TimelineCanvas
        state={makeState()}
        dispatch={vi.fn()}
        selectedClipId={null}
        onSelectClip={vi.fn()}
      />,
    );
    const tc = screen.getByText(/\d{2}:\d{2}/);
    expect(tc.getAttribute("dir")).toBe("ltr");
  });

  it("announces selection guidance through the status region", () => {
    render(
      <TimelineCanvas
        state={makeState()}
        dispatch={vi.fn()}
        selectedClipId="clip-1"
        onSelectClip={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/محدد/);
  });

  it("moves the selected clip with arrow keys one frame at a time", () => {
    const dispatch = vi.fn();
    render(
      <TimelineCanvas
        state={makeState()}
        dispatch={dispatch}
        selectedClipId="clip-1"
        onSelectClip={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowRight" });
    expect(dispatch).toHaveBeenCalledWith({
      type: "move",
      clipId: "clip-1",
      trackId: "t1",
      start: 0.04,
    });
  });
});
