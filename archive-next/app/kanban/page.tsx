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
import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import ChangeImpactPreview from "@/components/ChangeImpactPreview";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { buildChangeImpact } from "@/lib/change-impact";
import { formatDate, getRecordWorkflowStatus, WORKFLOW_STATES, workflowStatusLabels, type WorkflowStatus } from "@/lib/record-utils";
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
  status
}: Readonly<{
  busyId: string | null;
  moveRecord: (record: ArchiveRecord, status: WorkflowStatus) => void;
  record: ArchiveRecord;
  status: WorkflowStatus;
}>) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: record.id,
    data: { record }
  });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition
  };

  return (
    <motion.div ref={setNodeRef} className="kanban-card" data-dragging={isDragging ? "true" : "false"} layout style={style}>
      <div className="helper-row">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="kanban-card__handle"
          aria-label={`سحب ${record.title || record.id}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" size={14} />
          نقل
        </button>
      </div>
      <strong>{record.title || record.id}</strong>
      <span className="helper-text">{record.type || "غير محدد"} · {formatDate(record.updatedAt || record.createdAt)}</span>
      <div className="button-row">
        <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(record.id)}`}>فتح</a>
        <select
          value={status}
          disabled={busyId === record.id}
          onChange={(event) => moveRecord(record, event.target.value as WorkflowStatus)}
          aria-label={`نقل ${record.title || record.id}`}
        >
          {WORKFLOW_STATES.map((next) => <option key={next} value={next}>{workflowStatusLabels[next]}</option>)}
        </select>
      </div>
    </motion.div>
  );
}

export default function KanbanPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const records = state.status === "ready" ? state.records : [];
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
      setFeedback(`تم نقل "${record.title || record.id}" إلى ${workflowStatusLabels[status]}`);
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
    <AppShell subtitle="كانبان" contentClassName="local-list-content" tipsPage="kanban">
      <PageToolbar
        eyebrow={<span className="badge">Workflow</span>}
        title="لوحة كانبان"
        description="عرض سير عمل السجلات حسب الحالة مع نقل سريع عبر endpoint records/bulk الحالي."
        meta={(
          <>
            <span className="badge">{records.length} سجل</span>
            <span className="badge">{WORKFLOW_STATES.length} حالات</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/archive">فتح الأرشيف</a>}
      />

      {feedback ? (
        <div className="state-banner" role="status">
          <strong>تحديث كانبان</strong>
          <span className="helper-text">{feedback}</span>
        </div>
      ) : null}
      <ChangeImpactPreview impact={buildChangeImpact({ action: "move", entity: "بطاقة كانبان", affectedCount: 1, reversible: true })} />
      <p className="helper-text">يمكن استخدام قائمة «نقل» داخل كل بطاقة كبديل كامل قابل للوصول للسحب والإفلات.</p>
      <p className="helper-text">جميع البطاقات متاحة عبر قائمة النقل، بما فيها البطاقات خارج مساحة العرض الأولى.</p>
      {canUndo(moveStack) || canRedo(moveStack) ? (
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(moveStack) || busyId !== null}
            onClick={() => void handleUndo()}
          >
            تراجع{moveStack.past.length > 0 ? ` (${moveStack.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(moveStack) || busyId !== null}
            onClick={() => void handleRedo()}
          >
            إعادة{moveStack.future.length > 0 ? ` (${moveStack.future.length})` : ""}
          </button>
        </div>
      ) : null}

      {state.status === "loading" ? <div className="panel panel-compact"><Skeleton label="جار تحميل اللوحة..." /></div> : null}
      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل كانبان</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}
      {state.status === "ready" && records.length === 0 ? (
        <EmptyState title="لا توجد سجلات." description="أضف سجلات إلى الأرشيف لتظهر في لوحة سير العمل." />
      ) : null}

      {state.status === "ready" && records.length > 0 ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <section className="workflow-board" aria-label="لوحة سير العمل">
            {WORKFLOW_STATES.map((status) => {
              const items = grouped.get(status) || [];
              const visibleItems = items;
              return (
                <WorkflowColumn key={status} status={status} itemIds={visibleItems.map((record) => record.id)}>
                  <div className="panel-title-row">
                    <h2>{workflowStatusLabels[status]}</h2>
                    <span className="badge">{items.length}</span>
                  </div>
                  {visibleItems.length === 0 ? (
                    <p className="helper-text">اسحب سجلًا إلى هنا لتغيير حالته.</p>
                  ) : (
                    visibleItems.map((record) => (
                      <SortableKanbanCard
                        key={record.id}
                        busyId={busyId}
                        moveRecord={(item, nextStatus) => void moveRecord(item, nextStatus)}
                        record={record}
                        status={status}
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
