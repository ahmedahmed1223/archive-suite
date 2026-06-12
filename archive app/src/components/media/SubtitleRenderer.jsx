/**
 * SubtitleRenderer — overlays the active subtitle cue on top of a video,
 * driven by the parent's tracked playback time (§13.1). Presentational and
 * pure: given cues + currentTime it shows the matching cue, nothing else.
 *
 * Designed to be dropped into an existing video container (position: relative)
 * without owning the <video> element, so it composes with the current player.
 */
import { getActiveCue } from "../../features/media/subtitleParser.js";

const SIZE_CLASS = {
  sm: "text-sm sm:text-base",
  md: "text-base sm:text-lg",
  lg: "text-lg sm:text-2xl",
};

export function SubtitleRenderer({ cues, currentTime, size = "md", color = "#ffffff", enabled = true }) {
  if (!enabled || !Array.isArray(cues) || cues.length === 0) return null;
  const active = getActiveCue(cues, currentTime);
  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[7%]"
      aria-live="polite"
    >
      <p
        className={`max-w-[90%] whitespace-pre-wrap rounded-md bg-black/60 px-3 py-1.5 text-center font-semibold leading-snug shadow-lg ${SIZE_CLASS[size] || SIZE_CLASS.md}`}
        dir="auto"
        style={{ color, textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
      >
        {active.text}
      </p>
    </div>
  );
}

export default SubtitleRenderer;
