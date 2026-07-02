import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const WIDTH = 320;
const HEIGHT = 180;
const WATERMARK_WIDTH = 96;
const WATERMARK_HEIGHT = 32;
const MARGIN = 12;
const CROP_X = WIDTH - WATERMARK_WIDTH - MARGIN;
const CROP_Y = HEIGHT - WATERMARK_HEIGHT - MARGIN;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}\n${result.stderr || ""}`
    );
  }

  return result;
}

function cropRgbFrame(videoPath) {
  const result = run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "0.5",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      `crop=${WATERMARK_WIDTH}:${WATERMARK_HEIGHT}:${CROP_X}:${CROP_Y},format=rgb24`,
      "-f",
      "rawvideo",
      "-",
    ],
    { encoding: "buffer" }
  );

  return result.stdout;
}

function meanAbsoluteDifference(a, b) {
  if (a.length !== b.length || a.length === 0) {
    throw new Error(`Unexpected crop buffers: ${a.length} vs ${b.length}`);
  }

  let total = 0;
  for (let index = 0; index < a.length; index += 1) {
    total += Math.abs(a[index] - b[index]);
  }

  return total / a.length;
}

const workDir = mkdtempSync(join(tmpdir(), "masar-watermark-smoke-"));
const sourcePath = join(workDir, "source.mp4");
const watermarkPath = join(workDir, "watermark.png");
const outputPath = join(workDir, "watermarked.mp4");

try {
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=${WIDTH}x${HEIGHT}:rate=24`,
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000",
    "-t",
    "1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    sourcePath,
  ]);

  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0x1f6f5b:s=${WATERMARK_WIDTH}x${WATERMARK_HEIGHT}`,
    "-frames:v",
    "1",
    "-update",
    "1",
    watermarkPath,
  ]);

  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    sourcePath,
    "-i",
    watermarkPath,
    "-filter_complex",
    `[1:v]format=rgba,colorchannelmixer=aa=0.7[wm];[0:v][wm]overlay=x=W-w-${MARGIN}:y=H-h-${MARGIN}[v]`,
    "-map",
    "[v]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath,
  ]);

  const probe = run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,duration",
    "-of",
    "json",
    outputPath,
  ]);

  const metadata = JSON.parse(probe.stdout);
  const stream = metadata.streams?.[0];
  if (stream?.width !== WIDTH || stream?.height !== HEIGHT || Number(stream?.duration ?? 0) <= 0) {
    throw new Error(`Unexpected watermarked video metadata: ${probe.stdout}`);
  }

  const sourceCrop = cropRgbFrame(sourcePath);
  const outputCrop = cropRgbFrame(outputPath);
  const cropDifference = meanAbsoluteDifference(sourceCrop, outputCrop);
  if (cropDifference < 8) {
    throw new Error(`Watermark crop difference is too small: ${cropDifference.toFixed(2)}`);
  }

  const outputSize = statSync(outputPath).size;
  if (outputSize < 1024) {
    throw new Error(`Watermarked output is unexpectedly small: ${outputSize} bytes`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        output: process.env.SMOKE_KEEP_TMP ? outputPath : "temporary file removed",
        outputSize,
        cropDifference: Number(cropDifference.toFixed(2)),
      },
      null,
      2
    )
  );
} finally {
  if (!process.env.SMOKE_KEEP_TMP) {
    rmSync(workDir, { recursive: true, force: true });
  }
}
