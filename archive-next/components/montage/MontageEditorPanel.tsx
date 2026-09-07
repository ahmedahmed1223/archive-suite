"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createArchiveApiClient } from "@/lib/archive-api";
import MediaBin, { type MaterialBinItem } from "./MediaBin";
import TimelineCanvas from "./TimelineCanvas";
import ExportDrawer from "./ExportDrawer";
import {
  buildPresenceSnapshot,
  type PresenceSnapshot,
} from "@/lib/montage-presence";
import {
  redoEditor,
  reduceEditor,
  serializeRevision,
  undoEditor,
  type EditorAction,
  type EditorState,
} from "@/lib/montage-editor";
import type { RationalFrameRate, TimecodeMode } from "@/lib/timecode";

export type MontageEditorCopy = {
  panelAriaLabel: string;
  undoButton: string;
  redoButton: string;
  saveRevision: string;
  savingStatus: string;
  savedNewRevision: string;
  saveFailed: string;
  conflictPrefix: string;
  conflictSuffix: string;
  clipsUnit: string;
  presenceLabel: string;
  noOtherEditors: string;
  previewCmx: string;
  interchangeTitle: string;
  previewOnlyHint: string;
  previewAccepted: string;
  previewRejected: string;
  previewFailed: string;
  reelMapping: string;
  applyCmx: string;
};

type MontageEditorPanelProps = {
  projectId: string;
  initialState: EditorState;
  fps?: number;
  frameRate?: RationalFrameRate;
  timecodeMode?: TimecodeMode;
  materials: MaterialBinItem[];
  /** Poll interval (ms) for the collaboration presence surface. */
  presencePollMs?: number;
  /** Full dictionary section — passed by the studio page. */
  copy: MontageEditorCopy & {
    timelineAriaLabel: string;
    selectHint: string;
    selectedHint: string;
    binAriaLabel: string;
    materialsListLabel: string;
    emptyBin: string;
    drawerAriaLabel: string;
    exportTitle: string;
    presetGroupLabel: string;
    runQc: string;
    startExport: string;
    qcRequiredHint: string;
  };
};

/**
 * V1.5 Task 5/6: the editing surface. Owns editor state locally; saving and
 * exporting go through the archive API client (same contract as the rest of
 * the app). A short polling loop derives the live-collab presence snapshot
 * from the server; the Reverb/WS transport can replace the poll later
 * without touching this component.
 */
export default function MontageEditorPanel({
  projectId,
  initialState,
  fps = 25,
  frameRate,
  timecodeMode = "non_drop",
  materials,
  presencePollMs = 15_000,
  copy,
}: MontageEditorPanelProps) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<EditorState>(initialState);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [cmxEdl, setCmxEdl] = useState("");
  const [cmxPreview, setCmxPreview] = useState<{ accepted: Array<{ reel: string }>; rejected: unknown[] } | null>(null);
  const [reelMappings, setReelMappings] = useState<Record<string, string>>({});
  const [cmxStatus, setCmxStatus] = useState("");
  const [qcReady, setQcReady] = useState(false);
  const [presence, setPresence] = useState<PresenceSnapshot>({ projectId, editors: [] });

  const dispatch = useCallback(
    (action: EditorAction) => setState((current) => reduceEditor(current, action, fps)),
    [fps],
  );

  const undo = useCallback(() => setState((c) => undoEditor(c)), []);
  const redo = useCallback(() => setState((c) => redoEditor(c)), []);

  // Any timeline edit invalidates a previous export verdict.
  useEffect(() => {
    setQcReady(false);
  }, [state.timeline]);

  // Presence poll — safe against unmount and transient errors.
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await api.collaborationPresence(`montage:${projectId}`);
        if (cancelled || !res.ok) return;
        const participants = (res.participants ?? [])
          .filter((p) => p.status === "editing" || p.status === "viewing")
          .map((p) => ({
            userId: p.userId,
            displayName: p.displayName,
            lastSeenAt: p.lastSeenAt ? Date.parse(p.lastSeenAt) : 0,
          }));
        setPresence(buildPresenceSnapshot(projectId, participants as never, Date.now()));
      } catch {
        // Presence is best-effort; ignore network blips.
      }
    };
    void tick();
    pollRef.current = window.setInterval(tick, presencePollMs);
    return () => {
      cancelled = true;
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, [api, projectId, presencePollMs]);

  const saveRevision = useCallback(async () => {
    setSaveStatus(copy.savingStatus);
    try {
      const res = await api.montageSaveRevision(projectId, serializeRevision(state));
      if (res.ok) {
        const saved = res as { revisionNumber?: number };
        if (typeof saved.revisionNumber === "number") {
          const revisionNumber = saved.revisionNumber;
          setState((current) => ({ ...current, revisionNumber }));
        }
        setSaveStatus(copy.savedNewRevision);
        return;
      }
      // The client surfaces conflict/unauthorized via `error`; surface it.
      const body = res as { currentRevision?: number; error?: string };
      if (body.error === "revision_conflict" || body.currentRevision !== undefined) {
        setSaveStatus(
          `${copy.conflictPrefix} ${body.currentRevision ?? "?"} — ${copy.conflictSuffix}`,
        );
        return;
      }
      setSaveStatus(copy.saveFailed);
    } catch {
      setSaveStatus(copy.saveFailed);
    }
  }, [api, copy, projectId, state]);

  const requestExport = useCallback(
    async (preset: "web-1080p" | "web-4k" | "archive-master") => {
      await api.montageRequestExport(projectId, {
        expectedRevision: state.revisionNumber,
        preset,
      });
    },
    [api, projectId, state.revisionNumber],
  );

  const runQc = useCallback(async () => {
    const hasTrack = state.timeline.tracks.length > 0;
    const hasValidClip = state.timeline.clips.length > 0 && state.timeline.clips.every((clip) =>
      Number.isFinite(clip.timelineStart)
      && Number.isFinite(clip.sourceIn)
      && Number.isFinite(clip.sourceOut)
      && clip.timelineStart >= 0
      && clip.sourceOut > clip.sourceIn
      && state.timeline.tracks.some((track) => track.id === clip.trackId),
    );
    if (!hasTrack || !hasValidClip) {
      setQcReady(false);
      return;
    }
    const response = await api.montageExportQc(projectId, {
      expectedRevision: state.revisionNumber,
      preset: "web-1080p",
    });
    setQcReady(response.ok && response.ready === true);
  }, [api, projectId, state.revisionNumber, state.timeline]);

  const previewCmx = useCallback(async () => {
    if (!cmxEdl.trim()) return;
    setCmxStatus("");
    setCmxPreview(null);
    try {
      const response = await api.montagePreviewCmx(projectId, { edl: cmxEdl });
      if (!response.ok) {
        setCmxStatus(copy.previewFailed);
        return;
      }
      const preview = response.preview as { accepted: Array<{ reel: string }>; rejected: unknown[] };
      setCmxPreview(preview);
      setReelMappings(Object.fromEntries(preview.accepted.map(({ reel }) => [reel, ""])));
    } catch {
      setCmxStatus(copy.previewFailed);
    }
  }, [api, cmxEdl, copy.previewFailed, projectId]);

  const applyCmx = useCallback(async () => {
    if (!cmxPreview || cmxPreview.rejected.length > 0 || cmxPreview.accepted.some(({ reel }) => !reelMappings[reel])) return;
    const mappings = cmxPreview.accepted.map(({ reel }) => {
      const material = materials.find((item) => item.id === reelMappings[reel]);
      return material ? { reel, recordId: material.source.recordId, sourceVersionToken: material.source.sourceVersionToken } : null;
    });
    if (mappings.some((mapping) => mapping === null)) return;
    const response = await api.montageApplyCmx(projectId, { expectedRevision: state.revisionNumber, edl: cmxEdl, mappings: mappings.filter((mapping): mapping is NonNullable<typeof mapping> => mapping !== null) });
    if (response.ok) setState((current) => ({ ...current, revisionNumber: response.revisionNumber }));
  }, [api, cmxEdl, cmxPreview, materials, projectId, reelMappings, state.revisionNumber]);

  const addMaterial = useCallback((item: MaterialBinItem) => {
    const selectedClip = selectedClipId === null
      ? null
      : state.timeline.clips.find((clip) => clip.id === selectedClipId) ?? null;
    const targetTrack = selectedClip?.trackId ?? state.timeline.tracks[0]?.id;
    if (!targetTrack) return;
    dispatch({
      type: "add",
      trackId: targetTrack,
      source: item.source,
      durationSeconds: item.durationSeconds,
    });
  }, [dispatch, selectedClipId, state.timeline.clips, state.timeline.tracks]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const clipCount = useMemo(() => state.timeline.clips.length, [state.timeline.clips]);
  const others = presence.editors.filter((e) => e.userId !== "self");

  return (
    <section aria-label={copy.panelAriaLabel} className="montage-editor-panel">
      <div role="status" aria-live="polite" className="ui-visually-hidden montage-editor-panel__presence">
        {others.length > 0
          ? `${copy.presenceLabel}: ${others.map((e) => e.displayName).join("، ")}`
          : copy.noOtherEditors}
      </div>

      <div className="montage-editor-panel__toolbar">
        <button type="button" onClick={undo} disabled={!canUndo}>{copy.undoButton}</button>
        <button type="button" onClick={redo} disabled={!canRedo}>{copy.redoButton}</button>
        <span dir="ltr" className="montage-editor-panel__rev">
          rev {state.revisionNumber} · {clipCount} {copy.clipsUnit}
        </span>
        <button type="button" className="montage-editor-panel__save" onClick={() => void saveRevision()}>
          {copy.saveRevision}
        </button>
      </div>

      <p role="status" className="ui-visually-hidden montage-editor-panel__status">{saveStatus}</p>

      <section aria-label={copy.interchangeTitle} className="card card-border bg-base-200 shadow-sm">
        <div className="card-body gap-3 p-4">
          <div>
            <h2 className="card-title text-base">{copy.interchangeTitle}</h2>
            <p className="text-sm text-base-content/70">{copy.previewOnlyHint}</p>
          </div>
          <label className="ui-visually-hidden" htmlFor="cmx-edl">{copy.previewCmx}</label>
          <textarea
            id="cmx-edl"
            className="textarea w-full font-mono text-sm"
            value={cmxEdl}
            onChange={(event) => setCmxEdl(event.target.value)}
            placeholder={copy.previewCmx}
          />
          <div className="card-actions justify-start">
            <button type="button" className="btn btn-primary" onClick={() => void previewCmx()} disabled={!cmxEdl.trim()}>{copy.previewCmx}</button>
          </div>
          {cmxPreview ? (
            <>
              <div role="status" className="alert alert-info alert-soft sm:alert-horizontal">
                <span>{copy.previewAccepted}: {cmxPreview.accepted.length}</span>
                <span>{copy.previewRejected}: {cmxPreview.rejected.length}</span>
              </div>
              {cmxPreview.accepted.map(({ reel }) => (
                <label key={reel} className="form-control gap-1">
                  <span className="label-text">{copy.reelMapping.replace("{reel}", reel)}</span>
                  <select
                    className="select w-full"
                    aria-label={copy.reelMapping.replace("{reel}", reel)}
                    value={reelMappings[reel] ?? ""}
                    onChange={(event) => setReelMappings((current) => ({ ...current, [reel]: event.target.value }))}
                  >
                    <option value="" />
                    {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                  </select>
                </label>
              ))}
              <div className="card-actions justify-start">
                <button type="button" className="btn" onClick={() => void applyCmx()} disabled={cmxPreview.rejected.length > 0 || cmxPreview.accepted.some(({ reel }) => !reelMappings[reel])}>{copy.applyCmx}</button>
              </div>
            </>
          ) : null}
          {cmxStatus ? <p role="status" className="alert alert-error alert-soft">{cmxStatus}</p> : null}
        </div>
      </section>

      <div className="montage-editor-panel__columns">
        <MediaBin
          items={materials}
          selectedId={selectedMaterialId}
          onSelect={(item) => setSelectedMaterialId(item.id)}
          onAddToTimeline={addMaterial}
          copy={{
            binAriaLabel: copy.binAriaLabel,
            listLabel: copy.materialsListLabel,
            emptyBin: copy.emptyBin,
          }}
        />
        <TimelineCanvas
          state={state}
          dispatch={dispatch}
          fps={fps}
          frameRate={frameRate}
          timecodeMode={timecodeMode}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
          copy={{
            timelineAriaLabel: copy.timelineAriaLabel,
            selectHint: copy.selectHint,
            selectedHint: copy.selectedHint,
          }}
        />
        <ExportDrawer
          projectId={projectId}
          currentRevision={state.revisionNumber}
          qcReady={qcReady}
          onRunQc={runQc}
          onRequestExport={requestExport}
          copy={{
            drawerAriaLabel: copy.drawerAriaLabel,
            title: copy.exportTitle,
            presetGroupLabel: copy.presetGroupLabel,
            runQc: copy.runQc,
            startExport: copy.startExport,
            qcRequiredHint: copy.qcRequiredHint,
          }}
        />
      </div>
    </section>
  );
}
