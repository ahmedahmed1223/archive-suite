import {
  Archive,
  CheckCheck,
  Clock,
  Inbox,
  Link2,
  SortAsc,
  Tag,
  Trash2
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { QuickCaptureWidget } from "../components/capture/QuickCaptureWidget.jsx";
import { EmptyState as UIEmptyState, SkeletonCard } from "../components/ui/primitives.jsx";
import { useAppStore } from "../stores/index.js";
import { INBOX_SORT } from "../stores/slices/inboxSlice.js";

const { useEffect, useState, useCallback, useRef } = React;

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} يوم`;
}

function InboxItemCard({ item, onArchive, onDismiss }) {
  return jsxs("div", {
    className:
      "group relative flex flex-col gap-2 rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 shadow-[var(--va-elev-1)] transition-colors hover:border-emerald-500/25",
    children: [
      jsxs("div", {
        className: "flex items-start gap-3",
        children: [
          jsxs("div", {
            className: "flex-1 min-w-0 space-y-1.5",
            children: [
              jsx("p", {
                className: "text-sm font-medium text-[var(--va-text)] leading-snug break-words",
                dir: "rtl",
                children: item.title
              }),
              item.url &&
                jsxs("a", {
                  href: item.url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className:
                    "inline-flex items-center gap-1 text-xs text-[var(--va-action)] hover:underline truncate max-w-full",
                  dir: "ltr",
                  children: [jsx(Link2, { size: 10 }), jsx("span", { className: "truncate", children: item.url })]
                }),
              item.tags?.length > 0 &&
                jsx("div", {
                  className: "flex flex-wrap gap-1",
                  children: item.tags.map((t) =>
                    jsxs("span", {
                      className:
                        "inline-flex items-center gap-0.5 rounded-full bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-2)]",
                      children: [jsx(Tag, { size: 9 }), t]
                    }, t)
                  )
                })
            ]
          }),
          jsxs("div", {
            className: "flex items-center gap-1 shrink-0",
            children: [
              jsx("button", {
                type: "button",
                onClick: () => onArchive(item.id),
                title: "أرشفة العنصر",
                "aria-label": "أرشفة العنصر",
                className:
                  "rounded-[var(--va-radius-md)] p-1.5 text-[var(--va-text-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all hover:bg-[var(--va-surface-2)] hover:text-emerald-300",
                children: jsx(Archive, { size: 15 })
              }),
              jsx("button", {
                type: "button",
                onClick: () => onDismiss(item.id),
                title: "حذف من الوارد",
                "aria-label": "حذف من الوارد",
                className:
                  "rounded-[var(--va-radius-md)] p-1.5 text-[var(--va-text-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all hover:bg-[var(--va-surface-2)] hover:text-rose-400",
                children: jsx(Trash2, { size: 15 })
              })
            ]
          })
        ]
      }),
      jsxs("div", {
        className: "flex items-center gap-1.5 text-xs text-[var(--va-text-muted)]",
        children: [jsx(Clock, { size: 11 }), jsx("span", { children: relativeTime(item.capturedAt) })]
      })
    ]
  });
}

const SORT_OPTIONS = [
  { value: INBOX_SORT.NEWEST, label: "الأحدث أولاً" },
  { value: INBOX_SORT.OLDEST, label: "الأقدم أولاً" },
  { value: INBOX_SORT.TITLE, label: "ترتيب أبجدي" }
];

export default function InboxPage() {
  const inboxItems = useAppStore((s) => s.inboxItems);
  const inboxLoading = useAppStore((s) => s.inboxLoading);
  const inboxSort = useAppStore((s) => s.inboxSort);
  const loadInboxFromStorage = useAppStore((s) => s.loadInboxFromStorage);
  const captureInboxItem = useAppStore((s) => s.captureInboxItem);
  const archiveInboxItem = useAppStore((s) => s.archiveInboxItem);
  const dismissInboxItem = useAppStore((s) => s.dismissInboxItem);
  const archiveAllInboxItems = useAppStore((s) => s.archiveAllInboxItems);
  const setInboxSort = useAppStore((s) => s.setInboxSort);
  const showNotification = useAppStore((s) => s.showNotification);
  const addVideoItem = useAppStore((s) => s.addVideoItem);
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    loadInboxFromStorage();
  }, [loadInboxFromStorage]);

  const handleCapture = useCallback(
    async (data) => {
      const item = await captureInboxItem(data);
      if (item) {
        showNotification?.({ message: "تم الالتقاط في صندوق الوارد", type: "success", duration: 2000 });
      }
    },
    [captureInboxItem, showNotification]
  );

  const handleArchive = useCallback(
    async (id) => {
      const item = inboxItems.find((i) => i.id === id);
      if (!item) return;
      let archivedId = null;
      if (addVideoItem) {
        const created = await addVideoItem({
          title: item.title,
          notes: item.notes || "",
          tags: item.tags || [],
          url: item.url || "",
          documentType: "note"
        }).catch(() => null);
        archivedId = created?.id ?? null;
      }
      await archiveInboxItem(id, archivedId);
      showNotification?.({
        message: "تمت الأرشفة",
        type: "success",
        duration: 2500,
        ...(archivedId && navigate
          ? { action: { label: "عرض", run: () => navigate("detail", { id: archivedId }) } }
          : {})
      });
    },
    [inboxItems, addVideoItem, archiveInboxItem, showNotification, navigate]
  );

  const handleDismiss = useCallback(
    async (id) => {
      await dismissInboxItem(id);
      showNotification?.({ message: "حُذف من الوارد", type: "info", duration: 1500 });
    },
    [dismissInboxItem, showNotification]
  );

  const handleArchiveAll = useCallback(async () => {
    const count = await archiveAllInboxItems();
    showNotification?.({ message: `تمت أرشفة ${count} عنصر`, type: "success", duration: 2500 });
  }, [archiveAllInboxItems, showNotification]);

  const hasItems = inboxItems.length > 0;

  return jsxs("div", {
    className: "flex flex-col gap-6 p-4 md:p-6 max-w-2xl mx-auto",
    children: [
      jsxs("div", {
        className: "flex items-center justify-between gap-4",
        children: [
          jsxs("div", {
            children: [
              jsxs("h1", {
                className: "text-xl font-semibold text-[var(--va-text)] flex items-center gap-2",
                children: [jsx(Inbox, { size: 20 }), "صندوق الوارد"]
              }),
              jsx("p", {
                className: "text-sm text-[var(--va-text-muted)] mt-0.5",
                children: "التقط الأفكار بسرعة ونظّمها لاحقاً"
              })
            ]
          }),
          hasItems &&
            jsxs("button", {
              type: "button",
              onClick: handleArchiveAll,
              className:
                "flex items-center gap-1.5 rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] px-3 py-1.5 text-xs text-[var(--va-text-2)] hover:text-[var(--va-text)] hover:bg-[var(--va-surface-2)] transition-colors",
              children: [jsx(CheckCheck, { size: 13 }), "أرشفة الكل"]
            })
        ]
      }),

      jsx(QuickCaptureWidget, {
        onCapture: handleCapture,
        placeholder: "ما الذي تريد حفظه؟ (Enter للإضافة)",
        autoFocus: true
      }),

      hasItems &&
        jsxs("div", {
          className: "flex items-center justify-between gap-3",
          children: [
            jsx("span", {
              className: "text-sm text-[var(--va-text-muted)]",
              children: `${inboxItems.length} عنصر في الانتظار`
            }),
            jsxs("div", {
              className: "flex items-center gap-1.5",
              children: [
                jsx(SortAsc, { size: 13, className: "text-[var(--va-text-muted)]" }),
                jsx("select", {
                  value: inboxSort,
                  onChange: (e) => setInboxSort(e.target.value),
                  "aria-label": "ترتيب العناصر",
                  className:
                    "rounded-[var(--va-radius-md)] border border-[var(--va-border-strong)] bg-[var(--va-surface)] px-2 py-1 text-xs text-[var(--va-text-2)] outline-none focus-visible:border-emerald-500/60 cursor-pointer",
                  children: SORT_OPTIONS.map(({ value, label }) =>
                    jsx("option", { value, children: label }, value)
                  )
                })
              ]
            })
          ]
        }),

      inboxLoading && !hasItems
        ? jsxs("div", {
            className: "flex flex-col gap-2",
            children: [jsx(SkeletonCard, {}, 0), jsx(SkeletonCard, {}, 1), jsx(SkeletonCard, {}, 2)]
          })
        : !hasItems
        ? jsx(UIEmptyState, {
            icon: jsx(Inbox, { className: "h-7 w-7" }),
            title: "صندوق الوارد فارغ",
            description: "التقط الأفكار والمحتوى بسرعة من الحقل أعلاه."
          })
        : jsx("div", {
            className: "flex flex-col gap-2",
            role: "list",
            "aria-label": "عناصر صندوق الوارد",
            children: inboxItems.map((item) =>
              jsx("div", {
                role: "listitem",
                children: jsx(InboxItemCard, { item, onArchive: handleArchive, onDismiss: handleDismiss })
              }, item.id)
            )
          })
    ]
  });
}
