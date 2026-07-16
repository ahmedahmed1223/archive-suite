// V1-756: storage growth prediction for the reports page.
//
// A capacity warning is only useful if it is honest. The dangerous output here
// is not a wrong number — it is a confident-looking number fitted to data that
// cannot support one (a single sample, one instant, erratic noise). So this
// module refuses to forecast when the evidence is not there, and always ships
// the fit quality alongside the projection so the UI can qualify it.
//
// Sample collection is deliberately NOT here: the caller supplies the series
// (metrics history, or record sizes aggregated by date), which keeps every rule
// below testable without a live stack.

const DAY_MS = 86_400_000;

export interface StorageSample {
  /** ISO-8601 instant of the measurement. */
  at: string;
  usedBytes: number;
}

export interface StorageForecastFailure {
  ok: false;
  code: "INSUFFICIENT_SAMPLES" | "NO_TIME_SPAN" | "SAMPLE_INVALID";
  message: string;
  nextActions: string[];
}

export interface StorageForecastSuccess {
  ok: true;
  /** Fitted least-squares slope. Negative means storage is being reclaimed. */
  bytesPerDay: number;
  /** Coefficient of determination (R²) in 0..1 — how well the trend fits. */
  confidence: number;
  /** The most recent measured total (not the fitted value). */
  currentBytes: number;
  /** Days until capacity is reached, 0 if already over, null if never. */
  daysUntilFull: number | null;
  exhaustionAt: string | null;
  /** Fitted total `days` after the last sample; floors at 0, never extrapolates backwards. */
  projectedBytes: (days: number) => number;
}

export type StorageForecast = StorageForecastFailure | StorageForecastSuccess;

function fail(code: StorageForecastFailure["code"], message: string, nextActions: string[]): StorageForecastFailure {
  return { ok: false, code, message, nextActions };
}

export function forecastStorageGrowth(
  samples: StorageSample[],
  { capacityBytes }: { capacityBytes?: number } = {},
): StorageForecast {
  if (!Array.isArray(samples) || samples.length < 2) {
    return fail("INSUFFICIENT_SAMPLES", "At least two storage measurements are needed to fit a trend.", ["Collect storage measurements over several days, then retry."]);
  }

  const points: Array<{ time: number; bytes: number }> = [];
  for (const sample of samples) {
    const time = Date.parse(String(sample?.at));
    const bytes = Number(sample?.usedBytes);
    if (!Number.isFinite(time) || !Number.isFinite(bytes) || bytes < 0) {
      return fail("SAMPLE_INVALID", "Every sample needs a parseable timestamp and a non-negative byte count.", ["Correct the malformed storage samples and retry."]);
    }
    points.push({ time, bytes });
  }

  // Input order must never decide the trend direction.
  points.sort((a, b) => a.time - b.time);

  const firstTime = points[0].time;
  const lastTime = points[points.length - 1].time;
  if (lastTime === firstTime) {
    return fail("NO_TIME_SPAN", "All samples share one instant, so no per-day rate exists.", ["Collect measurements taken at different times, then retry."]);
  }

  // x = days since the first sample, y = bytes used.
  const xs = points.map((point) => (point.time - firstTime) / DAY_MS);
  const ys = points.map((point) => point.bytes);
  const n = points.length;
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / n;

  let covariance = 0;
  let varianceX = 0;
  for (let i = 0; i < n; i += 1) {
    covariance += (xs[i] - meanX) * (ys[i] - meanY);
    varianceX += (xs[i] - meanX) ** 2;
  }
  const slope = varianceX === 0 ? 0 : covariance / varianceX;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    ssRes += (ys[i] - (intercept + slope * xs[i])) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  // Flat data has no variance to explain; a flat line fits it perfectly.
  const confidence = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));

  const lastX = xs[n - 1];
  const currentBytes = ys[n - 1];

  const projectedBytes = (days: number): number => {
    // Backwards projection is not this function's job — the past is measured,
    // not predicted, so callers get the real latest total instead of a fit.
    if (!Number.isFinite(days) || days <= 0) return currentBytes;
    return Math.max(0, intercept + slope * (lastX + days));
  };

  let daysUntilFull: number | null = null;
  let exhaustionAt: string | null = null;
  if (Number.isFinite(capacityBytes as number) && (capacityBytes as number) > 0) {
    const capacity = capacityBytes as number;
    if (currentBytes >= capacity) {
      daysUntilFull = 0;
      exhaustionAt = new Date(lastTime).toISOString();
    } else if (slope > 0) {
      // Solve intercept + slope*x = capacity, then measure from the last sample.
      const days = Math.max(0, (capacity - intercept) / slope - lastX);
      daysUntilFull = days;
      exhaustionAt = new Date(lastTime + days * DAY_MS).toISOString();
    }
    // slope <= 0 with headroom left: storage is flat or shrinking, so it never
    // fills. Reporting a date here would be an invented deadline.
  }

  return { ok: true, bytesPerDay: slope, confidence, currentBytes, daysUntilFull, exhaustionAt, projectedBytes };
}
