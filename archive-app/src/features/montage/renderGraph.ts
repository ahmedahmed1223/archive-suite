import { normalizeClipFilters } from "./filterRegistry.js";
import { findTrackCollisions, normalizeMultiTrackProject } from "./multiTrackModel.js";
import type { MultiTrackClip, MultiTrackTrack } from "./multiTrackModel.js";
import {
  normalizeClipFilters as normalizeLegacyFilters,
  normalizeClipTransform,
  normalizeClipTransition
} from "../projects/viewModel.js";

type ItemRecord = {
  id?: string;
  path?: string;
  filePath?: string;
  url?: string;
  title?: string;
  metadata?: {
    localFile?: {
      path?: string;
      relativePath?: string;
    };
  };
};

type ItemsById = Map<string, ItemRecord> | { get?: (key: string) => ItemRecord | undefined };

type RenderGraphWarning = {
  code: string;
  severity: "error" | "warning";
  clipId?: string;
  trackId?: string;
  filterId?: string;
  [key: string]: unknown;
};

type RenderLayer = {
  clipId: string;
  itemId?: string;
  title: string;
  trackId: string;
  trackType: string;
  trackOrder: number;
  clipOrder: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  sourceIn: number;
  sourceOut: number;
  source: string;
  warnings: RenderGraphWarning[];
  [key: string]: unknown;
};

export type RenderGraph = {
  version: "render-graph/v1";
  project: { id: string; name: string };
  settings: Record<string, unknown>;
  preferences: Record<string, unknown>;
  markers: unknown[];
  tracks: MultiTrackTrack[];
  layers: RenderLayer[];
  warnings: RenderGraphWarning[];
};

function nonNegative(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function sourcePath(item: ItemRecord = {}): string {
  return item.path || item.filePath || item.url || item.metadata?.localFile?.path || item.metadata?.localFile?.relativePath || "";
}

function normalizeAudio(audio: Record<string, unknown> = {}, fallbackVolumeDb = 0) {
  const clamped = (value: unknown, fallback: number, min: number, max: number) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  return {
    volumeDb: clamped(audio.volumeDb, fallbackVolumeDb, -60, 12),
    pan: clamped(audio.pan, 0, -1, 1),
    muted: Boolean(audio.muted),
    fadeInSec: clamped(audio.fadeInSec, 0, 0, 30),
    fadeOutSec: clamped(audio.fadeOutSec, 0, 0, 30)
  };
}

function normalizeKeyframes(keyframes: unknown[] = []) {
  return (Array.isArray(keyframes) ? keyframes : [])
    .filter((keyframe) => keyframe && String((keyframe as { property?: string }).property || "").trim())
    .map((keyframe, index) => ({
      id: String((keyframe as { id?: string }).id || `keyframe-${index + 1}`),
      property: String((keyframe as { property: string }).property).trim(),
      timeSec: nonNegative((keyframe as { timeSec?: unknown }).timeSec),
      value: (keyframe as { value?: unknown }).value,
      easing: String((keyframe as { easing?: string }).easing || "linear")
    }))
    .sort((a, b) => a.timeSec - b.timeSec);
}

export function buildRenderGraph(project: Record<string, unknown> = {}, itemsById: ItemsById = new Map()): RenderGraph {
  const normalized = normalizeMultiTrackProject(project) as {
    id?: string;
    name?: string;
    timelineTracks: MultiTrackTrack[];
    roughCuts: MultiTrackClip[];
    timelineSettings?: Record<string, unknown>;
    timelinePreferences?: Record<string, unknown>;
    markers?: unknown[];
  };
  const trackMap = new Map(normalized.timelineTracks.map((track) => [track.id, track]));
  const warnings: RenderGraphWarning[] = [];
  const layers = normalized.roughCuts
    .map((clip: MultiTrackClip, clipOrder: number): RenderLayer => {
      const clipId = String(clip.id || "");
      const itemId = clip.itemId == null ? undefined : String(clip.itemId);
      const trackId = String(clip.trackId || "");
      const track = trackMap.get(trackId);
      const durationSec = Math.max(0, nonNegative(clip.outSec) - nonNegative(clip.inSec));
      const startSec = nonNegative(clip.timelineStartSec);
      const item = itemsById.get?.(String(itemId || ""));
      const source = sourcePath(item);
      const filterInput = Array.isArray(clip.filterStack)
        ? clip.filterStack
        : Array.isArray(clip.filters)
          ? clip.filters
          : [];
      const filters = normalizeClipFilters(filterInput);
      const layerWarnings: RenderGraphWarning[] = [];
      if (durationSec <= 0) layerWarnings.push({ code: "invalid-duration", severity: "error" });
      if (!source && !["title", "adjustment"].includes(track?.type || "")) {
        layerWarnings.push({ code: "missing-source", severity: "error" });
      }
      for (const filter of filters) {
        if (filter.exportOnly) layerWarnings.push({ code: "export-only-filter", severity: "warning", filterId: filter.id });
      }
      const transform = normalizeClipTransform(clip.transform as Record<string, unknown> | undefined);
      const layer = {
        clipId,
        itemId,
        title: String(clip.label || item?.title || clipId),
        trackId,
        trackType: track?.type || "video",
        trackOrder: track?.order || 0,
        clipOrder,
        startSec,
        endSec: startSec + durationSec,
        durationSec,
        sourceIn: nonNegative(clip.inSec),
        sourceOut: nonNegative(clip.outSec),
        source,
        transform,
        opacity: Number.isFinite(Number(clip.opacity)) ? Math.max(0, Math.min(1, Number(clip.opacity))) : transform.opacity,
        blendMode: String(clip.blendMode || "normal"),
        filters,
        legacyFilters: normalizeLegacyFilters(Array.isArray(clip.filters) ? {} : (clip.filters as Record<string, unknown> | undefined)),
        audio: normalizeAudio(clip.audio as Record<string, unknown> | undefined, Number(clip.volumeDb) || 0),
        transition: normalizeClipTransition(clip.transition as Record<string, unknown> | undefined),
        keyframes: normalizeKeyframes(Array.isArray(clip.keyframes) ? clip.keyframes : []),
        linkedGroupId: clip.linkedGroupId || null,
        locked: Boolean(clip.locked),
        warnings: layerWarnings
      };
      warnings.push(...layerWarnings.map((warning) => ({ ...warning, clipId, trackId })));
      return layer;
    })
    .sort((a, b) => a.trackOrder - b.trackOrder || a.startSec - b.startSec || a.clipOrder - b.clipOrder);

  for (const collision of findTrackCollisions(normalized.roughCuts)) {
    warnings.push({ code: "track-collision", severity: "warning", ...collision });
  }

  return {
    version: "render-graph/v1",
    project: { id: normalized.id || "", name: normalized.name || "" },
    settings: { ...((normalized.timelineSettings as Record<string, unknown>) || {}) },
    preferences: { ...((normalized.timelinePreferences as Record<string, unknown>) || {}) },
    markers: [...((normalized.markers as unknown[]) || [])],
    tracks: normalized.timelineTracks,
    layers,
    warnings
  };
}

export function getActiveLayers(graph: Partial<RenderGraph> | null | undefined, playheadSec: unknown): RenderLayer[] {
  const time = nonNegative(playheadSec);
  const tracks = new Map<string, MultiTrackTrack>((graph?.tracks || []).map((track) => [track.id, track]));
  const hasSolo = (graph?.tracks || []).some((track) => track.solo && !track.hidden);
  return (graph?.layers || []).filter((layer) => {
    const track = tracks.get(layer.trackId);
    const trackActive = track && !track.hidden && (!hasSolo || track.solo);
    return Boolean(trackActive) && layer.startSec <= time && time < layer.endSec;
  });
}

export function getTimelineEndSec(graph: Partial<RenderGraph> | null | undefined): number {
  return (graph?.layers || []).reduce((end: number, layer: { endSec?: number }) => Math.max(end, nonNegative(layer.endSec)), 0);
}

export function serializeMultiTrackTimeline(graph: Partial<RenderGraph> | null | undefined) {
  return {
    version: "multitrack/v1",
    project: { ...(graph?.project || {}) },
    settings: { ...(graph?.settings || {}) },
    preferences: { ...(graph?.preferences || {}) },
    markers: [...(graph?.markers || [])],
    totalDuration: getTimelineEndSec(graph),
    tracks: (graph?.tracks || []).map((track: Record<string, unknown>) => ({ ...track })),
    clips: (graph?.layers || []).map((layer: Record<string, unknown>) => ({ ...layer })),
    warnings: (graph?.warnings || []).map((warning: Record<string, unknown>) => ({ ...warning }))
  };
}
