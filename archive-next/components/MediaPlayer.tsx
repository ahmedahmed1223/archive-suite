"use client";

import { useCallback, useMemo, useState } from "react";

// ponytail: the browser cannot play file:// media in local mode, so we always
// stream over the authenticated Laravel endpoint (Range-capable). Same-origin
// through the Next proxy means the httpOnly session cookie rides along.
const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "opus",
  "weba",
]);

function streamSrc(path: string): string {
  return `/api/v1/files/stream?path=${encodeURIComponent(path)}`;
}

function isAudioPath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(ext);
}

export interface MediaPlayerProps {
  /** Archive-relative file path, as returned by the files browser. */
  path: string;
  title?: string;
  /** Receives the media element so callers can seek (e.g. from review comments). */
  onReady?: (el: HTMLMediaElement) => void;
}

export default function MediaPlayer({ path, title, onReady }: MediaPlayerProps) {
  const [error, setError] = useState<string | null>(null);
  const src = useMemo(() => streamSrc(path), [path]);
  const audio = useMemo(() => isAudioPath(path), [path]);

  const setRef = useCallback(
    (el: HTMLMediaElement | null) => {
      if (el && onReady) onReady(el);
    },
    [onReady],
  );

  const handleError = useCallback(() => {
    setError("تعذّر تشغيل هذه المادة — تحقّق من المسار أو أن الصيغة مدعومة في المتصفح.");
  }, []);

  if (!path) {
    return <p className="media-player__empty">لا توجد مادة محدّدة للتشغيل.</p>;
  }

  return (
    <figure className="media-player" style={{ margin: 0 }}>
      {title ? (
        <figcaption style={{ marginBlockEnd: 8, fontWeight: 600 }}>{title}</figcaption>
      ) : null}

      {error ? (
        <p role="alert" style={{ color: "crimson", margin: 0 }}>
          {error}
        </p>
      ) : audio ? (
        <audio
          ref={setRef}
          src={src}
          controls
          preload="metadata"
          onError={handleError}
          style={{ width: "100%" }}
        />
      ) : (
        <video
          ref={setRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          onError={handleError}
          style={{ width: "100%", borderRadius: 12, background: "#000", maxBlockSize: "70vh" }}
        />
      )}
    </figure>
  );
}
