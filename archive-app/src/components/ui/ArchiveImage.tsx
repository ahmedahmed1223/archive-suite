/**
 * ArchiveImage — thin wrapper around <img> that enforces:
 *   - explicit width/height (prevents layout shift / CLS)
 *   - loading="lazy" by default; pass loading="eager" + fetchPriority="high"
 *     for above-the-fold / hero images only
 *   - optional srcSet/sizes for when the server exposes multiple size variants
 *   - decoding="async" to keep the main thread unblocked
 *   - graceful error fallback (marks the element; callers can style it)
 *   - CSS logical properties (no hard-coded left/right; RTL-safe)
 *
 * ponytail: srcSet is wired but the server currently produces only one size
 * (640px via /api/media/thumbnail). Pass srcSet when multiple variants exist;
 * omit it (the default) for now — the loading/width/height wins alone cover CLS.
 */
import * as React from "react";

export interface ArchiveImageProps {
  /** Image URL (required). */
  src: string;
  /** Alt text. Empty string for decorative images. */
  alt: string;
  /** Intrinsic width in CSS pixels — required to prevent layout shift. */
  width: number;
  /** Intrinsic height in CSS pixels — required to prevent layout shift. */
  height: number;
  /** Responsive srcset string, e.g. "img-320.jpg 320w, img-640.jpg 640w". */
  srcSet?: string;
  /** Sizes hint, e.g. "(max-width:600px) 320px, 640px". */
  sizes?: string;
  /**
   * "lazy" (default) for off-screen images; "eager" for above-the-fold hero.
   * Pair eager with fetchPriority="high".
   */
  loading?: "lazy" | "eager";
  /** "high" for hero/LCP image; omit for everything else. */
  fetchPriority?: "high" | "low" | "auto";
  /** Tailwind / CSS classes forwarded to the <img> element. */
  className?: string;
  /** Inline styles (avoid where design tokens cover it). */
  style?: React.CSSProperties;
}

export function ArchiveImage({
  src,
  alt,
  width,
  height,
  srcSet,
  sizes,
  loading = "lazy",
  fetchPriority,
  className = "",
  style,
}: ArchiveImageProps) {
  const handleError = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      // Mark as errored so callers/CSS can style the broken state.
      img.setAttribute("data-errored", "true");
      // Replace src with a transparent 1×1 so the browser stops retrying
      // and no broken-image icon is shown.
      // ponytail: data-uri placeholder; upgrade to a branded SVG sprite if
      // design system adds one.
      img.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    },
    []
  );

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      srcSet={srcSet}
      sizes={sizes}
      loading={loading}
      // fetchpriority is lowercase in HTML; React maps the camelCase prop.
      fetchPriority={fetchPriority}
      decoding="async"
      className={className}
      style={style}
      onError={handleError}
    />
  );
}
