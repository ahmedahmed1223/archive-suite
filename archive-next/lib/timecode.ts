export type RationalFrameRate = Readonly<{ numerator: number; denominator: number }>;
export type TimecodeMode = "non_drop" | "drop_frame";

export function secondsToFrames(seconds: number, rate: RationalFrameRate): number {
  return Math.round(seconds * rate.numerator / rate.denominator);
}

export function framesToTimecode(frames: number, rate: RationalFrameRate, mode: TimecodeMode): string {
  const nominalFps = Math.round(rate.numerator / rate.denominator);
  if (mode === "drop_frame" && rate.numerator === 30000 && rate.denominator === 1001) {
    const dropped = 2 * (Math.floor(frames / 17982) * 9 + Math.max(0, Math.floor((frames % 17982 - 2) / 1798)));
    frames += dropped;
  }
  const ff = ((frames % nominalFps) + nominalFps) % nominalFps;
  const totalSeconds = Math.floor(frames / nominalFps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}${mode === "drop_frame" ? ";" : ":"}${String(ff).padStart(2, "0")}`;
}
