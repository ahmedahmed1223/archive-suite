import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { Captions, Film, Music, Plus, SlidersHorizontal } from "lucide-react";

import { findTrackCollisions } from "../../features/montage/multiTrackModel.js";
import { TimelineClip } from "./TimelineClip.jsx";
import { TrackHeader } from "./TrackHeader.jsx";

const TRACK_ACTIONS = [
  { type: "video", label: "إضافة مسار فيديو", icon: Film },
  { type: "audio", label: "إضافة مسار صوت", icon: Music },
  { type: "title", label: "إضافة مسار عنوان", icon: Captions },
  { type: "adjustment", label: "إضافة مسار ضبط", icon: SlidersHorizontal }
];

function clipDuration(clip: any) {
  return Math.max(0, Number(clip.outSec || 0) - Number(clip.inSec || 0));
}

function TrackLane({ track, clips, selectedClipId, invalidClipIds, pixelsPerSecond, playheadSec, activeTool, onCommand, thumbnailsByItemId, commentsByClipId }: any) {
  const { isOver, setNodeRef } = useDroppable({ id: `track:${track.id}`, data: { trackId: track.id } });
  return (
    <div ref={setNodeRef} className={`multitrack-lane${isOver ? " is-over" : ""}${track.locked ? " is-locked" : ""}`} data-track-id={track.id}>
      {clips.map((clip: any) => (
        <TimelineClip
          key={clip.id}
          clip={track.locked && !clip.locked ? { ...clip, locked: true } : clip}
          selected={clip.id === selectedClipId}
          invalid={invalidClipIds.has(clip.id) || clipDuration(clip) <= 0}
          pixelsPerSecond={pixelsPerSecond}
          playheadSec={playheadSec}
          activeTool={activeTool}
          onCommand={onCommand}
          thumbnailUrl={thumbnailsByItemId?.get(clip.itemId) || undefined}
          comments={commentsByClipId?.get(clip.id) || []}
        />
      ))}
    </div>
  );
}

function DeleteTrackDialog({ track, tracks, clips, onClose, onCommand }: any) {
  const destinations = tracks.filter((candidate: any) => candidate.id !== track.id && candidate.type === track.type && !candidate.locked);
  const [destinationTrackId, setDestinationTrackId] = React.useState(destinations[0]?.id || "");
  const clipCount = clips.filter((clip: any) => clip.trackId === track.id).length;
  return (
    <div role="dialog" aria-modal="true" aria-label={`حذف مسار ${track.name}`} className="multitrack-delete-dialog">
      <p>يحتوي المسار على {clipCount} قصاصة.</p>
      {destinations.length ? (
        <select className="select select-bordered select-xs" aria-label="المسار البديل" value={destinationTrackId} onChange={(event: any) => setDestinationTrackId(event.target.value)}>
          {destinations.map((destination: any) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
        </select>
      ) : null}
      <div className="multitrack-delete-dialog__actions">
        <button type="button" className="btn btn-xs" disabled={!destinationTrackId} onClick={() => { onCommand?.({ type: "track.delete", trackId: track.id, strategy: "move", destinationTrackId }); onClose(); }}>نقل القصاصات ثم الحذف</button>
        <button type="button" className="btn btn-error btn-xs" onClick={() => { onCommand?.({ type: "track.delete", trackId: track.id, strategy: "delete" }); onClose(); }}>حذف المسار والقصاصات</button>
        <button type="button" className="btn btn-ghost btn-xs" onClick={onClose}>إلغاء</button>
      </div>
    </div>
  );
}

export function MultiTrackTimeline({
  tracks = [],
  clips = [],
  selectedClipId,
  fps = 25,
  pixelsPerSecond = 12,
  markers = [],
  playheadSec = 0,
  activeTool = "select",
  onCommand,
  thumbnailsByItemId,
  commentsByClipId
}: any) {
  const orderedTracks = React.useMemo(() => [...tracks].sort((a: any, b: any) => a.order - b.order), [tracks]);
  const scale = Math.max(4, Math.min(80, Number(pixelsPerSecond) || 12));
  const duration = Math.max(10, ...clips.map((clip: any) => (Number(clip.timelineStartSec) || 0) + clipDuration(clip)), ...markers.map((marker: any) => Number(marker.atSec) || 0));
  const surfaceWidth = Math.max(720, Math.ceil(duration * scale + 120));
  const collisions = React.useMemo(() => findTrackCollisions(clips), [clips]);
  const invalidClipIds = React.useMemo(() => new Set(collisions.flatMap((collision: any) => [collision.firstId, collision.secondId])), [collisions]);
  const [pendingDelete, setPendingDelete] = React.useState(null);
  const [activeClip, setActiveClip] = React.useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const requestDelete = (track: any) => {
    if (!clips.some((clip: any) => clip.trackId === track.id)) {
      onCommand?.({ type: "track.delete", trackId: track.id, strategy: "cancel" });
      return;
    }
    setPendingDelete(track);
  };

  const handleDragEnd = ({ active, over, delta }: any) => {
    const clipId = active.data.current?.clipId;
    const trackId = over?.data.current?.trackId || active.data.current?.trackId;
    if (clipId && trackId) {
      const startSec = Math.max(0, (Number(active.data.current?.startSec) || 0) - delta.x / scale);
      onCommand?.({ type: "clip.move", clipId, trackId, startSec });
    }
    setActiveClip(null);
  };

  const tickStep = duration > 120 ? 30 : duration > 45 ? 10 : 5;
  const ticks = Array.from({ length: Math.ceil(duration / tickStep) + 1 }, (_: any, index: any) => index * tickStep);

  return (
    <div className="multitrack-timeline" style={{ "--timeline-surface-width": `${surfaceWidth}px` } as React.CSSProperties}>
      <div className="multitrack-timeline__toolbar" aria-label="إضافة مسارات">
        {TRACK_ACTIONS.map(({ type, label, icon: Icon }: any) => (
          <button key={type} type="button" className="btn btn-ghost btn-xs" aria-label={label} onClick={() => onCommand?.({ type: "track.add", trackType: type })}>
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{label.replace("إضافة مسار ", "")}</span>
          </button>
        ))}
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={({ active }: any) => setActiveClip(clips.find((clip: any) => clip.id === active.data.current?.clipId) || null)}
        onDragCancel={() => setActiveClip(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="multitrack-timeline__scroll">
          <div className="multitrack-timeline__matrix" style={{ minWidth: `${surfaceWidth + 188}px` }}>
            <div className="multitrack-timeline__corner">المسارات</div>
            <div className="multitrack-ruler" style={{ width: `${surfaceWidth}px` }}>
              {ticks.map((tick: any) => <span key={tick} style={{ insetInlineStart: `${tick * scale}px` }}>{tick}s</span>)}
              {markers.map((marker: any) => <i key={marker.id} title={marker.label} style={{ insetInlineStart: `${marker.atSec * scale}px` }} />)}
            </div>
            {orderedTracks.map((track: any, index: any) => (
              <React.Fragment key={track.id}>
                <div className="multitrack-timeline__sticky-header">
                  <TrackHeader track={track} index={index} total={orderedTracks.length} onCommand={onCommand} onRequestDelete={requestDelete} />
                </div>
                <div className="multitrack-timeline__surface" style={{ width: `${surfaceWidth}px` }}>
                  <TrackLane
                    track={track}
                    clips={clips.filter((clip: any) => clip.trackId === track.id)}
                    selectedClipId={selectedClipId}
                    invalidClipIds={invalidClipIds}
                    pixelsPerSecond={scale}
                    playheadSec={playheadSec}
                    activeTool={activeTool}
                    onCommand={onCommand}
                    thumbnailsByItemId={thumbnailsByItemId}
                    commentsByClipId={commentsByClipId}
                  />
                </div>
              </React.Fragment>
            ))}
            <div className="multitrack-playhead" style={{ insetInlineStart: `calc(188px + ${Math.max(0, playheadSec) * scale}px)` }} aria-hidden="true" />
          </div>
        </div>
        <DragOverlay>{activeClip ? <div className="multitrack-drag-overlay">{(activeClip as any).label || (activeClip as any).itemId}</div> : null}</DragOverlay>
      </DndContext>
      {pendingDelete ? <DeleteTrackDialog track={pendingDelete} tracks={orderedTracks} clips={clips} onClose={() => setPendingDelete(null)} onCommand={onCommand} /> : null}
      <span className="sr-only">المعدل {fps} إطارًا في الثانية</span>
    </div>
  );
}

export default MultiTrackTimeline;
