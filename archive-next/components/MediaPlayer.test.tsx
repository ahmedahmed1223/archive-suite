// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MediaPlayer from "./MediaPlayer";

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return {
    useLocale: () => ({ locale: "ar", direction: "rtl", t: getDictionary("ar"), setLocale: vi.fn() }),
  };
});

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
