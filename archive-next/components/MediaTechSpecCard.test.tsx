// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MediaTechSpecCard, { computeMediaTechSpec } from "./MediaTechSpecCard";

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");
  return {
    useLocale: () => ({ locale: "ar", direction: "rtl", t: getDictionary("ar"), setLocale: vi.fn() })
  };
});

afterEach(() => cleanup());

describe("computeMediaTechSpec", () => {
  it("reads dimensions, aspect ratio, and duration straight off the media element", () => {
    const spec = computeMediaTechSpec({ duration: 125, videoWidth: 1920, videoHeight: 1080 });
    expect(spec.widthPx).toBe(1920);
    expect(spec.heightPx).toBe(1080);
    expect(spec.aspectRatio).toBe("16:9");
    expect(spec.durationSeconds).toBe(125);
  });

  it("estimates bitrate from a known file size and the measured duration", () => {
    const spec = computeMediaTechSpec({ duration: 10 }, 1_250_000);
    // (1,250,000 bytes * 8 bits) / 10s = 1,000,000 bps
    expect(spec.estimatedBitrateBps).toBe(1_000_000);
  });

  it("hides bitrate when the file size is unknown rather than guessing", () => {
    const spec = computeMediaTechSpec({ duration: 10 }, null);
    expect(spec.estimatedBitrateBps).toBeNull();
  });

  it("hides dimensions and aspect ratio for an audio-only element", () => {
    const spec = computeMediaTechSpec({ duration: 42 });
    expect(spec.widthPx).toBeNull();
    expect(spec.heightPx).toBeNull();
    expect(spec.aspectRatio).toBeNull();
    expect(spec.durationSeconds).toBe(42);
  });

  it("returns an empty spec before metadata has loaded", () => {
    expect(computeMediaTechSpec(null)).toEqual({
      widthPx: null,
      heightPx: null,
      aspectRatio: null,
      durationSeconds: null,
      estimatedBitrateBps: null
    });
  });

  it("never reports codec: no field for it exists on the computed spec", () => {
    const spec = computeMediaTechSpec({ duration: 10, videoWidth: 640, videoHeight: 480 });
    expect(spec).not.toHaveProperty("codec");
  });
});

describe("MediaTechSpecCard", () => {
  it("renders only the fields that were actually measured", () => {
    render(
      <MediaTechSpecCard
        spec={{ widthPx: 1280, heightPx: 720, aspectRatio: "16:9", durationSeconds: 65, estimatedBitrateBps: null }}
      />
    );

    expect(screen.getByText("1280×720")).toBeTruthy();
    expect(screen.getByText("16:9")).toBeTruthy();
    expect(screen.queryByText(/kbps|Mbps/)).toBeNull();
  });

  it("shows the unavailable message when nothing has been measured yet", () => {
    render(
      <MediaTechSpecCard
        spec={{ widthPx: null, heightPx: null, aspectRatio: null, durationSeconds: null, estimatedBitrateBps: null }}
      />
    );

    expect(screen.getByText("شغّل الملف لقياس مواصفاته التقنية.")).toBeTruthy();
  });

  it("labels an estimated bitrate as an estimate", () => {
    render(
      <MediaTechSpecCard
        spec={{ widthPx: null, heightPx: null, aspectRatio: null, durationSeconds: 10, estimatedBitrateBps: 1_000_000 }}
      />
    );

    expect(screen.getByText("تقديري")).toBeTruthy();
  });
});
