"use client";

import { useCallback, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";

// Browsers cannot play file:// media in local mode, so playback always streams
// through the authenticated Laravel endpoint with Range support.
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

function streamSrc(path: string, disk?: string): string {
  const params = new URLSearchParams({ path });

  if (disk) {
    params.set("disk", disk);
  }

  return `/api/v1/files/stream?${params.toString()}`;
}

function isAudioPath(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(ext);
}

export interface MediaPlayerProps {
  /** Archive-relative file path, as returned by the files browser. */
  path: string;
  /** Optional Laravel filesystem disk when the path belongs to a configured disk. */
  disk?: string;
  title?: string;
  /** Receives the media element so callers can seek (e.g. from review comments). */
  onReady?: (el: HTMLMediaElement) => void;
  onTimeUpdate?: (el: HTMLMediaElement) => void;
  onPlayPause?: (el: HTMLMediaElement) => void;
}

export default function MediaPlayer({ path, disk, title, onReady, onTimeUpdate, onPlayPause }: MediaPlayerProps) {
  const [error, setError] = useState<string | null>(null);
  const src = useMemo(() => streamSrc(path, disk), [disk, path]);
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

  const handleTimeUpdate = useCallback((event: SyntheticEvent<HTMLMediaElement>) => {
    onTimeUpdate?.(event.currentTarget);
  }, [onTimeUpdate]);

  const handlePlayPause = useCallback((event: SyntheticEvent<HTMLMediaElement>) => {
    onPlayPause?.(event.currentTarget);
  }, [onPlayPause]);

  if (!path) {
    return <p className="media-player__empty">لا توجد مادة محدّدة للتشغيل.</p>;
  }

  return (
    <figure className="media-player">
      {title ? (
        <figcaption className="media-player__caption">{title}</figcaption>
      ) : null}

      {error ? (
        <p className="form-status status-error" role="alert">
          {error}
        </p>
      ) : audio ? (
        <audio
          ref={setRef}
          src={src}
          controls
          preload="metadata"
          onError={handleError}
          onPause={handlePlayPause}
          onPlay={handlePlayPause}
          onTimeUpdate={handleTimeUpdate}
        />
      ) : (
        <video
          ref={setRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          onError={handleError}
          onPause={handlePlayPause}
          onPlay={handlePlayPause}
          onTimeUpdate={handleTimeUpdate}
        />
      )}
    </figure>
  );
}
