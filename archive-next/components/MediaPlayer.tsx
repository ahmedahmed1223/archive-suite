"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, SyntheticEvent } from "react";
import { formatCueTime, getActiveCue, parseSubtitles } from "@/lib/media/subtitles";
import { downsamplePeaks, peaksToBars, placeholderPeaks } from "@/lib/media/waveform";

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

const WAVEFORM_BUCKETS = 96;
const WAVEFORM_HEIGHT = 44;

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

function useAudioWaveform(src: string, enabled: boolean): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPeaks(null);
      return;
    }

    const audioGlobal = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = audioGlobal.AudioContext || audioGlobal.webkitAudioContext;
    if (!AudioContextCtor) return;

    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(src, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;

        const buffer = await response.arrayBuffer();
        if (controller.signal.aborted) return;

        const context = new AudioContextCtor();
        try {
          const decoded = await context.decodeAudioData(buffer);
          const computed = downsamplePeaks(decoded.getChannelData(0), WAVEFORM_BUCKETS);
          if (!controller.signal.aborted) setPeaks(computed);
        } finally {
          await context.close();
        }
      } catch {
        if (!controller.signal.aborted) setPeaks(null);
      }
    })();

    return () => controller.abort();
  }, [enabled, src]);

  return peaks;
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
  /** Optional deep-link position, applied once after media metadata is ready. */
  initialTime?: number;
  showTimeline?: boolean;
  transcriptText?: string;
}

export default function MediaPlayer({
  path,
  disk,
  title,
  onReady,
  onTimeUpdate,
  onPlayPause,
  initialTime,
  showTimeline = false,
  transcriptText,
}: MediaPlayerProps) {
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const hasAppliedInitialTime = useRef(false);
  const src = useMemo(() => streamSrc(path, disk), [disk, path]);
  const audio = useMemo(() => isAudioPath(path), [path]);
  const cues = useMemo(() => parseSubtitles(transcriptText), [transcriptText]);
  const activeCue = useMemo(() => getActiveCue(cues, currentTime), [cues, currentTime]);
  const decodedPeaks = useAudioWaveform(src, showTimeline && audio);
  const timelineDuration = duration || cues.at(-1)?.end || 0;
  const progressRatio = timelineDuration > 0 ? Math.min(1, Math.max(0, currentTime / timelineDuration)) : 0;
  const bars = useMemo(
    () => peaksToBars(decodedPeaks ?? placeholderPeaks({ id: src, outSec: timelineDuration }, WAVEFORM_BUCKETS), WAVEFORM_HEIGHT),
    [decodedPeaks, src, timelineDuration],
  );

  const setRef = useCallback(
    (el: HTMLMediaElement | null) => {
      mediaRef.current = el;
      if (el && onReady) onReady(el);
    },
    [onReady],
  );

  const handleError = useCallback(() => {
    setError("تعذّر تشغيل هذه المادة — تحقّق من المسار أو أن الصيغة مدعومة في المتصفح.");
  }, []);

  const handleLoadedMetadata = useCallback((event: SyntheticEvent<HTMLMediaElement>) => {
    const element = event.currentTarget;
    const nextDuration = Number(element.duration);
    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);

    const seekTime = typeof initialTime === "number" && Number.isFinite(initialTime) && initialTime >= 0
      ? initialTime
      : null;

    if (!hasAppliedInitialTime.current && seekTime !== null) {
      hasAppliedInitialTime.current = true;
      element.currentTime = seekTime;
      setCurrentTime(seekTime);
      element.focus({ preventScroll: true });
    }
  }, [initialTime]);

  const handleTimeUpdate = useCallback((event: SyntheticEvent<HTMLMediaElement>) => {
    const element = event.currentTarget;
    setCurrentTime(element.currentTime);
    onTimeUpdate?.(element);
  }, [onTimeUpdate]);

  const handlePlayPause = useCallback((event: SyntheticEvent<HTMLMediaElement>) => {
    onPlayPause?.(event.currentTarget);
  }, [onPlayPause]);

  const seekTo = useCallback((seconds: number) => {
    const element = mediaRef.current;
    if (!element) return;
    element.currentTime = Math.max(0, seconds);
    setCurrentTime(element.currentTime);
  }, []);

  const handleWaveformClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    if (timelineDuration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    seekTo(ratio * timelineDuration);
  }, [seekTo, timelineDuration]);

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
          tabIndex={-1}
          preload="metadata"
          onError={handleError}
          onLoadedMetadata={handleLoadedMetadata}
          onPause={handlePlayPause}
          onPlay={handlePlayPause}
          onTimeUpdate={handleTimeUpdate}
        />
      ) : (
        <video
          ref={setRef}
          src={src}
          controls
          tabIndex={-1}
          playsInline
          preload="metadata"
          onError={handleError}
          onLoadedMetadata={handleLoadedMetadata}
          onPause={handlePlayPause}
          onPlay={handlePlayPause}
          onTimeUpdate={handleTimeUpdate}
        />
      )}

      {showTimeline && !error ? (
        <div className="media-player__timeline" dir="ltr">
          <button
            type="button"
            className="media-player__waveform"
            onClick={handleWaveformClick}
            aria-label="خط زمن الوسائط"
          >
            {bars.map((height, index) => {
              const active = bars.length > 1 ? index / (bars.length - 1) <= progressRatio : false;
              return (
                <span
                  key={`${index}-${height.toFixed(2)}`}
                  className={active ? "is-active" : undefined}
                  style={{ blockSize: `${height}px` }}
                />
              );
            })}
          </button>
          <div className="media-player__time-row">
            <span>{formatCueTime(currentTime)}</span>
            <span>{formatCueTime(timelineDuration)}</span>
          </div>
          {activeCue ? (
            <p className="media-player__active-cue" dir="auto">
              {activeCue.text}
            </p>
          ) : null}
        </div>
      ) : null}

      {cues.length > 0 ? (
        <ol className="media-player__transcript">
          {cues.map((cue) => (
            <li key={`${cue.index}-${cue.start}`}>
              <button
                type="button"
                className={activeCue?.index === cue.index ? "is-active" : undefined}
                onClick={() => seekTo(cue.start)}
              >
                <span dir="ltr">{formatCueTime(cue.start)}</span>
                <span dir="auto">{cue.text}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </figure>
  );
}
