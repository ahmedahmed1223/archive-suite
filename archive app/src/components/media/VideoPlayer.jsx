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
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { secondsToClock } from "../../features/media/viewModel.js";
import { SubtitleRenderer } from "./SubtitleRenderer.jsx";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const SEEK_STEP = 5;
const VOLUME_STEP = 0.1;

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
}) {
  const internalRef = useRef(null);
  const ref = videoRef || internalRef;
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);

  const hasSubtitles = Array.isArray(cues) && cues.length > 0;
  const pipSupported =
    typeof document !== "undefined" && document.pictureInPictureEnabled;

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const togglePlay = useCallback(() => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, [ref]);

  const seekBy = useCallback((delta) => {
    const video = ref.current;
    if (!video) return;
    const next = Math.min(duration || video.duration || 0, Math.max(0, video.currentTime + delta));
    video.currentTime = next;
  }, [ref, duration]);

  const setVideoVolume = useCallback((value) => {
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

  const changeRate = useCallback((value) => {
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
    else node.requestFullscreen?.().catch(() => {});
  }, []);

  const handleKeyDown = useCallback((event) => {
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
      case "c":
        if (hasSubtitles) {
          event.preventDefault();
          onToggleSubtitles?.();
        }
        break;
      default:
        break;
    }
  }, [togglePlay, seekBy, setVideoVolume, toggleFullscreen, toggleMute, hasSubtitles, onToggleSubtitles, ref]);

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
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onRateChange={(e) => setRate(e.currentTarget.playbackRate)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          onLoadedMetadata?.(e);
        }}
        onTimeUpdate={(e) => {
          setCurrent(e.currentTarget.currentTime || 0);
          onTimeUpdate?.(e);
        }}
        onSeeked={(e) => {
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
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="any"
          value={Math.min(current, duration || 0)}
          onChange={(e) => {
            const video = ref.current;
            if (video) video.currentTime = Number(e.target.value);
          }}
          aria-label="شريط التقدم"
          className="h-1.5 w-full cursor-pointer accent-[var(--va-action)]"
        />
        <div className="flex items-center gap-2 text-white">
          <button type="button" onClick={togglePlay} aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل"} className="rounded-md p-1.5 hover:bg-white/15">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
            onChange={(e) => setVideoVolume(Number(e.target.value))}
            aria-label="مستوى الصوت"
            className="hidden h-1 w-20 cursor-pointer accent-[var(--va-action)] sm:block"
          />
          <span className="font-mono text-xs tabular-nums text-gray-200">
            {secondsToClock(current)} / {secondsToClock(duration)}
          </span>

          <div className="relative ms-auto flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeed((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showSpeed}
                className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-white/15"
              >
                {rate}×
              </button>
              {showSpeed && (
                <div role="menu" className="absolute bottom-9 left-0 z-20 w-20 overflow-hidden rounded-lg border border-white/15 bg-gray-950/95 py-1 shadow-xl">
                  {SPEEDS.map((speed) => (
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
