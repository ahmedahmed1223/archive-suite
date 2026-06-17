import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { MessageSquare, Clock, Crop, StickyNote, Trash2, Plus } from "lucide-react";

import {
  sortNotes,
  filterNotesForItem,
  describeNoteAnchor,
  formatNoteTime
} from "../../features/itemNotes/itemNotesModel.js";

// §1319 — Personal notes for an archived item, optionally anchored to a media
// time (video/audio) or kept as a general note. Failure-safe and non-blocking:
// callbacks are optional and any rejection is swallowed by the caller's store.

function anchorIcon(note) {
  if (note?.timestamp !== null && note?.timestamp !== undefined) {
    return jsx(Clock, { className: "h-3 w-3", "aria-hidden": "true" });
  }
  if (note?.region) return jsx(Crop, { className: "h-3 w-3", "aria-hidden": "true" });
  return jsx(StickyNote, { className: "h-3 w-3", "aria-hidden": "true" });
}

function NoteRow({ note, canDelete, onSeek, onRemove }) {
  const isTimeAnchored = note.timestamp !== null && note.timestamp !== undefined;
  return jsxs("li", {
    className: "group rounded-xl border border-white/10 bg-gray-950/30 p-3",
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-2", children: [
        jsxs("div", { className: "flex min-w-0 flex-wrap items-center gap-2", children: [
          isTimeAnchored
            ? jsxs("button", {
                type: "button",
                onClick: () => onSeek?.(note.timestamp),
                className: "inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25",
                "aria-label": `الانتقال إلى ${formatNoteTime(note.timestamp)}`,
                children: [anchorIcon(note), describeNoteAnchor(note)]
              })
            : jsxs("span", {
                className: "inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-gray-300",
                children: [anchorIcon(note), describeNoteAnchor(note)]
              }),
          jsx("span", { className: "truncate text-xs text-gray-400", children: note.authorName }),
          note.createdAt
            ? jsx("span", { className: "text-[11px] text-gray-600", children: new Date(note.createdAt).toLocaleString("ar") })
            : null
        ] }),
        canDelete
          ? jsx("button", {
              type: "button",
              onClick: () => onRemove?.(note.id),
              "aria-label": "حذف الملاحظة",
              className: "shrink-0 rounded-lg p-1.5 text-gray-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100",
              children: jsx(Trash2, { className: "h-3.5 w-3.5", "aria-hidden": "true" })
            })
          : null
      ] }),
      jsx("p", { className: "mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-200", dir: "auto", children: note.body })
    ]
  }, note.id);
}

/**
 * @param {object} props
 * @param {string} props.itemId
 * @param {object[]} props.notes - all loaded notes (filtered/sorted internally)
 * @param {{ id?: string, name?: string }} [props.currentUser]
 * @param {number} [props.currentTime] - current media playback time in seconds
 * @param {boolean} [props.canAnchorTime] - whether a media currentTime is available
 * @param {(note: object) => void} props.onAdd
 * @param {(id: string) => void} props.onRemove
 * @param {(seconds: number) => void} [props.onSeek]
 */
export function ItemNotesPanel({
  itemId,
  notes = [],
  currentUser = null,
  currentTime = 0,
  canAnchorTime = false,
  onAdd,
  onRemove,
  onSeek
}) {
  const [body, setBody] = React.useState("");
  const [anchorAtTime, setAnchorAtTime] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const itemNotes = React.useMemo(
    () => sortNotes(filterNotesForItem(notes, itemId)),
    [notes, itemId]
  );

  const handleAdd = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onAdd?.({
        itemId,
        body: text,
        timestamp: anchorAtTime && canAnchorTime ? Number(currentTime) || 0 : null,
        authorId: currentUser?.id || "",
        authorName: currentUser?.name || currentUser?.username || currentUser?.displayName || "مجهول"
      });
      setBody("");
      setAnchorAtTime(false);
    } finally {
      setBusy(false);
    }
  };

  const currentUserId = currentUser?.id || "";

  return jsxs("section", {
    role: "region",
    "aria-label": "ملاحظات العنصر",
    dir: "rtl",
    className: "space-y-4 rounded-2xl border border-white/10 bg-gray-900/50 p-4",
    children: [
      jsxs("header", { className: "flex items-center gap-2", children: [
        jsx(MessageSquare, { className: "h-5 w-5 va-accent-text", "aria-hidden": "true" }),
        jsx("h2", { className: "text-base font-semibold text-white", children: "ملاحظاتي" }),
        jsx("span", { className: "mr-auto rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-400", children: itemNotes.length })
      ] }),

      jsxs("div", { className: "space-y-2 rounded-xl border border-white/10 bg-gray-950/30 p-3", children: [
        jsx("textarea", {
          value: body,
          onChange: (event) => setBody(event.target.value),
          rows: 3,
          dir: "auto",
          placeholder: "اكتب ملاحظة شخصية…",
          className: "textarea textarea-bordered w-full"
        }),
        jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
          canAnchorTime
            ? jsxs("label", { className: "inline-flex items-center gap-2 text-xs text-gray-300", children: [
                jsx("input", {
                  type: "checkbox",
                  checked: anchorAtTime,
                  onChange: (event) => setAnchorAtTime(event.target.checked),
                  className: "h-4 w-4"
                }),
                jsxs("span", { children: ["ربط بالوقت الحالي (", formatNoteTime(currentTime), ")"] })
              ] })
            : jsx("span", { className: "text-[11px] text-gray-600", children: "ملاحظة عامة" }),
          jsxs("button", {
            type: "button",
            onClick: handleAdd,
            disabled: busy || !body.trim(),
            className: "btn btn-primary btn-sm gap-2",
            children: [jsx(Plus, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), "إضافة ملاحظة"]
          })
        ] })
      ] }),

      itemNotes.length
        ? jsx("ul", { className: "space-y-2", role: "list", children: itemNotes.map((note) => NoteRow({
            note,
            canDelete: !note.authorId || note.authorId === currentUserId,
            onSeek,
            onRemove
          })) })
        : jsxs("div", { className: "rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center", children: [
            jsx(StickyNote, { className: "mx-auto h-8 w-8 text-gray-600", "aria-hidden": "true" }),
            jsx("p", { className: "mt-3 text-sm font-medium text-gray-300", children: "لا توجد ملاحظات بعد" }),
            jsx("p", { className: "mt-1 text-xs text-gray-500", children: "أضف ملاحظة شخصية أو اربطها بلحظة زمنية في الوسائط." })
          ] })
    ]
  });
}

ItemNotesPanel.displayName = "ItemNotesPanel";

export default ItemNotesPanel;
