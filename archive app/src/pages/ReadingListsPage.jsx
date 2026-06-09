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
    onClick: onCycle,
    className: "shrink-0 rounded p-0.5 transition-colors hover:bg-white/10",
    children: jsx(ReadingListProgressBadge, { status, showLabel: false })
  });
}

function ListItemRow({ entry, onRemove, onCycleStatus, onNavigate }) {
  return jsxs("div", {
    className:
      "group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] transition-colors",
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
                ? "line-through text-gray-500"
                : "text-gray-100"
            }`,
            children: entry.itemTitle || entry.itemId
          }),
          jsx(ReadingListProgressBadge, { status: entry.status, showLabel: true })
        ]
      }),
      jsx("button", {
        type: "button",
        title: "إزالة من القائمة",
        onClick: () => onRemove(entry),
        className:
          "invisible shrink-0 rounded-lg p-1.5 text-gray-600 hover:bg-red-500/10 hover:text-red-400 group-hover:visible transition-colors",
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
              "flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-white transition-colors",
            children: [
              collapsed
                ? jsx(ChevronRight, { className: "h-4 w-4 shrink-0 text-gray-500" })
                : jsx(ChevronDown, { className: "h-4 w-4 shrink-0 text-gray-500" }),
              list.id === DEFAULT_WATCH_LATER_ID
                ? jsx(BookmarkCheck, { className: "h-4 w-4 text-blue-400" })
                : jsx(ListChecks, { className: "h-4 w-4 text-gray-400" }),
              jsx("span", { children: list.title })
            ]
          }),
          pending > 0 &&
            jsx("span", {
              className: "rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300",
              children: `${pending} متبق`
            }),
          done > 0 &&
            jsx("span", {
              className: "rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400",
              children: `${done} مكتمل`
            }),
          jsx("span", { className: "flex-1" }),
          !list.isDefault &&
            jsx("button", {
              type: "button",
              title: "حذف القائمة",
              onClick: () => onDeleteList(list.id),
              className:
                "rounded-lg p-1.5 text-gray-600 hover:bg-red-500/10 hover:text-red-400 transition-colors",
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
                className: "py-4 text-center text-sm text-gray-600",
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
    className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4",
    children: jsxs("form", {
      onSubmit: handleSubmit,
      className:
        "w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-2xl",
      children: [
        jsx("h2", {
          className: "mb-4 text-base font-semibold text-gray-100",
          children: "قائمة جديدة"
        }),
        jsx("input", {
          type: "text",
          value: title,
          onChange: (e) => setTitle(e.target.value),
          placeholder: "اسم القائمة",
          autoFocus: true,
          maxLength: 80,
          className:
            "mb-4 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
        }),
        jsxs("div", {
          className: "flex justify-end gap-2",
          children: [
            jsx("button", {
              type: "button",
              onClick: onClose,
              className: "rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors",
              children: "إلغاء"
            }),
            jsx("button", {
              type: "submit",
              disabled: !title.trim(),
              className:
                "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 transition-colors",
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
      className: "flex h-full items-center justify-center text-gray-500",
      children: "جاري التحميل…"
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
                className: "flex items-center gap-2 text-lg font-bold text-gray-100",
                children: [
                  jsx(ListChecks, { className: "h-5 w-5 text-blue-400" }),
                  "قوائم المراجعة"
                ]
              }),
              totalPending > 0 &&
                jsx("p", {
                  className: "mt-1 text-sm text-gray-500",
                  children: `${totalPending} عنصر لم تتم مراجعته بعد`
                })
            ]
          }),
          jsx("button", {
            type: "button",
            onClick: () => setShowNewList(true),
            className:
              "inline-flex items-center gap-1.5 rounded-xl bg-blue-600/20 px-3 py-1.5 text-sm font-medium text-blue-300 hover:bg-blue-600/30 transition-colors",
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
            className: `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === val
                ? "bg-blue-600/30 text-blue-300"
                : "text-gray-500 hover:text-gray-300"
            }`,
            children: label
          }, val)
        )
      }),

      readingListsError &&
        jsx("div", {
          className:
            "mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400",
          children: readingListsError
        }),

      readingLists.length === 0 &&
        jsx("div", {
          className: "py-16 text-center",
          children: jsxs("div", {
            className: "mx-auto max-w-xs",
            children: [
              jsx(ListChecks, { className: "mx-auto mb-3 h-10 w-10 text-gray-700" }),
              jsx("p", {
                className: "text-sm text-gray-500",
                children: "لا توجد قوائم مراجعة بعد"
              })
            ]
          })
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
