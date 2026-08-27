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
};

type MontageEditorPanelProps = {
  projectId: string;
  initialState: EditorState;
  fps?: number;
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
  materials,
  presencePollMs = 15_000,
  copy,
}: MontageEditorPanelProps) {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<EditorState>(initialState);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
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
