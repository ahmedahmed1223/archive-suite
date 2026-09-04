import type { MediaProbeReport } from "@/lib/archive-api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mediaProbeReportFromJobResult(result: Record<string, unknown> | null | undefined): MediaProbeReport | null {
  const artifacts = result?.artifacts;
  if (!Array.isArray(artifacts)) return null;

  const artifact = artifacts.find((candidate) => isRecord(candidate) && candidate.kind === "media_probe_report");
  if (!isRecord(artifact) || !isRecord(artifact.report)) return null;

  const report = artifact.report;
  if (!Array.isArray(report.formatNames) || !report.formatNames.every((value) => typeof value === "string")) return null;
  if (!Array.isArray(report.streams) || !report.streams.every((stream) => isRecord(stream)
    && typeof stream.index === "number"
    && typeof stream.type === "string"
    && typeof stream.codec === "string")) return null;

  return report as MediaProbeReport;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const wholeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatBytes(bytes: number | null | undefined, locale: string): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${units[unitIndex]}`;
}
