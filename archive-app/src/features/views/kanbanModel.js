export const KANBAN_FIELD_TYPES = ["text", "number", "date", "select", "url"];

export const DEFAULT_KANBAN_COLUMNS = [
  { id: "backlog", title: "قيد التخطيط", color: "#64748b", wipLimit: 0 },
  { id: "active", title: "قيد التنفيذ", color: "#38bdf8", wipLimit: 0 },
  { id: "review", title: "مراجعة", color: "#f59e0b", wipLimit: 0 },
  { id: "done", title: "منجز", color: "#10b981", wipLimit: 0 }
];

const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function makeId(prefix = "kb", now = new Date()) {
  const stamp = String(new Date(now).getTime() || Date.now()).toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${random}`;
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeField(field = {}) {
  const id = cleanText(field.id) || makeId("field");
  const type = KANBAN_FIELD_TYPES.includes(field.type) ? field.type : "text";
  return {
    id,
    label: cleanText(field.label, id),
    type,
    options: Array.isArray(field.options) ? field.options.map((option) => cleanText(option)).filter(Boolean) : []
  };
}

function normalizeColumn(column = {}, index = 0) {
  const fallback = DEFAULT_KANBAN_COLUMNS[index] || DEFAULT_KANBAN_COLUMNS[0];
  const id = cleanText(column.id) || makeId("column");
  const wipLimit = Number(column.wipLimit);
  return {
    id,
    title: cleanText(column.title, fallback.title),
    color: cleanText(column.color, fallback.color),
    wipLimit: Number.isFinite(wipLimit) && wipLimit > 0 ? Math.floor(wipLimit) : 0
  };
}

function normalizeCard(card = {}, fallbackColumnId = "") {
  const id = cleanText(card.id) || makeId("card");
  const createdAt = card.createdAt || nowIso();
  return {
    id,
    columnId: cleanText(card.columnId, fallbackColumnId),
    title: cleanText(card.title, "مهمة بدون عنوان"),
    summary: cleanText(card.summary),
    owner: cleanText(card.owner),
    dueDate: cleanText(card.dueDate),
    priority: PRIORITIES.has(card.priority) ? card.priority : "medium",
    sourceItemId: cleanText(card.sourceItemId),
    fieldValues: card.fieldValues && typeof card.fieldValues === "object" ? { ...card.fieldValues } : {},
    createdAt,
    updatedAt: card.updatedAt || createdAt
  };
}

export function createKanbanBoard(input = {}, options = {}) {
  const createdAt = nowIso(options.now || new Date());
  const columns = Array.isArray(input.columns) && input.columns.length
    ? input.columns.map(normalizeColumn)
    : DEFAULT_KANBAN_COLUMNS.map((column) => ({ ...column }));
  return {
    id: cleanText(input.id) || makeId("board", options.now || new Date()),
    title: cleanText(input.title, "لوحة مشروع جديدة"),
    description: cleanText(input.description),
    fields: Array.isArray(input.fields) ? input.fields.map(normalizeField) : [],
    columns,
    cards: Array.isArray(input.cards)
      ? input.cards.map((card) => normalizeCard(card, columns[0]?.id || ""))
      : [],
    createdAt,
    updatedAt: createdAt
  };
}

export function normalizeKanbanWorkspace(workspace = {}) {
  const sourceBoards = Array.isArray(workspace.boards) ? workspace.boards : [];
  const boards = sourceBoards.map((board) => {
    const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
    const columnIds = new Set(normalized.columns.map((column) => column.id));
    const fallbackColumnId = normalized.columns[0]?.id || "";
    return {
      ...normalized,
      id: cleanText(board.id, normalized.id),
      createdAt: board.createdAt || normalized.createdAt,
      updatedAt: board.updatedAt || normalized.updatedAt,
      cards: normalized.cards.map((card) => ({
        ...card,
        columnId: columnIds.has(card.columnId) ? card.columnId : fallbackColumnId
      }))
    };
  });
  const activeBoardId = boards.some((board) => board.id === workspace.activeBoardId)
    ? workspace.activeBoardId
    : boards[0]?.id || "";
  return {
    activeBoardId,
    boards
  };
}

export function setActiveKanbanBoard(workspace = {}, boardId = "") {
  const normalized = normalizeKanbanWorkspace(workspace);
  return {
    ...normalized,
    activeBoardId: normalized.boards.some((board) => board.id === boardId)
      ? boardId
      : normalized.activeBoardId
  };
}

export function addKanbanBoard(workspace = {}, input = {}, options = {}) {
  const normalized = normalizeKanbanWorkspace(workspace);
  const board = createKanbanBoard(input, options);
  return {
    activeBoardId: board.id,
    boards: [...normalized.boards, board]
  };
}

export function updateKanbanBoard(workspace = {}, boardId = "", patch = {}) {
  const normalized = normalizeKanbanWorkspace(workspace);
  return {
    ...normalized,
    boards: normalized.boards.map((board) => board.id === boardId
      ? {
          ...board,
          title: patch.title === undefined ? board.title : cleanText(patch.title, board.title),
          description: patch.description === undefined ? board.description : cleanText(patch.description),
          updatedAt: nowIso()
        }
      : board)
  };
}

export function addKanbanColumn(board = {}, title = "", options = {}) {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  const column = normalizeColumn({
    id: options.id || makeId("column", options.now || new Date()),
    title: cleanText(title, "عمود جديد"),
    color: options.color || "#64748b",
    wipLimit: options.wipLimit || 0
  });
  return {
    ...normalized,
    columns: [...normalized.columns, column],
    updatedAt: nowIso(options.now || new Date())
  };
}

export function updateKanbanColumn(board = {}, columnId = "", patch = {}) {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  return {
    ...normalized,
    columns: normalized.columns.map((column) => column.id === columnId
      ? {
          ...column,
          title: patch.title === undefined ? column.title : cleanText(patch.title, column.title),
          color: patch.color === undefined ? column.color : cleanText(patch.color, column.color),
          wipLimit: patch.wipLimit === undefined ? column.wipLimit : Math.max(0, Math.floor(Number(patch.wipLimit) || 0))
        }
      : column),
    updatedAt: nowIso()
  };
}

export function removeKanbanColumn(board = {}, columnId = "") {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  if (normalized.columns.length <= 1) return normalized;
  if (normalized.cards.some((card) => card.columnId === columnId)) return normalized;
  return {
    ...normalized,
    columns: normalized.columns.filter((column) => column.id !== columnId),
    updatedAt: nowIso()
  };
}

export function addKanbanField(board = {}, field = {}, options = {}) {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  const nextField = normalizeField({
    ...field,
    id: field.id || makeId("field", options.now || new Date())
  });
  return {
    ...normalized,
    fields: [...normalized.fields, nextField],
    updatedAt: nowIso(options.now || new Date())
  };
}

export function removeKanbanField(board = {}, fieldId = "") {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  return {
    ...normalized,
    fields: normalized.fields.filter((field) => field.id !== fieldId),
    cards: normalized.cards.map((card) => {
      const { [fieldId]: _removed, ...fieldValues } = card.fieldValues || {};
      return { ...card, fieldValues };
    }),
    updatedAt: nowIso()
  };
}

export function addKanbanCard(board = {}, input = {}, options = {}) {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  const fallbackColumnId = normalized.columns[0]?.id || "";
  const columnId = normalized.columns.some((column) => column.id === input.columnId)
    ? input.columnId
    : fallbackColumnId;
  const card = normalizeCard({
    ...input,
    id: input.id || makeId("card", options.now || new Date()),
    columnId,
    createdAt: options.now ? nowIso(options.now) : input.createdAt
  }, columnId);
  return {
    ...normalized,
    cards: [...normalized.cards, card],
    updatedAt: nowIso(options.now || new Date())
  };
}

export function updateKanbanCard(board = {}, cardId = "", patch = {}) {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  return {
    ...normalized,
    cards: normalized.cards.map((card) => card.id === cardId
      ? normalizeCard({
          ...card,
          ...patch,
          fieldValues: patch.fieldValues ? { ...(card.fieldValues || {}), ...patch.fieldValues } : card.fieldValues,
          updatedAt: nowIso()
        }, card.columnId)
      : card),
    updatedAt: nowIso()
  };
}

export function moveKanbanCard(board = {}, cardId = "", columnId = "") {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  if (!normalized.columns.some((column) => column.id === columnId)) return normalized;
  return updateKanbanCard(normalized, cardId, { columnId });
}

export function removeKanbanCard(board = {}, cardId = "") {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  return {
    ...normalized,
    cards: normalized.cards.filter((card) => card.id !== cardId),
    updatedAt: nowIso()
  };
}

export function getKanbanBoardSummary(board = {}) {
  const normalized = createKanbanBoard(board, { now: board.createdAt || new Date() });
  const openCards = normalized.cards.filter((card) => card.columnId !== "done").length;
  const overdueCards = normalized.cards.filter((card) => {
    if (!card.dueDate) return false;
    const due = new Date(card.dueDate).getTime();
    return Number.isFinite(due) && due < Date.now() && card.columnId !== "done";
  }).length;
  return {
    columns: normalized.columns.length,
    cards: normalized.cards.length,
    openCards,
    overdueCards,
    customFields: normalized.fields.length
  };
}
