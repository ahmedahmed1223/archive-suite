# Professional Multi-Track Montage Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backward-compatible Graphite Broadcast montage workspace with dynamic overlapping tracks, configurable magnetic editing, live transforms/filters/audio preview, and authoritative multi-track FFmpeg export.

**Architecture:** Keep project/store orchestration in `ProjectsPage.jsx`, move the workstation into focused montage components, and place all editing math in pure feature modules. Legacy `roughCuts` are normalized onto a derived magnetic `V1`; browser preview and FFmpeg export consume the same filter and render-graph registries so parameters cannot drift.

**Tech Stack:** React 19, Vitest/Testing Library, `@dnd-kit/core`, `wavesurfer.js`, Lucide React, Web Audio, HTML media elements, existing Node/FFmpeg export service.

---

## File Map

- `archive-app/src/features/montage/multiTrackModel.js`: track defaults, legacy normalization, time/frame math, clip move/snap/ripple/trim/split/link operations.
- `archive-app/src/features/montage/renderGraph.js`: deterministic active-layer graph shared by preview and export payloads.
- `archive-app/src/features/montage/filterRegistry.js`: filter parameter schema, validation, CSS preview mapping, and FFmpeg mapping identifiers.
- `archive-app/src/features/montage/previewEngine.js`: pure preview state plus media capability helpers; DOM media synchronization stays in the monitor component.
- `archive-app/src/components/montage/MontageWorkspace.jsx`: Graphite Broadcast dock layout and responsive drawer state.
- `archive-app/src/components/montage/MontageToolStrip.jsx`: selected tool, snapping/ripple/link preferences, zoom controls.
- `archive-app/src/components/montage/MultiTrackTimeline.jsx`: ruler, scroll viewport, dynamic track rows, playhead, drop context.
- `archive-app/src/components/montage/TrackHeader.jsx`: track identity and lock/hide/mute/solo/magnetic actions.
- `archive-app/src/components/montage/TimelineClip.jsx`: clip block, selection, trim handles, badges, thumbnails/waveform slots.
- `archive-app/src/components/montage/ProgramMonitor.jsx`: composited live preview and transport.
- `archive-app/src/components/montage/ClipInspectorPanel.jsx`: Video/Audio/Color/Effects editors and ordered filter stack.
- `archive-app/src/components/montage/MontageWorkspace.css`: dense token-based Graphite Broadcast geometry.
- `archive-app/src/pages/ProjectsPage.jsx`: integrates the extracted workspace and persists completed commands.
- `archive-app/src/features/projects/viewModel.js`: preserves optional multi-track fields in project/timeline exports.
- `archive-server/src/export/ffmpegPlan.js`: emits layered video/audio filter graphs while preserving legacy sequential output.

## Task 1: Dependencies and Pure Multi-Track Domain Model

**Files:**
- Modify: `archive-app/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `archive-app/src/features/montage/multiTrackModel.js`
- Create: `archive-app/src/features/montage/multiTrackModel.test.js`

- [ ] **Step 1: Add the approved focused dependencies**

Run:

```powershell
pnpm --filter @archive/app add @dnd-kit/core@^6.3.1 wavesurfer.js@^7.12.8
```

Expected: lockfile changes only for the two direct packages and their required transitive dependencies.

- [ ] **Step 2: Write failing normalization and track CRUD tests**

```js
import { describe, expect, it } from "vitest";
import {
  addTimelineTrack,
  createDefaultTracks,
  moveClipToTrack,
  normalizeMultiTrackProject,
  updateTimelineTrack
} from "./multiTrackModel.js";

describe("normalizeMultiTrackProject", () => {
  it("places legacy rough cuts sequentially on magnetic V1", () => {
    const project = normalizeMultiTrackProject({ roughCuts: [
      { id: "a", inSec: 0, outSec: 4, order: 0 },
      { id: "b", inSec: 2, outSec: 7, order: 1 }
    ] });
    expect(project.timelineTracks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "v1", type: "video", magnetic: true })
    ]));
    expect(project.roughCuts.map((clip) => [clip.trackId, clip.timelineStartSec])).toEqual([
      ["v1", 0], ["v1", 4]
    ]);
  });
});

it("adds and edits dynamic tracks immutably", () => {
  const tracks = createDefaultTracks();
  const added = addTimelineTrack(tracks, { type: "audio", name: "Music" });
  const updated = updateTimelineTrack(added, added.at(-1).id, { muted: true });
  expect(updated.at(-1)).toMatchObject({ type: "audio", name: "Music", muted: true });
  expect(tracks).not.toEqual(updated);
});

it("moves only compatible unlocked clips between tracks", () => {
  const result = moveClipToTrack({
    clips: [{ id: "c1", trackId: "v1", timelineStartSec: 0, inSec: 0, outSec: 3 }],
    tracks: [{ id: "v1", type: "video" }, { id: "a1", type: "audio" }],
    clipId: "c1",
    trackId: "a1",
    startSec: 5
  });
  expect(result.ok).toBe(false);
  expect(result.reason).toBe("incompatible-track");
});
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```powershell
pnpm --filter @archive/app exec vitest run src/features/montage/multiTrackModel.test.js
```

Expected: FAIL because `multiTrackModel.js` does not exist.

- [ ] **Step 4: Implement normalization and track operations**

Implement these exports with immutable arrays and deterministic IDs supplied through an optional `idFactory`:

```js
export const TRACK_TYPES = Object.freeze(["video", "audio", "title", "adjustment"]);
export const DEFAULT_TIMELINE_PREFERENCES = Object.freeze({
  snapping: true,
  snapInterval: "frame",
  rippleMode: "primary",
  allowGaps: true,
  linkAudioVideo: true,
  showWaveforms: true,
  showThumbnails: true
});

export function createDefaultTracks() {}
export function normalizeMultiTrackProject(project = {}) {}
export function addTimelineTrack(tracks, partial, { idFactory } = {}) {}
export function updateTimelineTrack(tracks, trackId, patch) {}
export function removeTimelineTrack({ tracks, clips, trackId, strategy, destinationTrackId }) {}
export function reorderTimelineTracks(tracks, activeId, overId) {}
export function moveClipToTrack(input) {}
```

- [ ] **Step 5: Add failing snap/ripple/overlap tests**

```js
it("snaps to the nearest frame and neighboring clip edge", () => {
  expect(resolveSnappedTime({ candidateSec: 4.019, fps: 25, snapping: true, targets: [2, 4] })).toBe(4);
});

it("ripples later clips on the magnetic primary track only", () => {
  const next = rippleAfterEdit({ clips, tracks, editedClipId: "a", deltaSec: 2, scope: "primary" });
  expect(next.find((clip) => clip.id === "b").timelineStartSec).toBe(6);
  expect(next.find((clip) => clip.id === "overlay").timelineStartSec).toBe(1);
});

it("detects true overlap per track", () => {
  expect(findTrackCollisions([
    { id: "a", trackId: "v1", timelineStartSec: 0, inSec: 0, outSec: 4 },
    { id: "b", trackId: "v1", timelineStartSec: 3, inSec: 0, outSec: 2 }
  ])).toEqual([expect.objectContaining({ firstId: "a", secondId: "b" })]);
});
```

- [ ] **Step 6: Verify RED, implement minimal editing math, then verify GREEN**

Run the targeted test before and after implementing:

```js
export function secondsToFrame(seconds, fps) {}
export function frameToSeconds(frame, fps) {}
export function resolveSnappedTime(input) {}
export function rippleAfterEdit(input) {}
export function findTrackCollisions(clips) {}
export function trimMultiTrackClip(input) {}
export function splitMultiTrackClip(input) {}
```

Expected final result: all `multiTrackModel.test.js` tests pass.

- [ ] **Step 7: Commit**

```powershell
git add archive-app/package.json pnpm-lock.yaml archive-app/src/features/montage/multiTrackModel*
git commit -m "feat(montage): add multitrack domain model"
```

## Task 2: Render Graph, Filter Registry, and Project Compatibility

**Files:**
- Create: `archive-app/src/features/montage/filterRegistry.js`
- Create: `archive-app/src/features/montage/filterRegistry.test.js`
- Create: `archive-app/src/features/montage/renderGraph.js`
- Create: `archive-app/src/features/montage/renderGraph.test.js`
- Modify: `archive-app/src/features/projects/viewModel.js`
- Modify: `archive-app/src/features/projects/viewModel.test.js`

- [ ] **Step 1: Write failing filter validation tests**

```js
it("normalizes editable filter parameters and drops unknown keys", () => {
  expect(normalizeClipFilter({ id: "f1", type: "brightness", params: { amount: 4, injected: 9 } }))
    .toEqual({ id: "f1", type: "brightness", enabled: true, order: 0, params: { amount: 1 } });
});

it("maps supported filters to CSS preview values", () => {
  expect(buildCssFilter([{ type: "contrast", enabled: true, params: { amount: 1.2 } }]))
    .toBe("contrast(1.2)");
});
```

- [ ] **Step 2: Verify RED and implement the registry**

Export `FILTER_DEFINITIONS`, `normalizeClipFilter`, `normalizeClipFilters`, `buildCssFilter`, and `isPreviewSupported`. Define numeric ranges for brightness, contrast, saturation, grayscale, sepia, blur, temperature, vignette, sharpen, and chroma key. Unsupported CSS effects return `exportOnly: true` rather than disappearing.

- [ ] **Step 3: Write failing render-graph tests**

```js
it("returns active layered clips ordered by track then clip", () => {
  const graph = buildRenderGraph(project, itemsById);
  expect(getActiveLayers(graph, 3).map((layer) => layer.clipId)).toEqual(["v1-a", "v2-a", "title-a"]);
});

it("preserves legacy sequential exports", () => {
  const timeline = buildProjectTimeline(legacyProject, itemsById);
  expect(timeline.clips.map((clip) => clip.startSec)).toEqual([0, 4]);
});
```

- [ ] **Step 4: Verify RED and implement graph construction**

```js
export function buildRenderGraph(project, itemsById) {}
export function getActiveLayers(graph, playheadSec) {}
export function getTimelineEndSec(graph) {}
export function serializeMultiTrackTimeline(graph) {}
```

The graph must include normalized tracks, absolute start/end, source in/out, transform, filters, audio, transition, keyframes, media source, and validation warnings.

- [ ] **Step 5: Extend project timeline compatibility**

Update `createRoughCutValue`, `createProjectValue`, and `buildProjectTimeline` so optional fields survive normalization and JSON export. Keep CMX3600 output focused on primary video; return warnings for overlays/audio structures it cannot encode.

- [ ] **Step 6: Run targeted and project regressions**

```powershell
pnpm --filter @archive/app exec vitest run src/features/montage/filterRegistry.test.js src/features/montage/renderGraph.test.js src/features/projects/viewModel.test.js src/features/montage/timelineModel.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add archive-app/src/features/montage archive-app/src/features/projects/viewModel*
git commit -m "feat(montage): share render graph and filter registry"
```

## Task 3: Graphite Broadcast Workspace Shell

**Files:**
- Create: `archive-app/src/components/montage/MontageWorkspace.jsx`
- Create: `archive-app/src/components/montage/MontageWorkspace.test.jsx`
- Create: `archive-app/src/components/montage/MontageWorkspace.css`
- Create: `archive-app/src/components/montage/MontageToolStrip.jsx`
- Modify: `archive-app/src/pages/ProjectsPage.jsx`

- [ ] **Step 1: Write a failing workspace structure test**

```jsx
render(<MontageWorkspace
  header={<div>Header</div>}
  mediaBin={<div>Media</div>}
  monitor={<div>Monitor</div>}
  inspector={<div>Inspector</div>}
  timeline={<div>Timeline</div>}
/>);
expect(screen.getByRole("region", { name: "مكتبة مواد المشروع" })).toHaveTextContent("Media");
expect(screen.getByRole("region", { name: "شاشة البرنامج" })).toHaveTextContent("Monitor");
expect(screen.getByRole("region", { name: "الخط الزمني" })).toHaveTextContent("Timeline");
```

- [ ] **Step 2: Verify RED and implement the dock shell**

Use semantic regions, CSS grid, a 22%/fluid/27% upper area, and full-width timeline. Apply token-driven graphite surfaces, one-pixel separators, 2-4px radii, 28-36px toolbars, and compact typography. At narrow widths, Media Bin and Inspector become drawers while Monitor and Timeline stay mounted.

- [ ] **Step 3: Write failing toolbar preference tests**

```jsx
await user.click(screen.getByRole("button", { name: "الالتقاط المغناطيسي" }));
expect(onPreferencesChange).toHaveBeenCalledWith(expect.objectContaining({ snapping: false }));
await user.selectOptions(screen.getByLabelText("نطاق Ripple"), "all-unlocked");
expect(onPreferencesChange).toHaveBeenLastCalledWith(expect.objectContaining({ rippleMode: "all-unlocked" }));
```

- [ ] **Step 4: Implement tool strip and integrate the shell**

Keep `ProjectsPage.jsx` responsible for selected project and persistence. Replace the current nested montage section with `MontageWorkspace` slots; do not move unrelated project-list behavior.

- [ ] **Step 5: Run component, a11y, and build checks**

```powershell
pnpm --filter @archive/app exec vitest run src/components/montage/MontageWorkspace.test.jsx src/__tests__/a11y/components.a11y.test.jsx
pnpm --filter @archive/app run build:cloud
```

- [ ] **Step 6: Commit**

```powershell
git add archive-app/src/components/montage/MontageWorkspace* archive-app/src/components/montage/MontageToolStrip.jsx archive-app/src/pages/ProjectsPage.jsx
git commit -m "feat(montage): add graphite broadcast workspace"
```

## Task 4: Dynamic Multi-Track Timeline and Editing Gestures

**Files:**
- Create: `archive-app/src/components/montage/MultiTrackTimeline.jsx`
- Create: `archive-app/src/components/montage/MultiTrackTimeline.test.jsx`
- Create: `archive-app/src/components/montage/TrackHeader.jsx`
- Create: `archive-app/src/components/montage/TimelineClip.jsx`
- Modify: `archive-app/src/pages/ProjectsPage.jsx`
- Retire after integration: `archive-app/src/components/montage/TimelineTrack.jsx`

- [ ] **Step 1: Write failing track CRUD UI tests**

Render two tracks and assert that add, rename, mute, solo, lock, magnetic, reorder, and guarded delete emit domain commands. Deleting a non-empty track must open choices: move clips, delete clips, or cancel.

```jsx
await user.click(screen.getByRole("button", { name: "إضافة مسار فيديو" }));
expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({ type: "track.add", trackType: "video" }));
await user.click(screen.getByRole("button", { name: "كتم مسار الحوار" }));
expect(onCommand).toHaveBeenCalledWith({ type: "track.patch", trackId: "a1", patch: { muted: true } });
```

- [ ] **Step 2: Verify RED and implement track rows and headers**

Use a fixed logical-start header column and one horizontal scrolling time surface. Track rows share a CSS variable for pixels per second. The playhead moves through a CSS variable/ref and must not update React state on every animation frame.

- [ ] **Step 3: Write failing clip movement/keyboard tests**

```jsx
const clip = screen.getByRole("button", { name: /قصاصة المقابلة/ });
clip.focus();
await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({ type: "clip.nudge", frames: 1 }));
await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({ type: "clip.move-track", direction: -1 }));
```

- [ ] **Step 4: Implement dnd-kit sensors and domain-command dispatch**

Use pointer/touch/keyboard sensors and a drag overlay. Convert physical coordinates to logical timeline seconds once in the view. Pass candidate `trackId/startSec` to `moveClipToTrack`; show its rejection reason without mutating project state. Trim handles dispatch one coalesced command at pointer-up.

- [ ] **Step 5: Integrate timeline commands with persistence/undo**

Create one project patch per completed add/move/trim/split/delete/link gesture. Keep transient drag/trim preview local. Preserve the current selected clip and inspector behavior.

- [ ] **Step 6: Run targeted and montage regressions**

```powershell
pnpm --filter @archive/app exec vitest run src/components/montage/MultiTrackTimeline.test.jsx src/features/montage/multiTrackModel.test.js src/features/montage/timelineModel.test.js
```

- [ ] **Step 7: Commit**

```powershell
git add archive-app/src/components/montage archive-app/src/pages/ProjectsPage.jsx
git commit -m "feat(montage): add dynamic multitrack timeline"
```

## Task 5: Inspector, Editable Filters, and Keyframes

**Files:**
- Create: `archive-app/src/components/montage/ClipInspectorPanel.jsx`
- Create: `archive-app/src/components/montage/ClipInspectorPanel.test.jsx`
- Create: `archive-app/src/components/montage/FilterStackEditor.jsx`
- Create: `archive-app/src/components/montage/KeyframeEditor.jsx`
- Modify: `archive-app/src/pages/ProjectsPage.jsx`

- [ ] **Step 1: Write failing in-place inspector tests**

```jsx
await user.clear(screen.getByLabelText("المقياس الأفقي"));
await user.type(screen.getByLabelText("المقياس الأفقي"), "1.25");
await user.tab();
expect(onPatchClip).toHaveBeenCalledWith("c1", { transform: expect.objectContaining({ scaleX: 1.25 }) });

await user.click(screen.getByRole("button", { name: "إضافة فلتر" }));
await user.click(screen.getByRole("option", { name: "Brightness" }));
expect(onPatchClip).toHaveBeenCalledWith("c1", expect.objectContaining({ filters: [expect.objectContaining({ type: "brightness" })] }));
```

- [ ] **Step 2: Verify RED and implement tabbed inspector**

Provide Video, Audio, Color, Effects, and Metadata tabs. Use sliders plus numeric inputs; commit on pointer-up/blur. Ordered filters support enable, reorder, duplicate, edit, and remove. Export-only effects show a badge.

- [ ] **Step 3: Write failing keyframe tests**

Assert add/update/delete for transform, opacity, filter parameters, volume, and pan. Keyframe time is clip-relative, snapped through the pure model, and cannot exceed clip duration.

- [ ] **Step 4: Implement keyframe editor and project integration**

Keyframe diamonds in the inspector and timeline share IDs. Changing the playhead selects the nearest keyframe but does not create one automatically.

- [ ] **Step 5: Run tests and commit**

```powershell
pnpm --filter @archive/app exec vitest run src/components/montage/ClipInspectorPanel.test.jsx src/features/montage/filterRegistry.test.js
git add archive-app/src/components/montage archive-app/src/pages/ProjectsPage.jsx
git commit -m "feat(montage): edit filters and keyframes in place"
```

## Task 6: Program Monitor and Audio Waveforms

**Files:**
- Create: `archive-app/src/features/montage/previewEngine.js`
- Create: `archive-app/src/features/montage/previewEngine.test.js`
- Create: `archive-app/src/components/montage/ProgramMonitor.jsx`
- Create: `archive-app/src/components/montage/ProgramMonitor.test.jsx`
- Create: `archive-app/src/components/montage/TimelineWaveform.jsx`
- Modify: `archive-app/src/pages/ProjectsPage.jsx`

- [ ] **Step 1: Write failing active-layer and interpolation tests**

```js
it("interpolates transform and opacity keyframes at the playhead", () => {
  expect(resolvePreviewLayer(layer, 2)).toMatchObject({
    opacity: 0.5,
    transform: expect.objectContaining({ x: 50 })
  });
});

it("marks unsupported filters as export-only", () => {
  expect(resolvePreviewLayer(chromaLayer, 1).warnings).toContain("effect-export-only:chroma-key");
});
```

- [ ] **Step 2: Verify RED and implement pure preview state**

Export `resolvePreviewLayer`, `resolvePreviewFrame`, `interpolateKeyframes`, `createPreviewCapabilities`, and `shouldUseProxy`.

- [ ] **Step 3: Write failing Program Monitor tests**

Use injected media-element factories. Assert layered transforms/CSS filters, transition overlap, frame stepping, proxy badge, export-only warning, transport callbacks, and cleanup of media/audio resources on unmount.

- [ ] **Step 4: Implement synchronized monitor and Web Audio controls**

Use `requestVideoFrameCallback` when available and a timed fallback otherwise. Keep at most the active layers plus transition neighbors decoded. Create gain/panner nodes for active audio and release nodes/object URLs deterministically.

- [ ] **Step 5: Add waveform wrapper with dynamic wavesurfer import**

Use precomputed peaks when present. For missing/large audio, retain the existing deterministic placeholder waveform and expose a status label. The timeline, not wavesurfer, owns clip position.

- [ ] **Step 6: Run tests, build, and commit**

```powershell
pnpm --filter @archive/app exec vitest run src/features/montage/previewEngine.test.js src/components/montage/ProgramMonitor.test.jsx src/features/montage/waveform.test.js
pnpm --filter @archive/app run build:cloud
git add archive-app/src/features/montage archive-app/src/components/montage archive-app/src/pages/ProjectsPage.jsx
git commit -m "feat(montage): preview layered video and audio"
```

## Task 7: Authoritative Multi-Track FFmpeg Export

**Files:**
- Modify: `archive-server/src/export/ffmpegPlan.js`
- Modify: `archive-server/scripts/verify-export.mjs`
- Modify: `archive-app/src/features/projects/exportClient.js`
- Modify: `archive-app/src/features/projects/exportClient.test.js`

- [ ] **Step 1: Write failing layered filter-graph tests**

```js
const args = buildFfmpegArgs({ clips, tracks, settings: { resolution: "1920x1080", fps: 25 } });
expect(args.join(" ")).toMatch(/overlay=/);
expect(args.join(" ")).toMatch(/amix=inputs=2/);
expect(args.join(" ")).toMatch(/eq=.*brightness/);
expect(args.join(" ")).toMatch(/volume=/);
```

Add cases for title overlay, opacity, transform, crop, transitions, fades, muted tracks, solo tracks, keyframed parameters, missing source, and legacy sequential clips.

- [ ] **Step 2: Verify RED and refactor FFmpeg planning into stages**

Keep argv arrays only; never construct shell command strings. Implement input normalization, per-clip trim/filter chains, track compositing, audio mixing, final format mapping, and stable labels. Legacy clips continue through the existing concat path when no multi-track features are present.

- [ ] **Step 3: Extend export preflight and error reporting**

Return fatal errors for missing sources/invalid durations and warnings for preview/export differences or EDL loss. Preserve retry behavior and recent output metadata.

- [ ] **Step 4: Run server/app export regressions**

```powershell
pnpm --filter archive-server exec tsx scripts/verify-export.mjs
pnpm --filter @archive/app exec vitest run src/features/projects/exportClient.test.js src/features/projects/viewModel.test.js
```

- [ ] **Step 5: Run a live layered MP4 smoke export**

Run:

```powershell
pnpm --filter archive-server run verify:cloud-live
```

Expected: layered MP4 output has non-zero size, FFprobe reports the requested dimensions/FPS, and the live test cleans all input/output keys.

- [ ] **Step 6: Commit**

```powershell
git add archive-server/src/export/ffmpegPlan.js archive-server/scripts/verify-export.mjs archive-app/src/features/projects/exportClient* archive-app/src/features/projects/viewModel*
git commit -m "feat(montage): export layered timelines with ffmpeg"
```

## Task 8: RTL, Accessibility, Performance, Visual Verification, and Roadmap Closure

**Files:**
- Modify: `archive-app/src/components/montage/*.jsx`
- Modify: `archive-app/src/components/montage/MontageWorkspace.css`
- Modify: `archive-app/src/__tests__/a11y/components.a11y.test.jsx`
- Create: `archive-app/src/features/montage/multiTrackPerformance.test.js`
- Modify: `TASKS.md`

- [ ] **Step 1: Add failing RTL and accessibility tests**

Assert logical right-to-left time coordinates, visible focus, named icon buttons, pressed states, track/clip timing text, drawer focus restoration, and keyboard-only clip move/trim/split/lock/mute/undo.

- [ ] **Step 2: Add the 500-clip/12-track performance fixture**

```js
const project = makeTimelineFixture({ tracks: 12, clips: 500 });
const started = performance.now();
const graph = buildRenderGraph(project, itemsById);
expect(graph.clips).toHaveLength(500);
expect(performance.now() - started).toBeLessThan(100);
```

Also assert visible-range selection returns only clips intersecting the viewport plus overscan.

- [ ] **Step 3: Implement viewport culling and stable render boundaries**

Memoize track/clip components by stable IDs and revision fields. Use refs/CSS variables for playhead and drag preview. Verify no global listener, object URL, wavesurfer instance, or AudioNode survives unmount.

- [ ] **Step 4: Run the complete automated verification**

```powershell
pnpm --filter @archive/app test
pnpm --filter @archive/app run verify
pnpm --filter @archive/app run build:cloud
pnpm --filter archive-server test
pnpm --filter archive-server run verify
```

Expected: all commands exit 0.

- [ ] **Step 5: Perform visual and interaction verification**

At desktop 1440×900 and mobile 390×844 verify:

- Graphite Broadcast panel density and one-pixel separators.
- No text clipping or overlapping controls.
- Timeline RTL direction, ruler, playhead, zoom, dynamic tracks, waveform, trim handles, and clip colors.
- Media Bin/Inspector drawers on mobile.
- Drag, keyboard move, snap/ripple toggles, filter edits, live preview, undo/redo, and export preflight.
- Console contains no errors and the timeline canvas is nonblank.

- [ ] **Step 6: Mark only the completed roadmap item**

Change the `TASKS.md` multi-track timeline item from `[ ]` to `[x]` with the commit date, component names, and test evidence. Do not mark advanced mastering or future effects complete.

- [ ] **Step 7: Commit and push master**

```powershell
git add archive-app/src/components/montage archive-app/src/features/montage archive-app/src/pages/ProjectsPage.jsx archive-app/src/__tests__/a11y/components.a11y.test.jsx TASKS.md
git commit -m "feat(montage): complete professional multitrack workspace"
git push origin master
```
