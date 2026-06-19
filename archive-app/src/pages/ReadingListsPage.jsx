import {
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ListChecks,
  PlayCircle,
  Plus,
  Trash2,
  X
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { ReadingListProgressBadge } from "../components/lists/ReadingListProgressBadge.jsx";
import { EmptyState, SkeletonText } from "../components/ui/primitives.jsx";
import { useAppStore } from "../stores/index.js";
import {
  DEFAULT_WATCH_LATER_ID,
  READING_LIST_STATUS
} from "../stores/slices/readingListsSlice.js";

const STATUS_CYCLE = {
  [READING_LIST_STATUS.NOT_STARTED]: READING_LIST_STATUS.IN_PROGRESS,
  [READING_LIST_STATUS.IN_PROGRESS]: READING_LIST_STATUS.COMPLETED,
  [READING_LIST_STATUS.COMPLETED]: READING_LIST_STATUS.NOT_STARTED
};

function StatusButton({ status, onCycle }) {
  return jsx("button", {
    type: "button",
    title: "تغيير الحالة",
    "aria-label": "تغيير حالة العنصر",
    onClick: onCycle,
    className: "shrink-0 rounded p-0.5 transition-colors hover:bg-[var(--va-surface-2)]",
    children: jsx(ReadingListProgressBadge, { status, showLabel: false })
  });
}

function ListItemRow({ entry, onRemove, onCycleStatus, onNavigate }) {
  return jsxs("div", {
    className:
      "card group flex flex-row items-center gap-3 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-4 py-3 transition-colors hover:border-emerald-500/25 hover:bg-[var(--va-surface-2)]",
    children: [
      jsx(StatusButton, { status: entry.status, onCycle: () => onCycleStatus(entry) }),
      jsxs("div", {
        role: "button",
        tabIndex: 0,
        className: "flex-1 min-w-0 cursor-pointer",
        onClick: () => onNavigate(entry),
        onKeyDown: (e) => e.key === "Enter" && onNavigate(entry),
        children: [
          jsx("p", {
            className: `truncate text-sm font-medium ${
              entry.status === READING_LIST_STATUS.COMPLETED
                ? "line-through text-[var(--va-text-muted)]"
                : "text-[var(--va-text)]"
            }`,
            children: entry.itemTitle || entry.itemId
          }),
          jsx(ReadingListProgressBadge, { status: entry.status, showLabel: true })
        ]
      }),
      jsx("button", {
        type: "button",
        title: "إزالة من القائمة",
        "aria-label": "إزالة من القائمة",
        onClick: () => onRemove(entry),
        className:
          "btn btn-ghost btn-circle btn-sm invisible shrink-0 rounded-lg p-1.5 text-[var(--va-text-muted)] hover:bg-rose-500/10 hover:text-rose-400 group-hover:visible focus-visible:visible transition-colors",
        children: jsx(X, { className: "h-4 w-4" })
      })
    ]
  });
}

function ListSection({ list, items, onRemoveItem, onCycleStatus, onDeleteList, onNavigate }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pending = items.filter((i) => i.status !== READING_LIST_STATUS.COMPLETED).length;
  const done = items.filter((i) => i.status === READING_LIST_STATUS.COMPLETED).length;

  return jsxs("div", {
    className: "mb-6",
    children: [
      jsxs("div", {
        className: "mb-2 flex items-center gap-2",
        children: [
          jsx("button", {
            type: "button",
            onClick: () => setCollapsed((c) => !c),
            className:
              "flex items-center gap-2 text-sm font-semibold text-[var(--va-text-2)] hover:text-[var(--va-text)] transition-colors",
            children: [
              collapsed
                ? jsx(ChevronRight, { className: "h-4 w-4 shrink-0 text-[var(--va-text-muted)]" })
                : jsx(ChevronDown, { className: "h-4 w-4 shrink-0 text-[var(--va-text-muted)]" }),
              list.id === DEFAULT_WATCH_LATER_ID
                ? jsx(BookmarkCheck, { className: "h-4 w-4 text-[var(--va-status-info)]" })
                : jsx(ListChecks, { className: "h-4 w-4 text-[var(--va-text-2)]" }),
              jsx("span", { children: list.title })
            ]
          }),
          pending > 0 &&
            jsx("span", {
              className: "badge badge-sm rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300",
              children: `${pending} متبق`
            }),
          done > 0 &&
            jsx("span", {
              className: "badge badge-sm rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300",
              children: `${done} مكتمل`
            }),
          jsx("span", { className: "flex-1" }),
          !list.isDefault &&
            jsx("button", {
              type: "button",
              title: "حذف القائمة",
              "aria-label": "حذف القائمة",
              onClick: () => onDeleteList(list.id),
              className:
                "btn btn-ghost btn-circle btn-sm rounded-lg p-1.5 text-[var(--va-text-muted)] hover:bg-rose-500/10 hover:text-rose-400 transition-colors",
              children: jsx(Trash2, { className: "h-3.5 w-3.5" })
            })
        ]
      }),
      !collapsed &&
        jsxs("div", {
          className: "space-y-2 pl-6",
          children: [
            items.length === 0 &&
              jsx("p", {
                className: "py-4 text-center text-sm text-[var(--va-text-muted)]",
                children: "لا توجد عناصر في هذه القائمة بعد"
              }),
            items.map((entry) =>
              jsx(ListItemRow, {
                entry,
                onRemove: onRemoveItem,
                onCycleStatus,
                onNavigate
              }, entry.id)
            )
          ]
        })
    ]
  });
}

function NewListDialog({ onClose, onCreate }) {
  const [title, setTitle] = React.useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (title.trim()) {
      onCreate(title.trim());
      onClose();
    }
  }

  return jsx("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "إنشاء قائمة جديدة",
    className: "modal modal-open fixed inset-0 z-[var(--va-z-modal)] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4",
    children: jsxs("form", {
      onSubmit: handleSubmit,
      className:
        "modal-box w-full max-w-sm rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-6 shadow-[var(--va-elev-popover)]",
      children: [
        jsx("h2", {
          className: "mb-4 text-base font-semibold text-[var(--va-text)]",
          children: "قائمة جديدة"
        }),
        jsx("input", {
          type: "text",
          value: title,
          onChange: (e) => setTitle(e.target.value),
          placeholder: "اسم القائمة",
          "aria-label": "اسم القائمة",
          autoFocus: true,
          maxLength: 80,
          className:
            "input input-bordered va-bidi-input mb-4 w-full rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface)] px-3 py-2 text-sm text-[var(--va-text)] placeholder:text-[var(--va-text-muted)] focus-visible:border-emerald-500/60 focus:outline-none"
        }),
        jsxs("div", {
          className: "modal-action flex justify-end gap-2",
          children: [
            jsx("button", {
              type: "button",
              onClick: onClose,
              className: "btn btn-ghost rounded-[var(--va-radius-md)] px-4 py-2 text-sm text-[var(--va-text-2)] hover:text-[var(--va-text)] transition-colors",
              children: "إلغاء"
            }),
            jsx("button", {
              type: "submit",
              disabled: !title.trim(),
              className:
                "btn btn-primary rounded-[var(--va-radius-md)] bg-emerald-500 px-4 py-2 text-sm font-medium text-[var(--va-text-inverse)] hover:bg-emerald-600 disabled:opacity-40 transition-colors",
              children: "إنشاء"
            })
          ]
        })
      ]
    })
  });
}

export default function ReadingListsPage() {
  const {
    readingLists,
    readingListItems,
    readingListsLoading,
    readingListsError,
    loadReadingListsFromStorage,
    createCustomReadingList,
    deleteReadingList,
    removeFromReadingList,
    updateReadingListItemStatus,
    getListItems,
    setCurrentPage,
    setSelectedItemId
  } = useAppStore();

  const [showNewList, setShowNewList] = React.useState(false);
  const [filter, setFilter] = React.useState("all");

  React.useEffect(() => {
    loadReadingListsFromStorage();
  }, []);

  function handleNavigate(entry) {
    setSelectedItemId?.(entry.itemId);
    setCurrentPage?.("detail");
  }

  function handleCycleStatus(entry) {
    const next = STATUS_CYCLE[entry.status] ?? READING_LIST_STATUS.NOT_STARTED;
    updateReadingListItemStatus({ listId: entry.listId, itemId: entry.itemId, status: next });
  }

  const totalPending = readingListItems.filter(
    (i) => i.status !== READING_LIST_STATUS.COMPLETED
  ).length;

  const filteredLists = React.useMemo(() => {
    if (filter === "all") return readingLists;
    return readingLists.filter((l) => {
      const items = readingListItems.filter((i) => i.listId === l.id);
      if (filter === "pending")
        return items.some((i) => i.status !== READING_LIST_STATUS.COMPLETED);
      if (filter === "completed")
        return items.some((i) => i.status === READING_LIST_STATUS.COMPLETED);
      return true;
    });
  }, [readingLists, readingListItems, filter]);

  if (readingListsLoading) {
    return jsx("div", {
      className: "mx-auto max-w-2xl px-4 py-8",
      children: jsx(SkeletonText, { lines: 6 })
    });
  }

  return jsxs("div", {
    className: "mx-auto max-w-2xl px-4 py-8",
    children: [
      jsxs("div", {
        className: "mb-6 flex items-start justify-between gap-4",
        children: [
          jsxs("div", {
            children: [
              jsxs("h1", {
                className: "flex items-center gap-2 text-lg font-bold text-[var(--va-text)]",
                children: [
                  jsx(ListChecks, { className: "h-5 w-5 text-[var(--va-status-info)]" }),
                  "قوائم المراجعة"
                ]
              }),
              totalPending > 0 &&
                jsx("p", {
                  className: "mt-1 text-sm text-[var(--va-text-muted)]",
                  children: `${totalPending} عنصر لم تتم مراجعته بعد`
                })
            ]
          }),
          jsx("button", {
            type: "button",
            onClick: () => setShowNewList(true),
            className:
              "btn btn-sm inline-flex items-center gap-1.5 rounded-[var(--va-radius-md)] bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25 transition-colors",
            children: [jsx(Plus, { className: "h-4 w-4" }), "قائمة جديدة"]
          })
        ]
      }),

      jsxs("div", {
        className: "mb-5 flex gap-2",
        children: [
          ["all", "الكل"],
          ["pending", "قيد المراجعة"],
          ["completed", "المكتملة"]
        ].map(([val, label]) =>
          jsx("button", {
            type: "button",
            onClick: () => setFilter(val),
            "aria-pressed": filter === val,
            className: `btn btn-xs btn-ghost rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === val
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-[var(--va-text-muted)] hover:text-[var(--va-text-2)]"
            }`,
            children: label
          }, val)
        )
      }),

      readingListsError &&
        jsx("div", {
          role: "alert",
          className:
            "alert alert-error block mb-4 rounded-[var(--va-radius-md)] border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-400",
          children: readingListsError
        }),

      readingLists.length === 0 &&
        jsx(EmptyState, {
          icon: jsx(ListChecks, { className: "h-7 w-7" }),
          title: "لا توجد قوائم مراجعة بعد",
          description: "أنشئ قائمة لتجميع العناصر التي تريد متابعتها أو مراجعتها لاحقًا."
        }),

      filteredLists.map((list) => {
        const items = getListItems(list.id);
        return jsx(ListSection, {
          list,
          items,
          onRemoveItem: (entry) =>
            removeFromReadingList({ listId: entry.listId, itemId: entry.itemId }),
          onCycleStatus: handleCycleStatus,
          onDeleteList: deleteReadingList,
          onNavigate: handleNavigate
        }, list.id);
      }),

      showNewList &&
        jsx(NewListDialog, {
          onClose: () => setShowNewList(false),
          onCreate: (title) => createCustomReadingList({ title })
        })
    ]
  });
}
