"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { buildChangeImpact } from "@/lib/change-impact";
import { formatDate, getRecordWorkflowStatus, WORKFLOW_STATES, type WorkflowStatus } from "@/lib/record-utils";
import { canRedo, canUndo, emptyUndoStack, pushUndo, redo, undo, type UndoStack } from "@/lib/undo-stack";
import { Skeleton } from "@/components/ui/Skeleton";

interface KanbanMove {
  record: ArchiveRecord;
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[] }
  | { status: "error"; message: string };

function resolveDropStatus(overId: string | null | undefined, recordStatusById: Map<string, WorkflowStatus>) {
  if (!overId) {
    return undefined;
  }

  if ((WORKFLOW_STATES as readonly string[]).includes(overId)) {
    return overId as WorkflowStatus;
  }

  return recordStatusById.get(overId);
}

function WorkflowColumn({
  children,
  itemIds,
  status
}: Readonly<{
  children: ReactNode;
  itemIds: string[];
  status: WorkflowStatus;
}>) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <motion.article ref={setNodeRef} className="workflow-column" data-over={isOver ? "true" : "false"} layout>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </motion.article>
  );
}

function SortableKanbanCard({
  busyId,
  moveRecord,
  record,
  status,
  canEdit
}: Readonly<{
  busyId: string | null;
  moveRecord: (record: ArchiveRecord, status: WorkflowStatus) => void;
  record: ArchiveRecord;
  status: WorkflowStatus;
  canEdit: boolean;
}>) {
  const { locale, t } = useLocale();
  const copy = t.pages.kanban;
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: record.id,
    data: { record },
    disabled: !canEdit
  });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition
  };

  return (
    <motion.div ref={setNodeRef} className="kanban-card" data-dragging={isDragging ? "true" : "false"} layout style={style}>
      {canEdit && (
        <div className="helper-row">
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="kanban-card__handle"
            aria-label={copy.drag.replace("{name}", record.title || record.id)}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" size={14} />
            {copy.move}
          </button>
        </div>
      )}
      <strong>{record.title || record.id}</strong>
      <span className="helper-text">{record.type || copy.unspecified} · {formatDate(record.updatedAt || record.createdAt, "-", locale)}</span>
      <div className="button-row">
        <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(record.id)}`}>{copy.open}</a>
        {canEdit ? (
          <select
            value={status}
            disabled={busyId === record.id}
            onChange={(event) => moveRecord(record, event.target.value as WorkflowStatus)}
            aria-label={copy.move.replace("{name}", record.title || record.id)}
          >
            {WORKFLOW_STATES.map((next) => <option key={next} value={next}>{copy.statuses[next]}</option>)}
          </select>
        ) : (
          <span className="badge">{copy.statuses[status]}</span>
        )}
      </div>
    </motion.div>
  );
}

export default function KanbanPage() {
  const { t } = useLocale();
  const copy = t.pages.kanban;
  const api = useMemo(() => createArchiveApiClient(), []);
  const canEditRecords = useCapability("records.edit");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [moveStack, setMoveStack] = useState<UndoStack<KanbanMove>>(emptyUndoStack);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function load() {
    setState({ status: "loading" });
    const response = await api.search({ limit: 1000 });
    setState(response.ok ? { status: "ready", records: response.records } : { status: "error", message: response.error });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is redefined every render; this effect should run once on mount only
  }, []);

  const records = useMemo(
    () => (state.status === "ready" ? state.records : []),
    [state]
  );
  const grouped = useMemo(() => {
    const map = new Map<WorkflowStatus, ArchiveRecord[]>();
    WORKFLOW_STATES.forEach((status) => map.set(status, []));
    records.forEach((record) => {
      const status = getRecordWorkflowStatus(record);
      map.set(status, [...(map.get(status) || []), record]);
    });
    return map;
  }, [records]);
  const recordStatusById = useMemo(() => {
    const map = new Map<string, WorkflowStatus>();
    records.forEach((record) => map.set(record.id, getRecordWorkflowStatus(record)));
    return map;
  }, [records]);

  async function applyMove(record: ArchiveRecord, status: WorkflowStatus): Promise<boolean> {
    setBusyId(record.id);
    setFeedback("");
    const response = await api.bulkRecords({
      store: record.store || "default",
      records: [{ ...record, workflowStatus: status }]
    });
    if (response.ok) {
      setFeedback(copy.moved.replace("{name}", record.title || record.id).replace("{status}", copy.statuses[status]));
      await load();
    } else {
      setFeedback(response.error);
    }
    setBusyId(null);
    return response.ok;
  }

  async function moveRecord(record: ArchiveRecord, status: WorkflowStatus) {
    const fromStatus = getRecordWorkflowStatus(record);
    if (fromStatus === status) return;
    const ok = await applyMove(record, status);
    if (ok) {
      setMoveStack((stack) => pushUndo(stack, { record, fromStatus, toStatus: status }));
    }
  }

  // V1-732: a real multi-level undo/redo stack (lib/undo-stack.ts), not a
  // single-slot "undo the last move only" confirmation.
  async function handleUndo() {
    const result = undo(moveStack);
    if (!result) return;
    const ok = await applyMove(result.entry.record, result.entry.fromStatus);
    if (ok) setMoveStack(result.stack);
  }

  async function handleRedo() {
    const result = redo(moveStack);
    if (!result) return;
    const ok = await applyMove(result.entry.record, result.entry.toStatus);
    if (ok) setMoveStack(result.stack);
  }

  function handleDragEnd(event: DragEndEvent) {
    const record = event.active.data.current?.record as ArchiveRecord | undefined;
    const targetStatus = resolveDropStatus(String(event.over?.id || ""), recordStatusById);

    if (!record || !targetStatus || targetStatus === getRecordWorkflowStatus(record)) {
      return;
    }

    void moveRecord(record, targetStatus);
  }

  return (
    <AppShell subtitle={t.pageTitles.kanban} contentClassName="local-list-content" tipsPage="kanban">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={(
          <>
            <span className="badge">{copy.recordCount.replace("{count}", String(records.length))}</span>
            <span className="badge">{copy.statusCount.replace("{count}", String(WORKFLOW_STATES.length))}</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/archive">{copy.openArchive}</a>}
      />

      {feedback ? (
        <div className="state-banner" role="status">
          <strong>{copy.update}</strong>
          <span className="helper-text">{feedback}</span>
        </div>
      ) : null}
      {canEditRecords ? (
        <>
          <ChangeImpactPreview impact={buildChangeImpact({ action: "move", entity: copy.card, affectedCount: 1, reversible: true })} />
          <p className="helper-text">{copy.accessibleMove}</p>
          <p className="helper-text">{copy.accessibleCards}</p>
        </>
      ) : (
        <p className="helper-text">{copy.readOnly}</p>
      )}
      {canEditRecords && (canUndo(moveStack) || canRedo(moveStack)) ? (
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(moveStack) || busyId !== null}
            onClick={() => void handleUndo()}
          >
            {copy.undo}{moveStack.past.length > 0 ? ` (${moveStack.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(moveStack) || busyId !== null}
            onClick={() => void handleRedo()}
          >
            {copy.redo}{moveStack.future.length > 0 ? ` (${moveStack.future.length})` : ""}
          </button>
        </div>
      ) : null}

      {state.status === "loading" ? <div className="panel panel-compact"><Skeleton label={copy.loading} /></div> : null}
      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadError}</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}
      {state.status === "ready" && records.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : null}

      {state.status === "ready" && records.length > 0 ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <section className="workflow-board" aria-label={copy.boardAriaLabel}>
            {WORKFLOW_STATES.map((status) => {
              const items = grouped.get(status) || [];
              const visibleItems = items;
              return (
                <WorkflowColumn key={status} status={status} itemIds={visibleItems.map((record) => record.id)}>
                  <div className="panel-title-row">
                    <h2>{copy.statuses[status]}</h2>
                    <span className="badge">{items.length}</span>
                  </div>
                  {visibleItems.length === 0 ? (
                    <p className="helper-text">{copy.dropHint}</p>
                  ) : (
                    visibleItems.map((record) => (
                      <SortableKanbanCard
                        key={record.id}
                        busyId={busyId}
                        moveRecord={(item, nextStatus) => void moveRecord(item, nextStatus)}
                        record={record}
                        status={status}
                        canEdit={canEditRecords}
                      />
                    ))
                  )}
                </WorkflowColumn>
              );
            })}
          </section>
        </DndContext>
      ) : null}
    </AppShell>
  );
}
