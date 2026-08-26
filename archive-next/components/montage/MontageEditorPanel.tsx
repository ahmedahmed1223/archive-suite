"use client";

import { useCallback, useMemo, useState } from "react";
import MediaBin, { type MaterialBinItem } from "./MediaBin";
import TimelineCanvas from "./TimelineCanvas";
import ExportDrawer from "./ExportDrawer";
import {
  redoEditor,
  reduceEditor,
  serializeRevision,
  undoEditor,
  type EditorAction,
  type EditorState,
} from "@/lib/montage-editor";

type MontageEditorPanelProps = {
  projectId: string;
  initialState: EditorState;
  fps?: number;
  materials: MaterialBinItem[];
};

/**
 * V1.5 Task 5/6: the editing surface added alongside the existing studio
 * player/comments panels. Owns editor state locally; saving goes through the
 * revision API with optimistic concurrency (Task 2 endpoints).
 */
export default function MontageEditorPanel({
  projectId,
  initialState,
  fps = 25,
  materials,
}: MontageEditorPanelProps) {
  const [state, setState] = useState<EditorState>(initialState);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");

  const dispatch = useCallback(
    (action: EditorAction) => setState((current) => reduceEditor(current, action, fps)),
    [fps],
  );

  const undo = useCallback(() => setState((c) => undoEditor(c)), []);
  const redo = useCallback(() => setState((c) => redoEditor(c)), []);

  const saveRevision = useCallback(async () => {
    setSaveStatus("جارٍ الحفظ…");
    try {
      const response = await fetch(`/api/v1/montage-projects/${projectId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeRevision(state)),
      });
      if (response.status === 409) {
        const body = (await response.json()) as { currentRevision?: number };
        setSaveStatus(`تعارض: الخادم عند المراجعة ${body.currentRevision ?? "غير معروفة"} — لم تُفقد تعديلاتك`);
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      setSaveStatus("تم حفظ مراجعة جديدة");
    } catch {
      setSaveStatus("تعذر الحفظ — أعد المحاولة");
    }
  }, [projectId, state]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const clipCount = useMemo(() => state.timeline.clips.length, [state.timeline.clips]);

  return (
    <section aria-label="لوحة تحرير المونتاج" className="montage-editor-panel">
      <div className="montage-editor-panel__toolbar">
        <button type="button" onClick={undo} disabled={!canUndo}>↩ تراجع</button>
        <button type="button" onClick={redo} disabled={!canRedo}>↪ إعادة</button>
        <span dir="ltr" className="montage-editor-panel__rev">
          rev {state.revisionNumber} · {clipCount} مقاطع
        </span>
        <button type="button" className="montage-editor-panel__save" onClick={() => void saveRevision()}>
          حفظ مراجعة
        </button>
      </div>

      <p role="status" className="montage-editor-panel__status sr-only">{saveStatus}</p>

      <div className="montage-editor-panel__columns">
        <MediaBin items={materials} selectedId={null} onSelect={() => undefined} />
        <TimelineCanvas
          state={state}
          dispatch={dispatch}
          fps={fps}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
        />
        <ExportDrawer
          projectId={projectId}
          currentRevision={state.revisionNumber}
          qcReady={false}
          onRequestExport={(preset) => {
            void fetch(`/api/v1/montage-projects/${projectId}/exports`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ expectedRevision: state.revisionNumber, preset }),
            });
          }}
        />
      </div>
    </section>
  );
}
