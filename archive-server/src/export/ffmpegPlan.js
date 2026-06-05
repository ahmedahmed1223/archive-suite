// Pure ffmpeg command builder for MP4 export of a project timeline. No exec
// here — just the argv — so it's fully unit-testable. Each rough cut becomes a
// trimmed input (-ss/-to before -i), then a concat filter stitches them into
// one re-encoded MP4 (re-encode is required to join heterogeneous sources).

export class ExportError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = "ExportError";
    this.code = code;
  }
}

/**
 * Build the ffmpeg argv for a timeline.
 * @param {object} timeline - from buildProjectTimeline (clips with sourceIn/out)
 * @param {object} options
 * @param {(clip:object)=>string} options.resolveSource - clip → local file path
 * @param {string} options.output - output mp4 path
 * @param {boolean} [options.withAudio=true]
 * @returns {string[]} ffmpeg arguments
 * @throws {ExportError} when the timeline has no usable clips
 */
export function buildFfmpegArgs(timeline, { resolveSource, output, withAudio = true } = {}) {
  const clips = Array.isArray(timeline?.clips) ? timeline.clips : [];
  if (!clips.length) throw new ExportError("لا توجد قصاصات قابلة للتصدير في المشروع.", { code: "EMPTY" });
  if (typeof resolveSource !== "function") throw new ExportError("resolveSource مطلوب.", { code: "NO_RESOLVER" });
  if (!output) throw new ExportError("مسار الإخراج مطلوب.", { code: "NO_OUTPUT" });

  const args = [];
  clips.forEach((clip) => {
    const src = resolveSource(clip);
    if (!src) throw new ExportError(`تعذّر إيجاد ملف المصدر للقصاصة "${clip.title || clip.id}".`, { code: "SOURCE_MISSING" });
    // Trim each input to its in/out window. -ss/-to before -i is fast + precise
    // enough for cut points; re-encode below makes them frame-accurate.
    args.push("-ss", String(clip.sourceIn), "-to", String(clip.sourceOut), "-i", src);
  });

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
