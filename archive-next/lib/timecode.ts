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

/** Returns null when the text is not a valid label for the supplied frame rate. */
export function timecodeToFrames(value: string, rate: RationalFrameRate, mode: TimecodeMode): number | null {
  const match = /^(\d{2}):(\d{2}):(\d{2})([:;])(\d{2})$/.exec(value.trim());
  if (!match || rate.numerator <= 0 || rate.denominator <= 0) return null;

  const [, hoursText, minutesText, secondsText, separator, framesText] = match;
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  const frame = Number(framesText);
  const nominalFps = Math.round(rate.numerator / rate.denominator);
  if (minutes >= 60 || seconds >= 60 || frame >= nominalFps) return null;
  if (mode === "drop_frame" && separator !== ";") return null;
  if (mode === "non_drop" && separator !== ":") return null;

  const nominalFrames = ((hours * 3600 + minutes * 60 + seconds) * nominalFps) + frame;
  if (mode !== "drop_frame") return nominalFrames;
  if (rate.numerator !== 30000 || rate.denominator !== 1001) return null;

  const totalMinutes = hours * 60 + minutes;
  if (seconds === 0 && totalMinutes % 10 !== 0 && frame < 2) return null;
  const droppedFrames = 2 * (totalMinutes - Math.floor(totalMinutes / 10));
  return nominalFrames - droppedFrames;
}
