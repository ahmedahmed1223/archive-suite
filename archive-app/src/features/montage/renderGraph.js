import { normalizeClipFilters } from "./filterRegistry.js";
import { findTrackCollisions, normalizeMultiTrackProject } from "./multiTrackModel.js";
import {
  normalizeClipFilters as normalizeLegacyFilters,
  normalizeClipTransform,
  normalizeClipTransition
} from "../projects/viewModel.js";

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function sourcePath(item = {}) {
  return item.path || item.filePath || item.url || item.metadata?.localFile?.path || item.metadata?.localFile?.relativePath || "";
}

function normalizeAudio(audio = {}, fallbackVolumeDb = 0) {
  const clamped = (value, fallback, min, max) => {
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

function normalizeKeyframes(keyframes = []) {
  return (Array.isArray(keyframes) ? keyframes : [])
    .filter((keyframe) => keyframe && String(keyframe.property || "").trim())
    .map((keyframe, index) => ({
      id: String(keyframe.id || `keyframe-${index + 1}`),
      property: String(keyframe.property).trim(),
      timeSec: nonNegative(keyframe.timeSec),
      value: keyframe.value,
      easing: String(keyframe.easing || "linear")
    }))
    .sort((a, b) => a.timeSec - b.timeSec);
}

export function buildRenderGraph(project = {}, itemsById = new Map()) {
  const normalized = normalizeMultiTrackProject(project);
  const trackMap = new Map(normalized.timelineTracks.map((track) => [track.id, track]));
  const warnings = [];
  const layers = normalized.roughCuts.map((clip, clipOrder) => {
    const track = trackMap.get(clip.trackId);
    const durationSec = Math.max(0, nonNegative(clip.outSec) - nonNegative(clip.inSec));
    const startSec = nonNegative(clip.timelineStartSec);
    const item = itemsById.get?.(clip.itemId) || {};
    const source = sourcePath(item);
    const filters = normalizeClipFilters(clip.filterStack || (Array.isArray(clip.filters) ? clip.filters : []));
    const layerWarnings = [];
    if (durationSec <= 0) layerWarnings.push({ code: "invalid-duration", severity: "error" });
    if (!source && !["title", "adjustment"].includes(track?.type)) {
      layerWarnings.push({ code: "missing-source", severity: "error" });
    }
    for (const filter of filters) {
      if (filter.exportOnly) layerWarnings.push({ code: "export-only-filter", severity: "warning", filterId: filter.id });
    }
    const layer = {
      clipId: clip.id,
      itemId: clip.itemId,
      title: clip.label || item.title || clip.id,
      trackId: clip.trackId,
      trackType: track?.type || "video",
      trackOrder: track?.order || 0,
      clipOrder,
      startSec,
      endSec: startSec + durationSec,
      durationSec,
      sourceIn: nonNegative(clip.inSec),
      sourceOut: nonNegative(clip.outSec),
      source,
      transform: normalizeClipTransform(clip.transform),
      opacity: Number.isFinite(Number(clip.opacity)) ? Math.max(0, Math.min(1, Number(clip.opacity))) : normalizeClipTransform(clip.transform).opacity,
      blendMode: String(clip.blendMode || "normal"),
      filters,
      legacyFilters: normalizeLegacyFilters(Array.isArray(clip.filters) ? {} : clip.filters),
      audio: normalizeAudio(clip.audio, clip.volumeDb),
      transition: normalizeClipTransition(clip.transition),
      keyframes: normalizeKeyframes(clip.keyframes),
      linkedGroupId: clip.linkedGroupId || null,
      locked: Boolean(clip.locked),
      warnings: layerWarnings
    };
    warnings.push(...layerWarnings.map((warning) => ({ ...warning, clipId: clip.id, trackId: clip.trackId })));
    return layer;
  }).sort((a, b) => a.trackOrder - b.trackOrder || a.startSec - b.startSec || a.clipOrder - b.clipOrder);

  for (const collision of findTrackCollisions(normalized.roughCuts)) {
    warnings.push({ code: "track-collision", severity: "warning", ...collision });
  }

  return {
    version: "render-graph/v1",
    project: { id: normalized.id || "", name: normalized.name || "" },
    settings: { ...(normalized.timelineSettings || {}) },
    preferences: { ...normalized.timelinePreferences },
    markers: [...(normalized.markers || [])],
    tracks: normalized.timelineTracks,
    layers,
    warnings
  };
}

export function getActiveLayers(graph, playheadSec) {
  const time = nonNegative(playheadSec);
  const tracks = new Map((graph?.tracks || []).map((track) => [track.id, track]));
  const hasSolo = (graph?.tracks || []).some((track) => track.solo && !track.hidden);
  return (graph?.layers || []).filter((layer) => {
    const track = tracks.get(layer.trackId);
    const trackActive = track && !track.hidden && (!hasSolo || track.solo);
    return trackActive && layer.startSec <= time && time < layer.endSec;
  });
}

export function getTimelineEndSec(graph) {
  return (graph?.layers || []).reduce((end, layer) => Math.max(end, nonNegative(layer.endSec)), 0);
}

export function serializeMultiTrackTimeline(graph) {
  return {
    version: "multitrack/v1",
    project: { ...(graph?.project || {}) },
    settings: { ...(graph?.settings || {}) },
    preferences: { ...(graph?.preferences || {}) },
    markers: [...(graph?.markers || [])],
    totalDuration: getTimelineEndSec(graph),
    tracks: (graph?.tracks || []).map((track) => ({ ...track })),
    clips: (graph?.layers || []).map((layer) => ({ ...layer })),
    warnings: (graph?.warnings || []).map((warning) => ({ ...warning }))
  };
}
