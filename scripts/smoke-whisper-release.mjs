import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const smokeShell = String.raw`set -eu
command -v whisper-ctranslate2 >/dev/null
printf 'BINARY=whisper-ctranslate2\n'
mkdir -p /tmp/archive-whisper-smoke
python3 - <<'PY'
import math, struct, wave
path = '/tmp/archive-whisper-smoke/smoke.wav'
rate = 16000
with wave.open(path, 'wb') as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(rate)
    frames = bytearray()
    for index in range(rate):
        sample = int(900 * math.sin(2 * math.pi * 440 * index / rate))
        frames.extend(struct.pack('<h', sample))
    audio.writeframes(frames)
PY
whisper-ctranslate2 /tmp/archive-whisper-smoke/smoke.wav --model tiny --language en --device cpu --compute_type int8 --output_format vtt --output_dir /tmp/archive-whisper-smoke
test -s /tmp/archive-whisper-smoke/smoke.vtt
cat /tmp/archive-whisper-smoke/smoke.vtt`;

function defaultRun(command, args) {
  return spawnSync(command, args, { encoding: "utf8", timeout: 10 * 60 * 1000 });
}

export function runWhisperReleaseSmoke({ image, evidencePath, run = defaultRun } = {}) {
  if (!image || !evidencePath) throw new Error("Whisper release smoke requires --image and --evidence.");
  const result = run("docker", ["run", "--rm", image, "bash", "-lc", smokeShell]);
  if (result.status !== 0) throw new Error(`Whisper release smoke failed with exit code ${result.status}: ${result.stderr || ""}`);
  if (!String(result.stdout).includes("BINARY=whisper-ctranslate2")) throw new Error("Whisper release smoke did not execute the canonical binary.");
  if (!String(result.stdout).includes("WEBVTT")) throw new Error("Whisper release smoke did not produce VTT evidence.");
  const evidence = {
    schemaVersion: "1.0",
    ok: true,
    binary: "whisper-ctranslate2",
    model: "tiny",
    device: "cpu",
    computeType: "int8",
    outputFormat: "vtt",
  };
  writeFileSync(resolve(evidencePath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

function value(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runWhisperReleaseSmoke({ image: value(process.argv, "--image"), evidencePath: value(process.argv, "--evidence") });
    console.log("ok - Whisper release smoke passed");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
