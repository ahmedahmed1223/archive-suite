// @vitest-environment jsdom
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MultiTrackTimeline } from "./MultiTrackTimeline.jsx";

const tracks = [
  { id: "v1", type: "video", name: "القصة", order: 0, magnetic: true },
  { id: "a1", type: "audio", name: "الحوار", order: 1, muted: false, solo: false }
];

const clips = [
  { id: "clip-1", itemId: "item-1", label: "المقابلة", trackId: "v1", timelineStartSec: 0, inSec: 0, outSec: 5 }
];

describe("MultiTrackTimeline", () => {
  it("emits track add, rename, mute, solo, lock, magnetic, and reorder commands", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<MultiTrackTimeline tracks={tracks} clips={clips} onCommand={onCommand} />);

    await user.click(screen.getByRole("button", { name: "إضافة مسار فيديو" }));
    await user.click(screen.getByRole("button", { name: "كتم مسار الحوار" }));
    await user.click(screen.getByRole("button", { name: "عزل مسار الحوار" }));
    await user.click(screen.getByRole("button", { name: "قفل مسار القصة" }));
    await user.click(screen.getByRole("button", { name: "المسار المغناطيسي القصة" }));
    await user.click(screen.getByRole("button", { name: "نقل مسار الحوار لأعلى" }));
    const nameInput = screen.getByLabelText("اسم مسار الحوار");
    await user.clear(nameInput);
    await user.type(nameInput, "الصوت الرئيسي{Enter}");

    expect(onCommand).toHaveBeenCalledWith({ type: "track.add", trackType: "video" });
    expect(onCommand).toHaveBeenCalledWith({ type: "track.patch", trackId: "a1", patch: { muted: true } });
    expect(onCommand).toHaveBeenCalledWith({ type: "track.patch", trackId: "a1", patch: { solo: true } });
    expect(onCommand).toHaveBeenCalledWith({ type: "track.patch", trackId: "v1", patch: { locked: true } });
    expect(onCommand).toHaveBeenCalledWith({ type: "track.patch", trackId: "v1", patch: { magnetic: false } });
    expect(onCommand).toHaveBeenCalledWith({ type: "track.reorder", trackId: "a1", direction: -1 });
    expect(onCommand).toHaveBeenCalledWith({ type: "track.patch", trackId: "a1", patch: { name: "الصوت الرئيسي" } });
  });

  it("guards deletion of a non-empty track with move, delete, and cancel choices", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<MultiTrackTimeline tracks={tracks} clips={clips} onCommand={onCommand} />);

    await user.click(screen.getByRole("button", { name: "حذف مسار القصة" }));
    expect(screen.getByRole("dialog", { name: "حذف مسار القصة" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "نقل القصاصات ثم الحذف" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "حذف المسار والقصاصات" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "إلغاء" }));
    expect(onCommand).not.toHaveBeenCalledWith(expect.objectContaining({ type: "track.delete" }));
  });

  it("emits keyboard nudge, move-track, split, and delete clip commands", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<MultiTrackTimeline tracks={tracks} clips={clips} selectedClipId="clip-1" playheadSec={2} onCommand={onCommand} />);

    const clip = screen.getByRole("button", { name: /قصاصة المقابلة/ });
    clip.focus();
    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    await user.keyboard("s");
    await user.keyboard("{Delete}");

    expect(onCommand).toHaveBeenCalledWith({ type: "clip.nudge", clipId: "clip-1", frames: 1 });
    expect(onCommand).toHaveBeenCalledWith({ type: "clip.move-track", clipId: "clip-1", direction: -1 });
    expect(onCommand).toHaveBeenCalledWith({ type: "clip.split", clipId: "clip-1", atSec: 2 });
    expect(onCommand).toHaveBeenCalledWith({ type: "clip.delete", clipId: "clip-1" });
  });

  it("coalesces a trim gesture into one command at pointer up", () => {
    const onCommand = vi.fn();
    const { container } = render(<MultiTrackTimeline tracks={tracks} clips={clips} pixelsPerSecond={10} onCommand={onCommand} />);
    const outHandle = container.querySelector('[data-edge="out"]');

    fireEvent.pointerDown(outHandle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(outHandle, { clientX: 80, pointerId: 1 });

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith({ type: "clip.trim", clipId: "clip-1", edge: "out", sourceSec: 7 });
  });
});
