import type { MaterialBinItem } from "@/components/montage/MediaBin";
import type { MontageSourceRef } from "./montage-editor";

type MontageMaterialClip = {
  id: string;
  source: MontageSourceRef;
  sourceIn: number;
  sourceOut: number;
};

/** Builds a stable material bin from the sources already pinned in a project. */
export function deriveMontageMaterials(clips: MontageMaterialClip[]): MaterialBinItem[] {
  const seen = new Set<string>();

  return clips.flatMap((clip) => {
    const durationSeconds = clip.sourceOut - clip.sourceIn;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];

    const key = `${clip.source.recordId}:${clip.source.sourceVersionToken}`;
    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      id: key,
      name: clip.source.recordId,
      durationSeconds,
      source: clip.source,
    }];
  });
}
