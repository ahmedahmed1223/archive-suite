// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MediaPlayer from "./MediaPlayer";

describe("MediaPlayer", () => {
  it("seeks and focuses the media element after metadata loads for a deep link", () => {
    const { container } = render(<MediaPlayer path="video/oral-history.mp4" initialTime={83} />);
    const video = container.querySelector("video");

    expect(video).not.toBeNull();
    fireEvent.loadedMetadata(video as HTMLVideoElement);

    expect((video as HTMLVideoElement).currentTime).toBe(83);
    expect(document.activeElement).toBe(video);
  });
});
