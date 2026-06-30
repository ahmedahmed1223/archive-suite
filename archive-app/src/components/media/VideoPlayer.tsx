/**
 * VideoPlayer — a custom-chrome video player (§13.1, phase 2). Wraps a <video>
 * with: play/pause, a seek scrubber, volume + mute, playback speed (0.5x–2x),
 * Picture-in-Picture, fullscreen, keyboard shortcuts, and a subtitle overlay.
 *
 * It forwards the parent's `videoRef`, so existing features that read the video
 * element directly (time bookmarks, transcript seek) keep working. Lifecycle
 * callbacks (onTimeUpdate, onLoadedMetadata, …) are chained through to the
 * parent in addition to the player's own internal state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Captions,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { secondsToClock } from "../../features/media/viewModel.js";
import { previewPercentFromPointer, previewTimeFromPointer } from "../../features/media/scrubberPreview.js";
import { useAudioWaveform } from "../../features/media/useAudioWaveform.js";
import { peaksToBars, placeholderPeaks } from "../../features/montage/waveform.js";
import { SubtitleRenderer } from "./SubtitleRenderer.jsx";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SEEK_STEP = 5;
const WAVEFORM_H = 28; // px — height of the waveform strip

/** Pure SVG waveform strip. Bars are centred; played portion is brighter. */
function WaveformStrip({ peaks, currentRatio }: { peaks: number[]; currentRatio: number }) {
  const bars = peaksToBars(peaks, WAVEFORM_H);
  const n = bars.length;
  if (n === 0) return null;
  const w = 100; // viewBox width; scaled by CSS to fill parent
  const barW = w / n;
  const playedIdx = Math.round(currentRatio * n);

  return (
    <svg
      viewBox={`0 0 ${w} ${WAVEFORM_H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: WAVEFORM_H, display: "block" }}
      aria-hidden="true"
    >
      {bars.map((h, i) => {
        const x = i * barW + barW * 0.15;
        const bw = barW * 0.7;
        const y = (WAVEFORM_H - h) / 2;
        const played = i < playedIdx;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={bw}
            height={h}
            rx={bw / 2}
            fill={played ? "var(--va-action, #60a5fa)" : "rgba(255,255,255,0.25)"}
          />
        );
      })}
    </svg>
  );
}
const VOLUME_STEP = 0.1;
const PREVIEW_W = 160;
const PREVIEW_H = 90;

export function VideoPlayer({
  videoRef,
  src,
  cues = [],
  subtitlesOn = true,
  onToggleSubtitles,
  captionSize = "md",
  captionColor = "#ffffff",
  onCanPlay,
  onLoadedMetadata,
  onLoadStart,
  onTimeUpdate,
  onSeeked,
  onError,
  loading = false,
  loadingOverlay = null,
  fps = 25,
  onMarkChange,
  onAddToProject,
}: any) {
  const internalRef = useRef(null);
  const ref = videoRef || internalRef;
  const containerRef = useRef(null);
  const scrubberRef = useRef(null);
  const previewVideoRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const previewSeekRaf = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const [preview, setPreview] = useState(null); // { time, percent } while hovering the scrubber
  const [markIn, setMarkIn] = useState<number | null>(null);
  const [markOut, setMarkOut] = useState<number | null>(null);

  const decodedPeaks = useAudioWaveform(src);
  // Use decoded peaks when available; fall back to deterministic placeholder so the
  // strip always renders something (placeholder is seeded from src so it's stable).
  const waveformPeaks = decodedPeaks ?? placeholderPeaks({ id: src ?? "" }, 120);

  const hasSubtitles = Array.isArray(cues) && cues.length > 0;
  const pipSupported =
    typeof document !== "undefined" && document.pictureInPictureEnabled;
  const canPreview = Boolean(src) && duration > 0;

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => () => cancelAnimationFrame(previewSeekRaf.current), []);

  const drawPreviewFrame = useCallback(() => {
    const video = previewVideoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas) return;
    try {
      const ctx = (canvas as any).getContext("2d");
      if (ctx) ctx.drawImage(video, 0, 0, (canvas as any).width, (canvas as any).height);
    } catch {
      /* frame not decodable yet — leave the previous thumbnail */
    }
  }, []);

  const updatePreview = useCallback((clientX: any) => {
    const node = scrubberRef.current;
    if (!node || duration <= 0) return;
    const rect = (node as any).getBoundingClientRect();
    const time = previewTimeFromPointer({ clientX, rect, duration });
    const halfWidthPercent = rect.width ? (PREVIEW_W / 2 / rect.width) * 100 : 0;
    const percent = previewPercentFromPointer({ clientX, rect, marginPercent: halfWidthPercent });
    setPreview({ time, percent } as any);
    const previewVideo = previewVideoRef.current;
    if (previewVideo && Number.isFinite(time)) {
      cancelAnimationFrame(previewSeekRaf.current);
      previewSeekRaf.current = requestAnimationFrame(() => {
        try {
          (previewVideo as any).currentTime = time;
        } catch {
          /* not seekable yet */
        }
      });
    }
  }, [duration]);

  const clearPreview = useCallback(() => {
    cancelAnimationFrame(previewSeekRaf.current);
    setPreview(null);
  }, []);

  const togglePlay = useCallback(() => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, [ref]);

  const seekBy = useCallback((delta: any) => {
    const video = ref.current;
    if (!video) return;
    const next = Math.min(duration || video.duration || 0, Math.max(0, video.currentTime + delta));
    video.currentTime = next;
  }, [ref, duration]);

  const setVideoVolume = useCallback((value: any) => {
    const video = ref.current;
    if (!video) return;
    const clamped = Math.min(1, Math.max(0, value));
    video.volume = clamped;
    video.muted = clamped === 0;
  }, [ref]);

  const toggleMute = useCallback(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = !video.muted;
  }, [ref]);

  const changeRate = useCallback((value: any) => {
    const video = ref.current;
    if (video) video.playbackRate = value;
    setShowSpeed(false);
  }, [ref]);

  const togglePiP = useCallback(async () => {
    const video = ref.current;
    if (!video || !pipSupported) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* user gesture / not allowed — ignore */
    }
  }, [ref, pipSupported]);

  const toggleFullscreen = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else (node as any).requestFullscreen?.().catch(() => {});
  }, []);

  const frameStep = useCallback((direction: 1 | -1) => {
    const video = ref.current;
    if (!video) return;
    video.pause();
    const step = direction / (fps || 25);
    const next = Math.min(video.duration || 0, Math.max(0, video.currentTime + step));
    video.currentTime = next;
  }, [ref, fps]);

  const setMarkInNow = useCallback(() => {
    const video = ref.current;
    if (!video) return;
    const t = video.currentTime;
    setMarkIn(t);
    onMarkChange?.({ markIn: t, markOut });
  }, [ref, markOut, onMarkChange]);

  const setMarkOutNow = useCallback(() => {
    const video = ref.current;
    if (!video) return;
    const t = video.currentTime;
    setMarkOut(t);
    onMarkChange?.({ markIn, markOut: t });
  }, [ref, markIn, onMarkChange]);

  const handleKeyDown = useCallback((event: any) => {
    // Ignore when typing into an input/textarea inside the container.
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
    switch (event.key) {
      case " ":
      case "k":
        event.preventDefault();
        togglePlay();
        break;
      case "ArrowRight":
        event.preventDefault();
        seekBy(SEEK_STEP);
        break;
      case "ArrowLeft":
        event.preventDefault();
        seekBy(-SEEK_STEP);
        break;
      case "ArrowUp":
        event.preventDefault();
        setVideoVolume((ref.current?.volume ?? 1) + VOLUME_STEP);
        break;
      case "ArrowDown":
        event.preventDefault();
        setVideoVolume((ref.current?.volume ?? 1) - VOLUME_STEP);
        break;
      case "f":
        event.preventDefault();
        toggleFullscreen();
        break;
      case "m":
        event.preventDefault();
        toggleMute();
        break;
      case ",":
        event.preventDefault();
        frameStep(-1);
        break;
      case ".":
        event.preventDefault();
        frameStep(1);
        break;
      case "i":
        event.preventDefault();
        setMarkInNow();
        break;
      case "o":
        event.preventDefault();
        setMarkOutNow();
        break;
      case "c":
        if (hasSubtitles) {
          event.preventDefault();
          onToggleSubtitles?.();
        }
        break;
      default:
        break;
    }
  }, [togglePlay, seekBy, setVideoVolume, toggleFullscreen, toggleMute, frameStep, setMarkInNow, setMarkOutNow, hasSubtitles, onToggleSubtitles, ref]);

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden bg-black"
      tabIndex={0}
      role="region"
      aria-label="مشغل الفيديو"
      onKeyDown={handleKeyDown}
    >
      <video
        ref={ref}
        src={src}
        className="h-full w-full object-contain"
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onCanPlay={onCanPlay}
        onLoadStart={onLoadStart}
        onDurationChange={(e: any) => setDuration(e.currentTarget.duration || 0)}
        onVolumeChange={(e: any) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onRateChange={(e: any) => setRate(e.currentTarget.playbackRate)}
        onLoadedMetadata={(e: any) => {
          setDuration(e.currentTarget.duration || 0);
          onLoadedMetadata?.(e);
        }}
        onTimeUpdate={(e: any) => {
          setCurrent(e.currentTarget.currentTime || 0);
          onTimeUpdate?.(e);
        }}
        onSeeked={(e: any) => {
          setCurrent(e.currentTarget.currentTime || 0);
          onSeeked?.(e);
        }}
        onError={onError}
      />

      <SubtitleRenderer cues={cues} currentTime={current} enabled={subtitlesOn} size={captionSize} color={captionColor} />

      {loading && loadingOverlay && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
          {loadingOverlay}
        </div>
      )}

      {/* Control bar */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100"
        dir="ltr"
      >
        {/* Mark In/Out labels */}
        {(markIn !== null || markOut !== null) && (
          <div className="flex items-center gap-3 pb-0.5 text-[11px] font-mono text-gray-300" dir="ltr">
            <span className="text-[var(--va-accent-400)]">
              {markIn !== null ? `IN ${secondsToClock(markIn)}` : "IN —"}
            </span>
            <span className="text-[var(--va-accent-200)]">
              {markOut !== null ? `OUT ${secondsToClock(markOut)}` : "OUT —"}
            </span>
          </div>
        )}
        <div
          className="relative"
          onMouseMove={(e: any) => canPreview && updatePreview(e.clientX)}
          onMouseLeave={clearPreview}
        >
          {canPreview && preview && (
            <div
              className="pointer-events-none absolute bottom-5 z-20 -translate-x-1/2 flex flex-col items-center gap-1"
              style={{ left: `${(preview as any).percent}%` }}
              data-testid="scrubber-preview"
              aria-hidden="true"
            >
              <canvas
                ref={previewCanvasRef}
                width={PREVIEW_W}
                height={PREVIEW_H}
                className="rounded-md border border-white/20 bg-black shadow-xl"
                style={{ width: PREVIEW_W, height: PREVIEW_H }}
              />
              <span className="rounded bg-black/80 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-white">
                {secondsToClock((preview as any).time)}
              </span>
            </div>
          )}
          {/* Waveform strip — purely decorative/informational; aria-hidden */}
          <WaveformStrip peaks={waveformPeaks} currentRatio={duration > 0 ? current / duration : 0} />
          <div className="relative w-full">
            <input
              ref={scrubberRef}
              type="range"
              min={0}
              max={duration || 0}
              step="any"
              value={Math.min(current, duration || 0)}
              onChange={(e: any) => {
                const video = ref.current;
                if (video) video.currentTime = Number(e.target.value);
              }}
              aria-label="شريط التقدم"
              className="h-1.5 w-full cursor-pointer accent-[var(--va-action)]"
            />
            {/* Mark In tick */}
            {markIn !== null && duration > 0 && (
              <div
                className="pointer-events-none absolute top-0 h-1.5 w-0.5 bg-[var(--va-accent-400)]"
                style={{ left: `${(markIn / duration) * 100}%` }}
                aria-hidden="true"
                title={`Mark In: ${secondsToClock(markIn)}`}
              />
            )}
            {/* Mark Out tick */}
            {markOut !== null && duration > 0 && (
              <div
                className="pointer-events-none absolute top-0 h-1.5 w-0.5 bg-[var(--va-accent-200)]"
                style={{ left: `${(markOut / duration) * 100}%` }}
                aria-hidden="true"
                title={`Mark Out: ${secondsToClock(markOut)}`}
              />
            )}
          </div>
          {canPreview && (
            <video
              ref={previewVideoRef}
              src={src}
              muted
              preload="metadata"
              crossOrigin="anonymous"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onSeeked={drawPreviewFrame}
              onLoadedData={drawPreviewFrame}
            />
          )}
        </div>
        <div className="flex items-center gap-2 text-white">
          <button type="button" onClick={togglePlay} aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل"} className="rounded-md p-1.5 hover:bg-white/15">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => frameStep(-1)} aria-label="إطار سابق (,)" title="إطار سابق (,)" className="rounded-md p-1.5 hover:bg-white/15">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => frameStep(1)} aria-label="إطار تالٍ (.)" title="إطار تالٍ (.)" className="rounded-md p-1.5 hover:bg-white/15">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted ? "إلغاء الكتم" : "كتم"} className="rounded-md p-1.5 hover:bg-white/15">
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(e: any) => setVideoVolume(Number(e.target.value))}
            aria-label="مستوى الصوت"
            className="hidden h-1 w-20 cursor-pointer accent-[var(--va-action)] sm:block"
          />
          <span className="font-mono text-xs tabular-nums text-gray-200">
            {secondsToClock(current)} / {secondsToClock(duration)}
          </span>

          {onAddToProject && (
            <button
              type="button"
              onClick={() => onAddToProject({ markIn, markOut })}
              aria-label="أضف لمشروع"
              title="أضف لمشروع (Mark In/Out)"
              className="ms-1 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--va-action)] hover:bg-white/15"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">أضف لمشروع</span>
            </button>
          )}
          <div className="relative ms-auto flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeed((v: any) => !v)}
                aria-haspopup="menu"
                aria-expanded={showSpeed}
                className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-white/15"
              >
                {rate}×
              </button>
              {showSpeed && (
                <div role="menu" className="absolute bottom-9 left-0 z-20 w-20 overflow-hidden rounded-lg border border-white/15 bg-gray-950/95 py-1 shadow-xl">
                  {SPEEDS.map((speed: any) => (
                    <button
                      key={speed}
                      type="button"
                      role="menuitemradio"
                      aria-checked={rate === speed}
                      onClick={() => changeRate(speed)}
                      className={`block w-full px-3 py-1 text-right text-xs hover:bg-white/10 ${rate === speed ? "text-[var(--va-action)] font-bold" : "text-gray-200"}`}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
              )}
            </div>
            {hasSubtitles && (
              <button
                type="button"
                onClick={() => onToggleSubtitles?.()}
                aria-pressed={subtitlesOn}
                aria-label={subtitlesOn ? "إخفاء الترجمة" : "إظهار الترجمة"}
                className={`rounded-md p-1.5 hover:bg-white/15 ${subtitlesOn ? "text-[var(--va-action)]" : "text-gray-300"}`}
              >
                <Captions className="h-4 w-4" />
              </button>
            )}
            {pipSupported && (
              <button type="button" onClick={togglePiP} aria-label="صورة داخل صورة" className="rounded-md p-1.5 hover:bg-white/15">
                <PictureInPicture2 className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"} className="rounded-md p-1.5 hover:bg-white/15">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
