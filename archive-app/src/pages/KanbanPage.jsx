import * as React from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ClipboardList,
  Columns3,
  Database,
  ExternalLink,
  Kanban,
  LayoutDashboard,
  Palette,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  Trash2
} from "lucide-react";

import { EmptyState } from "../components/common/EmptyState.jsx";
import { PageHero } from "../components/ui/V1Primitives.jsx";
import { useAppStore } from "../stores/index.js";
import { formatNumber } from "../utils/formatting.js";
import {
  KANBAN_FIELD_TYPES,
  addKanbanBoard,
  addKanbanCard,
  addKanbanColumn,
  addKanbanField,
  getKanbanBoardSummary,
  moveKanbanCard,
  normalizeKanbanWorkspace,
  removeKanbanCard,
  removeKanbanColumn,
  removeKanbanField,
  setActiveKanbanBoard,
  updateKanbanBoard,
  updateKanbanCard,
  updateKanbanColumn
} from "../features/views/kanbanModel.js";

const FIELD_TYPE_LABELS = {
  text: "نص",
  number: "رقم",
  date: "تاريخ",
  select: "اختيار",
  url: "رابط"
};

const PRIORITY_LABELS = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  urgent: "عاجلة"
};

const PRIORITY_CLASS = {
  low: "border-slate-500/25 bg-slate-500/10 text-slate-200",
  medium: "border-blue-500/25 bg-blue-500/10 text-blue-200",
  high: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  urgent: "border-red-500/25 bg-red-500/10 text-red-200"
};

const PROJECT_BOARD_TIPS = [
  "لا تتم إضافة عناصر الأرشيف هنا تلقائياً.",
  "أنشئ البطاقات يدوياً واربط مادة أرشيفية فقط عند الحاجة.",
  "الأعمدة والحقول قابلة للتخصيص لكل لوحة مشروع."
];

function Section({ icon, title, children, actions }) {
  return (
    <section className="rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 shadow-[var(--va-elev-1)]">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--va-text)]">
          {icon}
          {title}
        </h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3">
      <p className="flex items-center gap-2 text-xs text-[var(--va-text-muted)]">{icon}{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--va-text)]">{formatNumber(value)}</p>
    </div>
  );
}

function NewBoardForm({ onCreate }) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");

  const submit = (event) => {
    event.preventDefault();
    onCreate?.({ title, description });
    setTitle("");
    setDescription("");
  };

  return (
    <form onSubmit={submit} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
      <label className="block">
        <span className="sr-only">اسم اللوحة</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          placeholder="اسم لوحة المشروع"
          className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action,#10b981)]"
        />
      </label>
      <label className="block">
        <span className="sr-only">وصف اللوحة</span>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="وصف مختصر اختياري"
          className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action,#10b981)]"
        />
      </label>
      <button type="submit" className="btn btn-primary min-h-10 gap-2">
        <Plus className="h-4 w-4" />
        إنشاء لوحة
      </button>
    </form>
  );
}

function BoardSettings({ board, workspace, onPersist }) {
  const updateBoard = (patch) => {
    onPersist(updateKanbanBoard(workspace, board.id, patch));
  };

  return (
    <Section icon={<Settings2 className="h-4 w-4 va-accent-text" />} title="إعدادات لوحة المشروع">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--va-text-muted)]">اسم اللوحة</span>
          <input
            value={board.title}
            onChange={(event) => updateBoard({ title: event.target.value })}
            className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action,#10b981)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--va-text-muted)]">وصف المشروع</span>
          <input
            value={board.description}
            onChange={(event) => updateBoard({ description: event.target.value })}
            placeholder="هدف اللوحة أو نطاق المشروع"
            className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action,#10b981)]"
          />
        </label>
      </div>
    </Section>
  );
}

function ColumnManager({ board, onBoardChange }) {
  const [title, setTitle] = React.useState("");

  const addColumn = (event) => {
    event.preventDefault();
    onBoardChange(addKanbanColumn(board, title));
    setTitle("");
  };

  return (
    <Section icon={<Columns3 className="h-4 w-4 va-accent-text" />} title="تخصيص الأعمدة">
      <form onSubmit={addColumn} className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          placeholder="اسم عمود جديد"
          className="min-h-10 flex-1 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action,#10b981)]"
        />
        <button type="submit" className="btn btn-ghost min-h-10 gap-2 border border-[var(--va-border-soft)]">
          <Plus className="h-4 w-4" />
          إضافة عمود
        </button>
      </form>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {board.columns.map((column) => {
          const cardCount = board.cards.filter((card) => card.columnId === column.id).length;
          const canRemove = board.columns.length > 1 && cardCount === 0;
          return (
            <div key={column.id} className="rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={column.color}
                  onChange={(event) => onBoardChange(updateKanbanColumn(board, column.id, { color: event.target.value }))}
                  aria-label={`لون عمود ${column.title}`}
                  className="h-8 w-9 shrink-0 rounded border border-[var(--va-border-soft)] bg-transparent"
                />
                <input
                  value={column.title}
                  onChange={(event) => onBoardChange(updateKanbanColumn(board, column.id, { title: event.target.value }))}
                  aria-label={`اسم عمود ${column.title}`}
                  className="min-h-8 min-w-0 flex-1 rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-2 text-xs text-[var(--va-text)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => onBoardChange(removeKanbanColumn(board, column.id))}
                  disabled={!canRemove}
                  title={canRemove ? "حذف العمود" : "لا يمكن حذف عمود يحتوي بطاقات"}
                  aria-label={`حذف عمود ${column.title}`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] text-[var(--va-text-muted)] hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-[var(--va-text-muted)]">
                حد العمل
                <input
                  type="number"
                  min="0"
                  value={column.wipLimit}
                  onChange={(event) => onBoardChange(updateKanbanColumn(board, column.id, { wipLimit: event.target.value }))}
                  className="min-h-7 w-20 rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-2 text-xs text-[var(--va-text)] outline-none"
                />
              </label>
              <p className="mt-2 text-[11px] text-[var(--va-text-muted)]">{formatNumber(cardCount)} بطاقة</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function FieldManager({ board, onBoardChange }) {
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState("text");
  const [options, setOptions] = React.useState("");

  const addField = (event) => {
    event.preventDefault();
    onBoardChange(addKanbanField(board, {
      label,
      type,
      options: options.split(",").map((option) => option.trim()).filter(Boolean)
    }));
    setLabel("");
    setOptions("");
  };

  return (
    <Section icon={<SlidersHorizontal className="h-4 w-4 va-accent-text" />} title="الحقول المخصصة">
      <form onSubmit={addField} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)_auto]">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          required
          placeholder="اسم الحقل"
          className="min-h-10 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="min-h-10 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
        >
          {KANBAN_FIELD_TYPES.map((fieldType) => (
            <option key={fieldType} value={fieldType}>{FIELD_TYPE_LABELS[fieldType]}</option>
          ))}
        </select>
        <input
          value={options}
          onChange={(event) => setOptions(event.target.value)}
          disabled={type !== "select"}
          placeholder="خيارات مفصولة بفواصل"
          className="min-h-10 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none disabled:opacity-45"
        />
        <button type="submit" className="btn btn-ghost min-h-10 gap-2 border border-[var(--va-border-soft)]">
          <Plus className="h-4 w-4" />
          إضافة حقل
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {board.fields.length ? board.fields.map((field) => (
          <span key={field.id} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 text-xs text-[var(--va-text-2)]">
            {field.label}
            <small className="text-[var(--va-text-muted)]">{FIELD_TYPE_LABELS[field.type]}</small>
            <button
              type="button"
              onClick={() => onBoardChange(removeKanbanField(board, field.id))}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--va-text-muted)] hover:bg-red-500/10 hover:text-red-300"
              aria-label={`حذف حقل ${field.label}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        )) : (
          <p className="text-xs text-[var(--va-text-muted)]">لا توجد حقول مخصصة بعد.</p>
        )}
      </div>
    </Section>
  );
}

function CardBuilder({ board, videoItems, onBoardChange }) {
  const [draft, setDraft] = React.useState({
    title: "",
    summary: "",
    columnId: board.columns[0]?.id || "",
    owner: "",
    dueDate: "",
    priority: "medium",
    sourceItemId: "",
    fieldValues: {}
  });

  React.useEffect(() => {
    setDraft((value) => ({
      ...value,
      columnId: board.columns.some((column) => column.id === value.columnId) ? value.columnId : board.columns[0]?.id || ""
    }));
  }, [board.columns]);

  const setFieldValue = (fieldId, value) => {
    setDraft((current) => ({
      ...current,
      fieldValues: { ...(current.fieldValues || {}), [fieldId]: value }
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    onBoardChange(addKanbanCard(board, draft));
    setDraft({
      title: "",
      summary: "",
      columnId: board.columns[0]?.id || "",
      owner: "",
      dueDate: "",
      priority: "medium",
      sourceItemId: "",
      fieldValues: {}
    });
  };

  return (
    <Section icon={<ClipboardList className="h-4 w-4 va-accent-text" />} title="إضافة بطاقة يدوية">
      <form onSubmit={submit} className="grid gap-3 xl:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--va-text-muted)]">عنوان البطاقة</span>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            required
            className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--va-text-muted)]">العمود</span>
          <select
            value={draft.columnId}
            onChange={(event) => setDraft({ ...draft, columnId: event.target.value })}
            className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
          >
            {board.columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
          </select>
        </label>
        <label className="block xl:col-span-2">
          <span className="mb-1 block text-xs text-[var(--va-text-muted)]">الوصف</span>
          <textarea
            value={draft.summary}
            onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
            rows={3}
            className="w-full resize-y rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--va-text-muted)]">المسؤول</span>
          <input
            value={draft.owner}
            onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
            className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--va-text-muted)]">تاريخ الاستحقاق</span>
          <input
            type="date"
            value={draft.dueDate}
            onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
            className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--va-text-muted)]">الأولوية</span>
          <select
            value={draft.priority}
            onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
            className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--va-text-muted)]">ربط مادة من الأرشيف اختياري</span>
          <select
            value={draft.sourceItemId}
            onChange={(event) => setDraft({ ...draft, sourceItemId: event.target.value })}
            className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
          >
            <option value="">بدون ربط</option>
            {videoItems.filter((item) => !item.isDeleted).slice(0, 300).map((item) => (
              <option key={item.id} value={item.id}>{item.title || item.id}</option>
            ))}
          </select>
        </label>
        {board.fields.map((field) => (
          <label key={field.id} className="block">
            <span className="mb-1 block text-xs text-[var(--va-text-muted)]">{field.label}</span>
            {field.type === "select" ? (
              <select
                value={draft.fieldValues[field.id] || ""}
                onChange={(event) => setFieldValue(field.id, event.target.value)}
                className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
              >
                <option value="">بدون قيمة</option>
                {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : (
              <input
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
                value={draft.fieldValues[field.id] || ""}
                onChange={(event) => setFieldValue(field.id, event.target.value)}
                className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
              />
            )}
          </label>
        ))}
        <div className="xl:col-span-2">
          <button type="submit" className="btn btn-primary min-h-10 gap-2">
            <Save className="h-4 w-4" />
            حفظ البطاقة
          </button>
        </div>
      </form>
    </Section>
  );
}

function ProjectCard({ card, board, linkedItem, onBoardChange, onOpenItem }) {
  return (
    <article className="rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-3 shadow-[var(--va-elev-1)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-bold text-[var(--va-text)]" dir="auto">{card.title}</h3>
          {card.summary && <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--va-text-muted)]" dir="auto">{card.summary}</p>}
        </div>
        <button
          type="button"
          onClick={() => onBoardChange(removeKanbanCard(board, card.id))}
          aria-label={`حذف بطاقة ${card.title}`}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--va-radius-sm)] text-[var(--va-text-muted)] hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${PRIORITY_CLASS[card.priority] || PRIORITY_CLASS.medium}`}>
          {PRIORITY_LABELS[card.priority] || PRIORITY_LABELS.medium}
        </span>
        {card.owner && <span className="rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-[11px] text-[var(--va-text-2)]">{card.owner}</span>}
        {card.dueDate && <span className="inline-flex items-center gap-1 rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-[11px] text-[var(--va-text-2)]"><CalendarDays className="h-3 w-3" />{card.dueDate}</span>}
      </div>
      {board.fields.length > 0 && (
        <dl className="mt-3 grid gap-1 text-[11px]">
          {board.fields.map((field) => card.fieldValues?.[field.id] ? (
            <div key={field.id} className="flex items-center justify-between gap-2 rounded-[var(--va-radius-sm)] bg-[var(--va-surface-2)] px-2 py-1">
              <dt className="text-[var(--va-text-muted)]">{field.label}</dt>
              <dd className="truncate text-[var(--va-text-2)]" dir="auto">{card.fieldValues[field.id]}</dd>
            </div>
          ) : null)}
        </dl>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={card.columnId}
          onChange={(event) => onBoardChange(moveKanbanCard(board, card.id, event.target.value))}
          aria-label={`نقل بطاقة ${card.title}`}
          className="min-h-8 flex-1 rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 text-xs text-[var(--va-text)] outline-none"
        >
          {board.columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
        </select>
        {linkedItem && (
          <button
            type="button"
            onClick={() => onOpenItem(linkedItem)}
            className="inline-flex min-h-8 items-center gap-1 rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] px-2 text-xs text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            المادة
          </button>
        )}
      </div>
    </article>
  );
}

function BoardColumns({ board, videoItems, onBoardChange, onOpenItem }) {
  const itemsById = React.useMemo(() => new Map(videoItems.map((item) => [item.id, item])), [videoItems]);

  return (
    <section className="overflow-x-auto pb-2" aria-label="لوحة بطاقات المشروع">
      <div className="grid min-w-[72rem] gap-3 xl:grid-cols-4" role="list">
        {board.columns.map((column) => {
          const cards = board.cards.filter((card) => card.columnId === column.id);
          const atLimit = column.wipLimit > 0 && cards.length > column.wipLimit;
          return (
            <section
              key={column.id}
              role="listitem"
              className={`min-h-[24rem] rounded-[var(--va-radius-lg)] border bg-[var(--va-surface)] shadow-[var(--va-elev-1)] ${atLimit ? "border-amber-500/35" : "border-[var(--va-border-soft)]"}`}
            >
              <header className="border-b border-[var(--va-border-soft)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--va-text)]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
                    <span className="truncate">{column.title}</span>
                  </h2>
                  <span className="rounded-full bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-2)]">{formatNumber(cards.length)}</span>
                </div>
                {column.wipLimit > 0 && (
                  <p className={`mt-1 text-[11px] ${atLimit ? "text-amber-200" : "text-[var(--va-text-muted)]"}`}>
                    حد العمل: {formatNumber(column.wipLimit)}
                  </p>
                )}
              </header>
              <div className="space-y-2 p-2">
                {cards.length ? cards.map((card) => (
                  <ProjectCard
                    key={card.id}
                    card={card}
                    board={board}
                    linkedItem={itemsById.get(card.sourceItemId)}
                    onBoardChange={onBoardChange}
                    onOpenItem={onOpenItem}
                  />
                )) : (
                  <p className="rounded-[var(--va-radius-md)] border border-dashed border-[var(--va-border-soft)] px-3 py-8 text-center text-xs text-[var(--va-text-muted)]">
                    لا توجد بطاقات. أضف بطاقة يدوياً من النموذج.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export function KanbanPage() {
  const {
    settings = {},
    updateSettings,
    videoItems = [],
    setCurrentPage,
    setSelectedItemId,
    showToast
  } = useAppStore();

  const workspace = React.useMemo(
    () => normalizeKanbanWorkspace(settings.ui?.kanbanWorkspace),
    [settings.ui?.kanbanWorkspace]
  );
  const board = workspace.boards.find((item) => item.id === workspace.activeBoardId) || workspace.boards[0] || null;
  const summary = React.useMemo(() => board ? getKanbanBoardSummary(board) : null, [board]);

  const persistWorkspace = React.useCallback(async (nextWorkspace, message) => {
    await updateSettings?.({ ui: { kanbanWorkspace: normalizeKanbanWorkspace(nextWorkspace) } });
    if (message) showToast?.(message, "success");
  }, [showToast, updateSettings]);

  const persistBoard = React.useCallback((nextBoard, message) => {
    const nextWorkspace = {
      ...workspace,
      activeBoardId: nextBoard.id,
      boards: workspace.boards.map((item) => item.id === nextBoard.id ? nextBoard : item)
    };
    persistWorkspace(nextWorkspace, message);
  }, [persistWorkspace, workspace]);

  const createBoard = React.useCallback((input) => {
    persistWorkspace(addKanbanBoard(workspace, input), "تم إنشاء لوحة المشروع");
  }, [persistWorkspace, workspace]);

  const changeActiveBoard = React.useCallback((boardId) => {
    persistWorkspace(setActiveKanbanBoard(workspace, boardId));
  }, [persistWorkspace, workspace]);

  const openItem = React.useCallback((item) => {
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  }, [setCurrentPage, setSelectedItemId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="va-page-shell space-y-5 p-4 sm:p-6"
      dir="rtl"
    >
      <PageHero
        icon={<Kanban className="h-6 w-6 va-accent-text" />}
        title="لوحات المشاريع"
        description="قسم مستقل لإدارة مشاريع Kanban مخصصة. لا تُضاف مواد الأرشيف أو بطاقات العمل تلقائياً؛ كل بطاقة تُنشأ يدوياً ويمكن ربطها بمادة عند الحاجة."
        actions={
          <div className="min-w-[14rem]">
            {workspace.boards.length > 0 && (
              <select
                value={board?.id || ""}
                onChange={(event) => changeActiveBoard(event.target.value)}
                aria-label="اختيار لوحة المشروع"
                className="min-h-10 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text)] outline-none"
              >
                {workspace.boards.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            )}
          </div>
        }
      >
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PROJECT_BOARD_TIPS.map((tip) => (
            <p key={tip} className="rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-2 text-xs leading-5 text-[var(--va-text-2)]">
              {tip}
            </p>
          ))}
        </div>
      </PageHero>

      <Section icon={<LayoutDashboard className="h-4 w-4 va-accent-text" />} title="إنشاء لوحة مشروع">
        <NewBoardForm onCreate={createBoard} />
      </Section>

      {!board ? (
        <EmptyState
          icon={<Kanban className="h-16 w-16" />}
          title="لا توجد لوحات مشاريع بعد"
          description="أنشئ لوحة أولاً، ثم أضف الأعمدة والبطاقات والحقول يدويًا حسب طريقة عملك."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat icon={<Columns3 className="h-3.5 w-3.5" />} label="الأعمدة" value={summary.columns} />
            <Stat icon={<ClipboardList className="h-3.5 w-3.5" />} label="البطاقات" value={summary.cards} />
            <Stat icon={<Database className="h-3.5 w-3.5" />} label="بطاقات مفتوحة" value={summary.openCards} />
            <Stat icon={<CalendarDays className="h-3.5 w-3.5" />} label="متأخرة" value={summary.overdueCards} />
            <Stat icon={<Palette className="h-3.5 w-3.5" />} label="حقول مخصصة" value={summary.customFields} />
          </div>

          <BoardSettings board={board} workspace={workspace} onPersist={persistWorkspace} />

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(25rem,0.8fr)]">
            <ColumnManager board={board} onBoardChange={persistBoard} />
            <FieldManager board={board} onBoardChange={persistBoard} />
          </div>

          <CardBuilder board={board} videoItems={videoItems} onBoardChange={(nextBoard) => persistBoard(nextBoard, "تم حفظ البطاقة")} />

          <BoardColumns board={board} videoItems={videoItems} onBoardChange={persistBoard} onOpenItem={openItem} />
        </>
      )}
    </motion.div>
  );
}

KanbanPage.pageId = "kanban";
KanbanPage.pageTitle = "لوحات المشاريع";
KanbanPage.migrationStatus = "native";

export default KanbanPage;
