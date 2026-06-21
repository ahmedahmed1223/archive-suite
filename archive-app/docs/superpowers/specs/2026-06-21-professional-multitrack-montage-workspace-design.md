# Professional Multi-Track Montage Workspace Design

**Date:** 2026-06-21

**Status:** Approved for implementation

## Summary

Transform the existing project montage surface into a dense professional editing workspace while preserving the current archive-first workflow, `roughCuts` projects, JSON/EDL exports, and server-side FFmpeg output. The selected visual direction is **Graphite Broadcast**: neutral graphite surfaces, one-pixel panel separators, compact toolbars, small radii, functional clip colors, and no floating dashboard cards inside the editing surface.

The workspace uses a balanced production-desk layout: project media and import tools on the start side, a large program monitor in the center, an inspector on the end side, and a full-width multi-track timeline below. Tracks are dynamic, support real overlap, and expose configurable magnetic, snapping, ripple, linking, mute, solo, and locking behavior.

## Goals

- Support dynamic video, audio, title, and adjustment tracks.
- Support true overlap and compositing rather than using tracks only as labels.
- Keep the primary `V1` track magnetic by default while allowing free positioning elsewhere.
- Make magnetic editing, ripple behavior, snap interval, gaps, and linked audio/video configurable.
- Provide live preview for transforms, opacity, blend mode, editable basic filters, audio levels, titles, and core transitions.
- Keep FFmpeg as the authoritative export renderer for MP4 and delivery packages.
- Open legacy projects without an explicit migration step.
- Keep the interface usable in RTL, by keyboard, and on constrained screens.
- Split the current large `ProjectsPage.jsx` montage surface into focused components and pure model modules.

## Non-Goals

- Recreating every feature of Premiere Pro, Resolve, or Avid in one release.
- GPU color grading, node graphs, motion tracking, multicam synchronization, or third-party plugin hosting.
- Replacing FFmpeg with Remotion or a browser-only renderer.
- Making mobile the primary precision-editing surface. Mobile supports review, coarse edits, inspection, and export; desktop remains the full editing target.

## Visual System: Graphite Broadcast

The editing workspace is an application surface, not a collection of cards.

- Neutral graphite panel levels with semantic tokens, not hard-coded blue/slate themes.
- One-pixel separators between docked panels and timeline rows.
- Two- to four-pixel radii for compact controls and clips; eight pixels only for dialogs.
- Toolbars are 28-36 pixels tall with Lucide icons, tooltips, pressed states, and shortcuts.
- Clip colors indicate media role or user color. Red is reserved for errors/playhead, amber for warnings/transition edges, and green for ready/saved states.
- Text is compact and tabular where timecode or numeric values are shown.
- The timeline and monitor get the majority of vertical space; import, inspector, settings, and export remain docked and collapsible.
- No marketing copy, decorative gradients, nested cards, or oversized headings inside the workstation.

## Workspace Layout

### Project Header

Shows the project/sequence name, save state, FPS, resolution, aspect ratio, active duration, undo/redo, workspace layout selector, and export command.

### Tool Strip

Contains selection, blade, trim, ripple, slip, snapping, linking, marker, and keyframe tools. Tool state is explicit and keyboard accessible. Magnetic editing, ripple scope, and snap interval open compact popovers rather than occupying the inspector.

### Media Bin

Provides project-scoped sources, search and readiness filters, list/grid density, proxy/original status, drag-to-track, explicit import, and archive attachment. Dragging a source onto an incompatible track is rejected with a useful message.

### Program Monitor

Displays the composited result at the playhead, transport controls, frame stepping, timecode, safe-area overlays, proxy quality, and full-screen mode. Mark In/Out remains available for source preparation.

### Inspector

Uses stable tabs: Video, Audio, Color, Effects, and Metadata. Controls use numeric inputs plus sliders where useful. Filters are an ordered editable stack with enable/disable, parameters, reorder, duplicate, and remove operations. Transform, opacity, crop, blend mode, volume, pan, fade, and keyframes are editable without replacing the clip.

### Multi-Track Timeline

Occupies the full width below the upper workspace. A fixed track-header column remains visible while the timeline canvas scrolls horizontally. Each track supports rename, reorder, resize, lock, hide/mute, solo, magnetic mode, and deletion with safeguards. Users can add video, audio, title, and adjustment tracks.

The ruler, markers, playhead, selection range, transition handles, linked groups, waveform, thumbnails, keyframes, comments, and invalid-media states share one time coordinate system. The primary video story track is magnetic by default; other tracks are freely positioned unless configured otherwise.

### Export Center

Remains in the workstation but opens as a focused dock/dialog. It shows media readiness, validation errors, JSON/EDL/MP4/delivery-package choices, FFmpeg capability, progress, retry, and recent outputs.

## Data Model

All new fields are optional so stored projects remain valid.

```js
project.timelineTracks = [
  {
    id: "v1",
    type: "video", // video | audio | title | adjustment
    name: "القصة",
    order: 0,
    height: "medium",
    locked: false,
    hidden: false,
    muted: false,
    solo: false,
    magnetic: true,
    volumeDb: 0
  }
];

project.timelinePreferences = {
  snapping: true,
  snapInterval: "frame", // frame | 0.1s | 0.5s | 1s
  rippleMode: "primary", // off | primary | all-unlocked
  allowGaps: true,
  linkAudioVideo: true,
  showWaveforms: true,
  showThumbnails: true
};

roughCut = {
  ...existingFields,
  trackId: "v1",
  timelineStartSec: 0,
  linkedGroupId: null,
  opacity: 1,
  blendMode: "normal",
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, crop: null },
  filters: [{ id, type, enabled, order, params }],
  audio: { volumeDb: 0, pan: 0, muted: false, fadeInSec: 0, fadeOutSec: 0 },
  keyframes: [{ id, property, timeSec, value, easing }]
};
```

Legacy projects receive a derived default `V1` track in memory. Clips without `timelineStartSec` are positioned sequentially by `order`. The project is only persisted in the expanded shape after the user performs a timeline edit, preventing mandatory migrations.

## Timeline Engine

Pure functions in the montage feature layer own all editing math. React components never calculate clip collisions or mutate arrays directly.

Core responsibilities:

- Normalize dynamic tracks and legacy clips.
- Resolve timeline duration and per-track layout.
- Convert frames, seconds, pixels, and timecode.
- Place and move clips across compatible tracks.
- Snap to frame boundaries, clip edges, markers, playhead, and keyframes.
- Apply ripple edits according to scope while respecting locked tracks.
- Trim, roll, slip, split, duplicate, link, unlink, and delete clips immutably.
- Detect overlap, missing sources, invalid duration, and unsupported effects.
- Build a deterministic render graph for preview and export.

`@dnd-kit/core` supplies pointer, touch, and keyboard sensors plus drag overlays. Domain functions decide whether a drop is valid and return the next project state. This keeps drag behavior testable without a browser.

## Preview Pipeline

The preview renderer consumes the normalized render graph at the current playhead.

- Video/title layers are ordered by track and clip order.
- Two synchronized video elements may be active during transitions; inactive layers are paused and released.
- CSS transforms, opacity, crop, blend mode, and supported CSS filters provide immediate visual feedback.
- Core transitions use synchronized overlap and opacity/transform interpolation.
- Audio uses Web Audio gain and stereo panner nodes for active clips.
- `requestVideoFrameCallback` is preferred for playhead synchronization, with time-update fallback.
- Proxy media is preferred for preview when available; exports always resolve the original source unless explicitly overridden.

Preview support is capability-based. Unsupported or export-only effects show a clear badge and retain their FFmpeg configuration rather than silently dropping it.

## Audio and Waveforms

`wavesurfer.js` is dynamically imported when waveforms are enabled. Precomputed peaks are preferred for long media; browser decoding is limited to safe file sizes. The timeline owns positioning while wavesurfer provides waveform rendering and region/envelope primitives. Audio tracks support mute, solo, volume, pan, fades, and volume keyframes. A master meter indicates clipping but is not a mastering suite in this phase.

## Filters, Effects, and Keyframes

Filters use a registry rather than free-form FFmpeg strings.

```js
filterRegistry.brightness = {
  label: "Brightness",
  preview: "css",
  export: "ffmpeg",
  params: { amount: { min: -1, max: 1, step: 0.01, default: 0 } }
};
```

Each definition declares editable parameters, preview support, FFmpeg mapping, defaults, and validation. The initial registry includes brightness, contrast, saturation, grayscale, sepia, blur, sharpen, temperature/tint approximation, vignette, and chroma key where browser capability permits. Transform, opacity, volume, pan, and filter parameters may be keyframed. Keyframes snap to frames and remain clip-relative.

## Export Pipeline

The existing `buildProjectTimeline` expands into a multi-track render graph while retaining the old sequential output for legacy JSON/EDL consumers.

- JSON includes tracks, absolute timing, effects, keyframes, links, markers, and settings.
- EDL exports the primary video sequence and emits warnings for structures that CMX3600 cannot represent.
- MP4 maps layers, overlays, filters, audio mixing, fades, and transitions into deterministic FFmpeg filter graphs.
- Preflight blocks export only for fatal errors and lists non-fatal degradations.
- Export jobs persist progress, logs, output metadata, retry state, and renderer version.

Browser preview and FFmpeg export share the filter/transition registry so parameter names and defaults cannot drift. FFmpeg remains authoritative where visual parity is impossible.

## Component Boundaries

`ProjectsPage.jsx` keeps project selection and high-level store orchestration. The workstation moves into focused modules:

- `components/montage/MontageWorkspace.jsx`: dock layout and responsive panel state.
- `components/montage/WorkspaceHeader.jsx`: project state and global commands.
- `components/montage/MontageToolStrip.jsx`: active edit tool and timeline preferences.
- `components/montage/MediaBin.jsx`: project media and drag sources.
- `components/montage/ProgramMonitor.jsx`: composited preview and transport.
- `components/montage/ClipInspector.jsx`: video/audio/color/effect editors.
- `components/montage/MultiTrackTimeline.jsx`: scroll surface, ruler, playhead, tracks, clips.
- `components/montage/TrackHeader.jsx`: per-track controls.
- `components/montage/TimelineClip.jsx`: visual clip, trim handles, thumbnails, waveform, badges.
- `features/montage/multiTrackModel.js`: pure normalization and editing operations.
- `features/montage/renderGraph.js`: preview/export render graph.
- `features/montage/filterRegistry.js`: parameter schema and renderer mappings.
- `features/montage/previewEngine.js`: media synchronization and capability checks.

Large components are dynamically imported from the projects page so non-montage routes do not pay their bundle cost.

## State, Undo, and Persistence

Fine pointer movement is transient local state. A completed gesture creates one project patch and one undo entry, avoiding writes on every pixel. The editor uses a bounded command history for undo/redo and coalesces slider/keyframe edits until pointer release or blur. Autosave uses the existing project persistence path and exposes saving, saved, offline, and failed states.

## Error Handling and Recovery

- Invalid drops return a reason and leave project state unchanged.
- Missing or offline sources remain visible as disabled clips with relink actions.
- Preview decoding failures fall back to thumbnail/audio indicators and do not corrupt edits.
- An effect unsupported in preview is labeled export-only.
- FFmpeg errors retain the export job, sanitized command summary, logs, and retry action.
- Failed persistence leaves the local undoable state intact and offers retry/reload comparison.
- Deleting a non-empty track requires choosing move clips, delete clips, or cancel.

## Performance

- Render only visible timeline time ranges plus overscan.
- Memoize track and clip components by stable IDs and revision fields.
- Keep playhead movement in refs/CSS variables rather than rerendering the entire workspace every frame.
- Dynamically import dnd-kit, wavesurfer, and preview modules when montage is opened.
- Prefer precomputed thumbnails and waveform peaks.
- Limit concurrently decoded preview media and release object URLs and audio nodes promptly.

The initial acceptance target is smooth editing of 500 clips across 12 tracks on a current desktop browser, with no full workspace rerender during playback.

## RTL, Accessibility, and Responsive Behavior

- Timeline time increases from the right in RTL, while media controls retain familiar temporal icon meaning.
- All positioning uses logical intent in the model; the view converts to RTL/LTR coordinates.
- Every toolbar tool has a name, tooltip, pressed state, shortcut, and keyboard access.
- Keyboard users can move a selected clip by frame/second, change track, trim edges, split, lock, mute, and undo.
- Focus remains visible and returns predictably after dialogs.
- Track headers and clips expose type, timing, state, and selection to assistive technology.
- On mobile, the monitor and timeline remain primary; Media Bin and Inspector become drawers. Precision drag is supplemented by numeric editing and stepper controls.

## Testing Strategy

### Pure Logic

- Legacy normalization and default-track derivation.
- Dynamic track CRUD and ordering.
- Cross-track move compatibility.
- Snap targets and frame rounding.
- Magnetic/ripple behavior and locked-track protection.
- Overlap, trim, roll, slip, split, linking, gaps, and duration.
- Filter parameter validation and render-graph determinism.
- JSON/EDL compatibility and FFmpeg graph construction.

### Components

- Add, rename, lock, mute, solo, reorder, and delete tracks.
- Drag media into tracks and clips between tracks.
- Keyboard clip movement and trim controls.
- Inspector updates transforms, filters, audio, and keyframes in place.
- Program monitor capability and export-only fallbacks.
- Undo coalesces one gesture into one history entry.

### Integration and Visual

- Legacy project opens and exports unchanged.
- Multi-track project persists and reloads.
- MP4 smoke export validates layered video and mixed audio.
- Desktop and mobile RTL screenshots verify panel geometry and text containment.
- Axe checks toolbars, dialogs, track controls, and focus order.
- Performance fixture validates 500 clips/12 tracks and checks for leaked media nodes/object URLs.

## Delivery Sequence

1. Pure multi-track model and backward-compatible normalization.
2. Graphite workspace shell and component extraction.
3. Dynamic tracks, ruler, selection, drag/drop, snap, ripple, trim, split, and undo.
4. Program monitor render graph and live transforms/filters/transitions.
5. Waveforms, audio mixing, fades, and keyframes.
6. Multi-track FFmpeg export and delivery preflight.
7. RTL, accessibility, mobile drawers, performance, and visual verification.

Each sequence item must leave the application usable, tested, and committed on `master` before the next item begins.
