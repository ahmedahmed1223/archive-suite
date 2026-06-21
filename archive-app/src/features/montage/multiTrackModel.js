const TRACK_TYPE_SET = new Set(["video", "audio", "title", "adjustment"]);

export const TRACK_TYPES = Object.freeze([...TRACK_TYPE_SET]);

export const DEFAULT_TIMELINE_PREFERENCES = Object.freeze({
  snapping: true,
  snapInterval: "frame",
  rippleMode: "primary",
  allowGaps: true,
  linkAudioVideo: true,
  showWaveforms: true,
  showThumbnails: true
});

const TRACK_DEFAULTS = Object.freeze({
  height: "medium",
  locked: false,
  hidden: false,
  muted: false,
  solo: false,
  magnetic: false,
  volumeDb: 0
});

function finiteNonNegative(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function clipDuration(clip) {
  return Math.max(0, finiteNonNegative(clip?.outSec) - finiteNonNegative(clip?.inSec));
}

function defaultTrackName(type, index) {
  const labels = { video: "Video", audio: "Audio", title: "Titles", adjustment: "Adjustment" };
  return `${labels[type] || "Track"} ${index + 1}`;
}

function makeTrack(partial, order) {
  const type = String(partial?.type || "").trim().toLowerCase();
  if (!TRACK_TYPE_SET.has(type)) throw new Error(`Unsupported track type: ${type || "empty"}`);
  return {
    ...TRACK_DEFAULTS,
    ...partial,
    id: String(partial.id || "").trim(),
    type,
    name: String(partial.name || defaultTrackName(type, order)).trim(),
    order: Number.isInteger(partial.order) ? partial.order : order,
    volumeDb: Number.isFinite(Number(partial.volumeDb)) ? Number(partial.volumeDb) : 0,
    magnetic: partial.magnetic === undefined ? type === "video" && order === 0 : Boolean(partial.magnetic),
    locked: Boolean(partial.locked),
    hidden: Boolean(partial.hidden),
    muted: Boolean(partial.muted),
    solo: Boolean(partial.solo)
  };
}

function orderedTracks(tracks) {
  return [...(Array.isArray(tracks) ? tracks : [])]
    .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
    .map((track, index) => makeTrack(track, index));
}

function defaultIdFactory(type, tracks) {
  const prefix = type === "audio" ? "a" : type === "title" ? "t" : type === "adjustment" ? "adj" : "v";
  const used = new Set(tracks.map((track) => track.id));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

function inferredClipType(clip) {
  const explicit = String(clip?.trackType || clip?.mediaType || clip?.kind || "").toLowerCase();
  if (["audio", "title", "adjustment", "video"].includes(explicit)) return explicit;
  return "video";
}

function isCompatible(clip, track) {
  const clipType = inferredClipType(clip);
  if (clipType === "title") return track.type === "title" || track.type === "video";
  if (clipType === "adjustment") return track.type === "adjustment";
  return clipType === track.type;
}

export function createDefaultTracks() {
  return [
    makeTrack({ id: "v1", type: "video", name: "Video 1", magnetic: true }, 0),
    makeTrack({ id: "a1", type: "audio", name: "Audio 1" }, 1)
  ];
}

export function normalizeMultiTrackProject(project = {}) {
  const sourceTracks = Array.isArray(project.timelineTracks) && project.timelineTracks.length
    ? project.timelineTracks
    : createDefaultTracks();
  const timelineTracks = orderedTracks(sourceTracks);
  const trackIds = new Set(timelineTracks.map((track) => track.id));
  const fallbackTrackId = timelineTracks.find((track) => track.type === "video")?.id || timelineTracks[0]?.id || "v1";
  const cursors = new Map();
  const roughCuts = [...(Array.isArray(project.roughCuts) ? project.roughCuts : [])]
    .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
    .map((clip, index) => {
      const requestedTrack = String(clip?.trackId || "").trim();
      const trackId = trackIds.has(requestedTrack) ? requestedTrack : fallbackTrackId;
      const hasExplicitStart = Number.isFinite(Number(clip?.timelineStartSec)) && Number(clip.timelineStartSec) >= 0;
      const timelineStartSec = hasExplicitStart
        ? Number(clip.timelineStartSec)
        : cursors.get(trackId) || 0;
      cursors.set(trackId, Math.max(cursors.get(trackId) || 0, timelineStartSec + clipDuration(clip)));
      return { ...clip, order: Number.isInteger(clip?.order) ? clip.order : index, trackId, timelineStartSec };
    });

  return {
    ...project,
    timelineTracks,
    timelinePreferences: {
      ...DEFAULT_TIMELINE_PREFERENCES,
      ...(project.timelinePreferences || {})
    },
    roughCuts
  };
}

export function addTimelineTrack(tracks, partial = {}, { idFactory } = {}) {
  const ordered = orderedTracks(tracks);
  const type = String(partial.type || "").trim().toLowerCase();
  if (!TRACK_TYPE_SET.has(type)) throw new Error(`Unsupported track type: ${type || "empty"}`);
  const id = String(partial.id || (idFactory ? idFactory(type, ordered) : defaultIdFactory(type, ordered))).trim();
  if (!id || ordered.some((track) => track.id === id)) throw new Error(`Track id already exists: ${id}`);
  const typeIndex = ordered.filter((track) => track.type === type).length;
  const name = String(partial.name || defaultTrackName(type, typeIndex)).trim();
  return [...ordered, makeTrack({ ...partial, id, type, name }, ordered.length)];
}

export function updateTimelineTrack(tracks, trackId, patch = {}) {
  const ordered = orderedTracks(tracks);
  return ordered.map((track, index) => {
    if (track.id !== trackId) return track;
    return makeTrack({ ...track, ...patch, id: track.id, type: patch.type || track.type }, index);
  });
}

export function moveClipToTrack({ clips = [], tracks = [], clipId, trackId, startSec } = {}) {
  const ordered = orderedTracks(tracks);
  const clip = clips.find((entry) => entry?.id === clipId);
  if (!clip) return { ok: false, reason: "clip-not-found", clips: [...clips] };
  if (clip.locked) return { ok: false, reason: "clip-locked", clips: [...clips] };
  const track = ordered.find((entry) => entry.id === trackId);
  if (!track) return { ok: false, reason: "track-not-found", clips: [...clips] };
  if (track.locked) return { ok: false, reason: "track-locked", clips: [...clips] };
  if (!isCompatible(clip, track)) return { ok: false, reason: "incompatible-track", clips: [...clips] };

  return {
    ok: true,
    reason: null,
    clips: clips.map((entry) => entry?.id === clipId
      ? { ...entry, trackId, timelineStartSec: finiteNonNegative(startSec) }
      : entry)
  };
}

function normalizedFps(fps) {
  const value = Number(fps);
  return Number.isFinite(value) && value > 0 ? value : 25;
}

export function secondsToFrame(seconds, fps = 25) {
  return Math.max(0, Math.round(finiteNonNegative(seconds) * normalizedFps(fps)));
}

export function frameToSeconds(frame, fps = 25) {
  return Math.max(0, Math.round(finiteNonNegative(frame))) / normalizedFps(fps);
}

export function resolveSnappedTime({ candidateSec, fps = 25, snapping = true, targets = [] } = {}) {
  const candidate = finiteNonNegative(candidateSec);
  if (!snapping) return candidate;
  const rate = normalizedFps(fps);
  const frameTime = frameToSeconds(secondsToFrame(candidate, rate), rate);
  const threshold = Math.max(2 / rate, 0.08);
  let best = frameTime;
  let bestDistance = Math.abs(candidate - frameTime);
  for (const target of Array.isArray(targets) ? targets : []) {
    const time = finiteNonNegative(target);
    const distance = Math.abs(candidate - time);
    if (distance <= threshold && distance <= bestDistance) {
      best = time;
      bestDistance = distance;
    }
  }
  return best;
}

export function rippleAfterEdit({ clips = [], tracks = [], editedClipId, deltaSec = 0, scope = "off", anchorSec } = {}) {
  const delta = Number(deltaSec);
  if (!Number.isFinite(delta) || delta === 0 || scope === "off") return [...clips];
  const edited = clips.find((clip) => clip?.id === editedClipId);
  if (!edited) return [...clips];
  const trackMap = new Map((Array.isArray(tracks) ? tracks : []).map((track) => [track.id, track]));
  const editedEnd = Number.isFinite(Number(anchorSec))
    ? finiteNonNegative(anchorSec)
    : finiteNonNegative(edited.timelineStartSec) + clipDuration(edited);

  return clips.map((clip) => {
    if (!clip || clip.id === editedClipId) return clip;
    const track = trackMap.get(clip.trackId);
    if (track?.locked || clip.locked) return clip;
    const inScope = scope === "all-unlocked"
      ? true
      : clip.trackId === edited.trackId && Boolean(track?.magnetic);
    if (!inScope || finiteNonNegative(clip.timelineStartSec) < editedEnd) return clip;
    return { ...clip, timelineStartSec: Math.max(0, finiteNonNegative(clip.timelineStartSec) + delta) };
  });
}

export function findTrackCollisions(clips = []) {
  const byTrack = new Map();
  for (const clip of Array.isArray(clips) ? clips : []) {
    const trackId = String(clip?.trackId || "v1");
    if (!byTrack.has(trackId)) byTrack.set(trackId, []);
    byTrack.get(trackId).push(clip);
  }
  const collisions = [];
  for (const [trackId, entries] of byTrack) {
    const ordered = [...entries].sort((a, b) => finiteNonNegative(a?.timelineStartSec) - finiteNonNegative(b?.timelineStartSec));
    for (let index = 0; index < ordered.length; index += 1) {
      const first = ordered[index];
      const firstEnd = finiteNonNegative(first?.timelineStartSec) + clipDuration(first);
      for (let nextIndex = index + 1; nextIndex < ordered.length; nextIndex += 1) {
        const second = ordered[nextIndex];
        const secondStart = finiteNonNegative(second?.timelineStartSec);
        if (secondStart >= firstEnd) break;
        const secondEnd = secondStart + clipDuration(second);
        collisions.push({
          trackId,
          firstId: first.id,
          secondId: second.id,
          overlapSec: Math.max(0, Math.min(firstEnd, secondEnd) - secondStart)
        });
      }
    }
  }
  return collisions;
}

export function trimMultiTrackClip({ clips = [], tracks = [], clipId, edge, sourceSec, rippleMode = "off" } = {}) {
  const clip = clips.find((entry) => entry?.id === clipId);
  if (!clip) return { ok: false, reason: "clip-not-found", clips: [...clips] };
  if (clip.locked) return { ok: false, reason: "clip-locked", clips: [...clips] };
  if (edge !== "in" && edge !== "out") return { ok: false, reason: "invalid-edge", clips: [...clips] };
  const source = finiteNonNegative(sourceSec);
  const oldDuration = clipDuration(clip);
  const originalEndSec = finiteNonNegative(clip.timelineStartSec) + oldDuration;
  let nextClip;
  if (edge === "in") {
    if (source >= finiteNonNegative(clip.outSec)) return { ok: false, reason: "invalid-duration", clips: [...clips] };
    nextClip = { ...clip, inSec: source };
  } else {
    if (source <= finiteNonNegative(clip.inSec)) return { ok: false, reason: "invalid-duration", clips: [...clips] };
    nextClip = { ...clip, outSec: source };
  }
  const deltaSec = clipDuration(nextClip) - oldDuration;
  let next = clips.map((entry) => entry?.id === clipId ? nextClip : entry);
  next = rippleAfterEdit({
    clips: next,
    tracks,
    editedClipId: clipId,
    deltaSec,
    scope: rippleMode,
    anchorSec: originalEndSec
  });
  return { ok: true, reason: null, clips: next, deltaSec };
}

export function splitMultiTrackClip({ clips = [], clipId, timelineSec, idFactory } = {}) {
  const index = clips.findIndex((entry) => entry?.id === clipId);
  if (index < 0) return { ok: false, reason: "clip-not-found", clips: [...clips] };
  const clip = clips[index];
  if (clip.locked) return { ok: false, reason: "clip-locked", clips: [...clips] };
  const start = finiteNonNegative(clip.timelineStartSec);
  const offset = finiteNonNegative(timelineSec) - start;
  const duration = clipDuration(clip);
  if (offset <= 0 || offset >= duration) return { ok: false, reason: "split-outside-clip", clips: [...clips] };
  const sourceSplit = finiteNonNegative(clip.inSec) + offset;
  const rightId = String(idFactory ? idFactory(clip) : `${clip.id}-split`).trim();
  if (!rightId || clips.some((entry) => entry?.id === rightId)) return { ok: false, reason: "duplicate-clip-id", clips: [...clips] };
  const left = { ...clip, outSec: sourceSplit };
  const right = {
    ...clip,
    id: rightId,
    inSec: sourceSplit,
    timelineStartSec: start + offset,
    order: (Number.isInteger(clip.order) ? clip.order : index) + 1
  };
  const next = [...clips];
  next.splice(index, 1, left, right);
  return {
    ok: true,
    reason: null,
    clips: next.map((entry, order) => ({ ...entry, order })),
    leftId: left.id,
    rightId
  };
}

export function reorderTimelineTracks(tracks, activeId, overId) {
  const ordered = orderedTracks(tracks);
  const fromIndex = ordered.findIndex((track) => track.id === activeId);
  const toIndex = ordered.findIndex((track) => track.id === overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return ordered.map((track, order) => ({ ...track, order }));
  }
  const next = [...ordered];
  const [active] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, active);
  return next.map((track, order) => ({ ...track, order }));
}

export function removeTimelineTrack({ tracks = [], clips = [], trackId, strategy = "cancel", destinationTrackId } = {}) {
  const ordered = orderedTracks(tracks);
  const track = ordered.find((entry) => entry.id === trackId);
  if (!track) return { ok: false, reason: "track-not-found", tracks: ordered, clips: [...clips] };
  if (track.locked) return { ok: false, reason: "track-locked", tracks: ordered, clips: [...clips] };
  if (ordered.length <= 1) return { ok: false, reason: "last-track", tracks: ordered, clips: [...clips] };
  const affected = clips.filter((clip) => clip?.trackId === trackId);
  if (affected.length && !["move", "delete"].includes(strategy)) {
    return { ok: false, reason: "track-not-empty", tracks: ordered, clips: [...clips] };
  }

  let nextClips = [...clips];
  if (strategy === "move") {
    const destination = ordered.find((entry) => entry.id === destinationTrackId && entry.id !== trackId);
    if (!destination) return { ok: false, reason: "destination-not-found", tracks: ordered, clips: [...clips] };
    if (destination.locked) return { ok: false, reason: "track-locked", tracks: ordered, clips: [...clips] };
    if (affected.some((clip) => !isCompatible(clip, destination))) {
      return { ok: false, reason: "incompatible-track", tracks: ordered, clips: [...clips] };
    }
    nextClips = clips.map((clip) => clip?.trackId === trackId ? { ...clip, trackId: destination.id } : clip);
  } else if (strategy === "delete") {
    nextClips = clips.filter((clip) => clip?.trackId !== trackId);
  }

  return {
    ok: true,
    reason: null,
    tracks: ordered.filter((entry) => entry.id !== trackId).map((entry, order) => ({ ...entry, order })),
    clips: nextClips
  };
}
