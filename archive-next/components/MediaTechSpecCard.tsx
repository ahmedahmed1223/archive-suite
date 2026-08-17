"use client";

import { formatCueTime } from "@/lib/media/subtitles";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface MediaTechSpec {
  widthPx: number | null;
  heightPx: number | null;
  aspectRatio: string | null;
  durationSeconds: number | null;
  estimatedBitrateBps: number | null;
}

const EMPTY_SPEC: MediaTechSpec = {
  widthPx: null,
  heightPx: null,
  aspectRatio: null,
  durationSeconds: null,
  estimatedBitrateBps: null
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function computeAspectRatio(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const divisor = gcd(Math.round(width), Math.round(height));
  if (divisor <= 0) return null;
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

/**
 * Reads only what the browser genuinely measured off the loaded media
 * element, plus the file size the studio already fetched for the attachment
 * (no extra network call) -- never ffprobe, never a guess dressed up as a
 * fact. Codec is intentionally absent: no standard DOM API exposes the
 * decoded codec of an arbitrary <video>/<audio> element, so showing one here
 * would mean fabricating it.
 */
export function computeMediaTechSpec(
  element: Pick<HTMLMediaElement, "duration"> & Partial<Pick<HTMLVideoElement, "videoWidth" | "videoHeight">> | null,
  knownSizeBytes?: number | null
): MediaTechSpec {
  if (!element) return EMPTY_SPEC;

  const duration = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : null;
  const width = element.videoWidth ?? 0;
  const height = element.videoHeight ?? 0;
  const hasDimensions = width > 0 && height > 0;

  const bitrate = duration && knownSizeBytes && knownSizeBytes > 0
    ? Math.round((knownSizeBytes * 8) / duration)
    : null;

  return {
    widthPx: hasDimensions ? width : null,
    heightPx: hasDimensions ? height : null,
    aspectRatio: hasDimensions ? computeAspectRatio(width, height) : null,
    durationSeconds: duration,
    estimatedBitrateBps: bitrate
  };
}

function formatBitrate(bitsPerSecond: number): string {
  if (bitsPerSecond >= 1_000_000) return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.max(1, Math.round(bitsPerSecond / 1000))} kbps`;
}

export default function MediaTechSpecCard({ spec }: Readonly<{ spec: MediaTechSpec }>) {
  const { t } = useLocale();
  const copy = t.pages.mediaStudio.techSpec;
  const hasAny = Boolean(spec.widthPx || spec.durationSeconds || spec.estimatedBitrateBps);

  return (
    <article className="panel" aria-label={copy.title}>
      <h2>{copy.title}</h2>
      {hasAny ? (
        <div className="kv-grid">
          {spec.widthPx && spec.heightPx ? (
            <div>
              <strong>{copy.dimensionsLabel}</strong>
              <span dir="ltr">{spec.widthPx}×{spec.heightPx}</span>
            </div>
          ) : null}
          {spec.aspectRatio ? (
            <div>
              <strong>{copy.aspectRatioLabel}</strong>
              <span dir="ltr">{spec.aspectRatio}</span>
            </div>
          ) : null}
          {spec.durationSeconds ? (
            <div>
              <strong>{copy.durationLabel}</strong>
              <span dir="ltr">{formatCueTime(spec.durationSeconds)}</span>
            </div>
          ) : null}
          {spec.estimatedBitrateBps ? (
            <div>
              <strong>{copy.bitrateLabel}</strong>
              <span dir="ltr">{formatBitrate(spec.estimatedBitrateBps)} <span className="badge">{copy.estimatedBadge}</span></span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="helper-text">{copy.unavailable}</p>
      )}
    </article>
  );
}
