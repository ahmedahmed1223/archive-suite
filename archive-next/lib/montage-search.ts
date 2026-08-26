/**
 * V1.5 Task 9: montage discovery helpers.
 * studioHref is built server-side from a known project id and a finite
 * timestamp — never copied verbatim from storage or client input.
 */

export type MontageSearchKind = "record" | "project" | "clip" | "derivative";

export function buildStudioHref(projectId: string, atSeconds?: number): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return "/media/studio";
  const params = new URLSearchParams({ projectId: safeId });
  if (atSeconds !== undefined && Number.isFinite(atSeconds) && atSeconds >= 0) {
    params.set("at", String(Math.floor(atSeconds)));
  }
  return `/media/studio?${params.toString()}`;
}

export function isMontageSearchKind(value: unknown): value is MontageSearchKind {
  return (
    value === "record" || value === "project" || value === "clip" || value === "derivative"
  );
}

/** Preview summary for a clip result: announces duration + derivative state. */
export function describeClipResult(clip: {
  name?: string;
  durationSeconds?: number;
  hasDerivative?: boolean;
}): string {
  const parts: string[] = [];
  parts.push(clip.name?.trim() || "مقطع بلا عنوان");
  if (typeof clip.durationSeconds === "number" && Number.isFinite(clip.durationSeconds)) {
    parts.push(`المدة ${Math.round(clip.durationSeconds)} ثانية`);
  }
  parts.push(clip.hasDerivative ? "له نسخة مشتقة" : "بلا نسخة مشتقة");
  return parts.join(" — ");
}
