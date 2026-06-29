// Pure ffmpeg command builder for MP4 export of a project timeline. No exec
// here — just the argv — so it's fully unit-testable. Each rough cut becomes a
// trimmed input (-ss/-to before -i), then a concat filter stitches them into
// one re-encoded MP4 (re-encode is required to join heterogeneous sources).

export class ExportError extends Error {
  code?: string;
  statusCode?: number;

  constructor(message: string, { code, statusCode }: { code?: string; statusCode?: number } = {}) {
    super(message);
    this.name = "ExportError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface Clip {
  title?: string;
  id?: string;
  sourceIn: number;
  sourceOut: number;
  source?: string;
  itemId?: string;
  duration?: number;
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    look?: string;
  };
  transform?: {
    scale?: number;
    x?: number;
    y?: number;
    rotation?: number;
    opacity?: number;
  };
  volumeDb?: number;
  transition?: {
    type?: string;
    durationSec?: number;
  };
}

interface Timeline {
  clips: Clip[];
}

interface BuildFfmpegArgsOptions {
  resolveSource: (clip: Clip) => string | null;
  output: string;
  withAudio?: boolean;
}

/**
 * Build the ffmpeg argv for a timeline.
 * @param timeline from buildProjectTimeline (clips with sourceIn/out)
 * @param options Configuration options
 * @param options.resolveSource clip → local file path
 * @param options.output output mp4 path
 * @param options.withAudio whether to include audio (default: true)
 * @returns ffmpeg arguments
 * @throws ExportError when the timeline has no usable clips
 */
export function buildFfmpegArgs(timeline: Timeline | undefined, { resolveSource, output, withAudio = true }: BuildFfmpegArgsOptions = {} as BuildFfmpegArgsOptions): string[] {
  const clips = Array.isArray(timeline?.clips) ? timeline.clips : [];
  if (!clips.length) throw new ExportError("لا توجد قصاصات قابلة للتصدير في المشروع.", { code: "EMPTY" });
  if (typeof resolveSource !== "function") throw new ExportError("resolveSource مطلوب.", { code: "NO_RESOLVER" });
  if (!output) throw new ExportError("مسار الإخراج مطلوب.", { code: "NO_OUTPUT" });

  const args: string[] = [];
  clips.forEach((clip) => {
    const src = resolveSource(clip);
    if (!src) throw new ExportError(`تعذّر إيجاد ملف المصدر للقصاصة "${clip.title || clip.id}".`, { code: "SOURCE_MISSING" });
    // Trim each input to its in/out window. -ss/-to before -i is fast + precise
    // enough for cut points; re-encode below makes them frame-accurate.
    args.push("-ss", String(clip.sourceIn), "-to", String(clip.sourceOut), "-i", src);
  });

  if (hasAdvancedEdits(clips)) {
    const fc = buildAdvancedFilterComplex(clips, { withAudio });
    args.push("-filter_complex", fc, "-map", "[v]");
    if (withAudio) args.push("-map", "[a]");
    args.push(
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
      ...(withAudio ? ["-c:a", "aac", "-b:a", "192k"] : []),
      "-movflags", "+faststart",
      "-y", output
    );
    return args;
  }

  // concat filter: [0:v:0][0:a:0][1:v:0][1:a:0]…concat=n=N:v=1:a=1[v][a]
  const n = clips.length;
  let fc = "";
  for (let i = 0; i < n; i += 1) fc += withAudio ? `[${i}:v:0][${i}:a:0]` : `[${i}:v:0]`;
  fc += `concat=n=${n}:v=1:a=${withAudio ? 1 : 0}`;
  fc += withAudio ? "[v][a]" : "[v]";

  args.push("-filter_complex", fc, "-map", "[v]");
  if (withAudio) args.push("-map", "[a]");
  args.push(
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    ...(withAudio ? ["-c:a", "aac", "-b:a", "192k"] : []),
    "-movflags", "+faststart",
    "-y", output
  );
  return args;
}

function hasAdvancedEdits(clips: Clip[]): boolean {
  return clips.some((clip, index) => {
    const filters = clip.filters || {};
    const transform = clip.transform || {};
    const transition = clip.transition || {};
    return num(filters.brightness, 0) !== 0
      || num(filters.contrast, 1) !== 1
      || num(filters.saturation, 1) !== 1
      || filters.look === "mono"
      || num(transform.scale, 1) !== 1
      || num(transform.x, 0) !== 0
      || num(transform.y, 0) !== 0
      || num(transform.rotation, 0) !== 0
      || num(transform.opacity, 1) !== 1
      || num(clip.volumeDb, 0) !== 0
      || transition.type === "fade"
      || (index > 0 && transition.type && transition.type !== "cut" && num(transition.durationSec, 0) > 0);
  });
}

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function xfadeName(type: string | undefined): string {
  if (type === "wipeleft" || type === "wiperight") return type;
  return "fade";
}

function clipVideoFilter(clip: Clip, index: number): string {
  const filters = clip.filters || {};
  const transform = clip.transform || {};
  const brightness = num(filters.brightness, 0);
  const contrast = num(filters.contrast, 1);
  const saturation = filters.look === "mono" ? 0 : num(filters.saturation, 1);
  const scale = num(transform.scale, 1);
  const x = num(transform.x, 0);
  const y = num(transform.y, 0);
  const rotation = num(transform.rotation, 0);
  const opacity = num(transform.opacity, 1);
  const fadeIn = clip.transition?.type === "fade" ? num(clip.transition.durationSec, 0.5) : 0;
  const chain: string[] = [`[${index}:v:0]setpts=PTS-STARTPTS`];
  if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
    chain.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
  }
  if (rotation !== 0) chain.push(`rotate=${rotation}*PI/180:c=black@0`);
  if (scale !== 1) chain.push(`scale=iw*${scale}:ih*${scale}`);
  if (opacity !== 1) chain.push(`format=rgba,colorchannelmixer=aa=${opacity}`);
  if (fadeIn > 0) chain.push(`fade=t=in:st=0:d=${fadeIn}`);
  chain.push(`pad=ceil(iw/2)*2:ceil(ih/2)*2`);
  const base = chain.join(",");
  if (x !== 0 || y !== 0) {
    return `${base}[fg${index}];color=c=black:s=1920x1080:d=${num(clip.duration, 1)}[bg${index}];[bg${index}][fg${index}]overlay=x=(W-w)/2+${x}:y=(H-h)/2+${y}[v${index}]`;
  }
  return `${base}[v${index}]`;
}

interface BuildAdvancedFilterComplexOptions {
  withAudio: boolean;
}

function buildAdvancedFilterComplex(clips: Clip[], { withAudio }: BuildAdvancedFilterComplexOptions): string {
  const parts: string[] = clips.map((clip, index) => clipVideoFilter(clip, index));
  let current = "v0";
  let elapsed = num(clips[0]?.duration, 0);
  for (let i = 1; i < clips.length; i += 1) {
    const transition = clips[i].transition || {};
    const duration = transition.type && transition.type !== "cut" ? num(transition.durationSec, 0.5) : 0;
    if (duration > 0) {
      const offset = Math.max(0, elapsed - duration);
      parts.push(`[${current}][v${i}]xfade=transition=${xfadeName(transition.type)}:duration=${duration}:offset=${offset}[vx${i}]`);
      current = `vx${i}`;
      elapsed += num(clips[i].duration, 0) - duration;
    } else {
      parts.push(`[${current}][v${i}]concat=n=2:v=1:a=0[vx${i}]`);
      current = `vx${i}`;
      elapsed += num(clips[i].duration, 0);
    }
  }
  parts.push(`[${current}]format=yuv420p[v]`);
  if (withAudio) {
    for (let i = 0; i < clips.length; i += 1) {
      const volumeDb = num(clips[i].volumeDb, 0);
      const volumeFilter = volumeDb !== 0 ? `,volume=${volumeDb}dB` : "";
      parts.push(`[${i}:a:0]asetpts=PTS-STARTPTS${volumeFilter}[a${i}]`);
    }
    let audio = "";
    for (let i = 0; i < clips.length; i += 1) audio += `[a${i}]`;
    parts.push(`${audio}concat=n=${clips.length}:v=0:a=1[a]`);
  }
  return parts.join(";");
}
