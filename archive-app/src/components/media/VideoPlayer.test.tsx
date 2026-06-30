/**
 * @vitest-environment jsdom
 */
import React from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { VideoPlayer } from "./VideoPlayer.jsx";

// jsdom does not implement the media playback API; stub the bits the player touches.
const originalPlay = window.HTMLMediaElement.prototype.play;
const originalPause = window.HTMLMediaElement.prototype.pause;
let playSpy: ReturnType<typeof vi.fn>;
let pauseSpy: ReturnType<typeof vi.fn>;

beforeAll(() => {
  playSpy = vi.fn().mockResolvedValue(undefined);
  pauseSpy = vi.fn();
  window.HTMLMediaElement.prototype.play = playSpy;
  window.HTMLMediaElement.prototype.pause = pauseSpy;
});

afterAll(() => {
  window.HTMLMediaElement.prototype.play = originalPlay;
  window.HTMLMediaElement.prototype.pause = originalPause;
});

beforeEach(() => {
  playSpy.mockClear();
  pauseSpy.mockClear();
});

const cues = [{ start: 0, end: 2, text: "مرحبا" }];

function renderPlayer(props = {}) {
  const ref = React.createRef<HTMLVideoElement>();
  const utils = render(<VideoPlayer videoRef={ref} src="blob:video" cues={cues} {...props} />);
  return { ...utils, ref };
}

function loadMetadata(video: HTMLVideoElement, durationSec: number) {
  Object.defineProperty(video, "duration", { value: durationSec, configurable: true });
  fireEvent.durationChange(video);
  fireEvent.loadedMetadata(video);
}

describe("VideoPlayer interactions", () => {
  it("plays and reflects the playing state from the video element", () => {
    const { ref } = renderPlayer();
    // jsdom video starts paused, so clicking play calls play().
    fireEvent.click(screen.getByRole("button", { name: "تشغيل" }));
    expect(playSpy).toHaveBeenCalledTimes(1);

    // The play/pause icon follows the element's own events, not the click.
    fireEvent.play(ref.current!);
    expect(screen.getByRole("button", { name: "إيقاف مؤقت" })).toBeInTheDocument();
  });

  it("toggles mute on the underlying video", () => {
    const { ref } = renderPlayer();
    expect(ref.current!.muted).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "كتم" }));
    expect(ref.current!.muted).toBe(true);
  });

  it("responds to keyboard shortcuts (Space plays, ArrowRight seeks)", () => {
    const { ref } = renderPlayer();
    const region = screen.getByRole("region", { name: "مشغل الفيديو" });

    fireEvent.keyDown(region, { key: " " });
    expect(playSpy).toHaveBeenCalledTimes(1);

    loadMetadata(ref.current!, 120);
    ref.current!.currentTime = 10;
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(ref.current!.currentTime).toBe(15);
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(ref.current!.currentTime).toBe(10);
  });

  it("changes playback speed from the speed menu", () => {
    const { ref } = renderPlayer();
    fireEvent.click(screen.getByRole("button", { name: "1×" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "1.5×" }));
    expect(ref.current!.playbackRate).toBe(1.5);
    // Menu closes after a choice.
    expect(screen.queryByRole("menuitemradio", { name: "1.5×" })).not.toBeInTheDocument();
  });

  it("requests a subtitle toggle when CC is pressed", () => {
    const onToggleSubtitles = vi.fn();
    renderPlayer({ onToggleSubtitles });
    fireEvent.click(screen.getByRole("button", { name: "إخفاء الترجمة" }));
    expect(onToggleSubtitles).toHaveBeenCalledTimes(1);
  });

  it("shows a hover preview with a timestamp once duration is known", () => {
    const { ref } = renderPlayer();
    loadMetadata(ref.current!, 120);
    const scrubber = screen.getByLabelText("شريط التقدم");
    fireEvent.mouseMove(scrubber.parentElement!, { clientX: 0 });
    expect(screen.getByTestId("scrubber-preview")).toBeInTheDocument();
  });

  it("hides the subtitle toggle when there are no cues", () => {
    renderPlayer({ cues: [] });
    expect(screen.queryByRole("button", { name: /الترجمة/ })).not.toBeInTheDocument();
  });

  it("frame-step buttons pause and seek by ±1/25 of a second", () => {
    const { ref } = renderPlayer();
    loadMetadata(ref.current!, 60);
    ref.current!.currentTime = 10;

    fireEvent.click(screen.getByRole("button", { name: "إطار تالٍ (.)" }));
    expect(pauseSpy).toHaveBeenCalled();
    expect(ref.current!.currentTime).toBeCloseTo(10 + 1 / 25, 5);

    pauseSpy.mockClear();
    const afterForward = ref.current!.currentTime;
    fireEvent.click(screen.getByRole("button", { name: "إطار سابق (,)" }));
    expect(pauseSpy).toHaveBeenCalled();
    expect(ref.current!.currentTime).toBeCloseTo(afterForward - 1 / 25, 5);
  });

  it("frame-step keyboard shortcuts , and . pause and seek by ±1/25", () => {
    const { ref } = renderPlayer();
    loadMetadata(ref.current!, 60);
    ref.current!.currentTime = 5;
    const region = screen.getByRole("region", { name: "مشغل الفيديو" });

    fireEvent.keyDown(region, { key: "." });
    expect(pauseSpy).toHaveBeenCalled();
    expect(ref.current!.currentTime).toBeCloseTo(5 + 1 / 25, 5);

    pauseSpy.mockClear();
    fireEvent.keyDown(region, { key: "," });
    expect(pauseSpy).toHaveBeenCalled();
    expect(ref.current!.currentTime).toBeCloseTo(5, 5);
  });

  it("keyboard i/o sets mark in/out and fires onMarkChange", () => {
    const onMarkChange = vi.fn();
    const { ref } = renderPlayer({ onMarkChange });
    loadMetadata(ref.current!, 120);
    ref.current!.currentTime = 30;
    const region = screen.getByRole("region", { name: "مشغل الفيديو" });

    fireEvent.keyDown(region, { key: "i" });
    expect(onMarkChange).toHaveBeenLastCalledWith({ markIn: 30, markOut: null });

    ref.current!.currentTime = 90;
    fireEvent.keyDown(region, { key: "o" });
    expect(onMarkChange).toHaveBeenLastCalledWith({ markIn: 30, markOut: 90 });
  });

  it("add-to-project button is hidden when onAddToProject prop is not provided", () => {
    renderPlayer();
    expect(screen.queryByRole("button", { name: "أضف لمشروع" })).not.toBeInTheDocument();
  });

  it("add-to-project button fires callback with current mark in/out", () => {
    const onAddToProject = vi.fn();
    const { ref } = renderPlayer({ onAddToProject });
    loadMetadata(ref.current!, 60);
    ref.current!.currentTime = 15;
    const region = screen.getByRole("region", { name: "مشغل الفيديو" });
    fireEvent.keyDown(region, { key: "i" });

    fireEvent.click(screen.getByRole("button", { name: "أضف لمشروع" }));
    expect(onAddToProject).toHaveBeenCalledTimes(1);
    expect(onAddToProject).toHaveBeenCalledWith({ markIn: 15, markOut: null });
  });
});
