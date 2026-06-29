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
});
