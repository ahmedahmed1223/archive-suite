import type { MediaInspection, MediaProbeReport } from "@/lib/archive-api";

type ProbeInspection = Pick<MediaInspection, "inspectionType" | "isCurrentVersion" | "report">;

function isProbeReport(report: MediaInspection["report"]): report is MediaProbeReport {
  return "streams" in report;
}

/**
 * Resolves a frame-bound archival description to a browser seek time. The
 * calculation is allowed only when the current source's probe supplied an
 * explicit rational frame rate; callers must not substitute a house default.
 */
export function resolveTimedDescriptionStartSeconds(
  startFrame: number,
  inspections: readonly ProbeInspection[],
): number | null {
  if (!Number.isInteger(startFrame) || startFrame < 0) return null;

  const report = inspections.find((inspection) => (
    inspection.inspectionType === "probe"
    && inspection.isCurrentVersion
    && isProbeReport(inspection.report)
  ))?.report;
  if (!report || !isProbeReport(report)) return null;

  const frameRate = report.streams.find((stream) => stream.type === "video")?.frameRate;
  if (!frameRate || frameRate.numerator <= 0 || frameRate.denominator <= 0) return null;

  return startFrame * frameRate.denominator / frameRate.numerator;
}
