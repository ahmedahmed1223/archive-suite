/**
 * useAudioWaveform — decode audio from a media URL and return normalized peaks.
 *
 * ponytail: browser-only glue; all pure logic lives in features/montage/waveform.ts.
 * No unit test here — jsdom has no real AudioContext. The try/catch guards every
 * failure path (CORS, file://, decode error, no AudioContext) so callers get null
 * on any failure and can fall back to a placeholder.
 */
import { useEffect, useRef, useState } from "react";
import { downsamplePeaks } from "../montage/waveform.js";

const BUCKETS = 120; // one bar per ~8 px on a 960 px scrubber

// ponytail: simple src→peaks map; cleared on unmount. Good enough for one player instance.
const cache = new Map<string, number[]>();

export function useAudioWaveform(src: string | undefined): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(() =>
    src ? (cache.get(src) ?? null) : null,
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!src) {
      setPeaks(null);
      return;
    }

    const cached = cache.get(src);
    if (cached) {
      setPeaks(cached);
      return;
    }

    const globals = globalThis as any;
    const AudioCtx = globals.AudioContext || globals.webkitAudioContext;
    if (!AudioCtx) return; // browser doesn't support Web Audio

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch(src, { signal: controller.signal });
        if (!res.ok) return;
        const buf = await res.arrayBuffer();
        if (controller.signal.aborted) return;

        const ctx = new AudioCtx();
        try {
          const decoded = await ctx.decodeAudioData(buf);
          const channelData = decoded.getChannelData(0);
          const computed = downsamplePeaks(channelData, BUCKETS);
          cache.set(src, computed);
          if (!controller.signal.aborted) setPeaks(computed);
        } finally {
          ctx.close().catch(() => {});
        }
      } catch {
        // CORS, abort, or decode failure — degrade silently
      }
    })();

    return () => {
      controller.abort();
      abortRef.current = null;
    };
  }, [src]);

  return peaks;
}
