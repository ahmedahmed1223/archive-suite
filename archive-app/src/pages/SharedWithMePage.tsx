// §16.7 — SharedWithMe page.
// Lets authenticated users open share links within the app context,
// and keeps a local history of previously accessed links.
// Email invitations (server-side) are a planned future slice.

import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Link2, Eye, MessageSquare, Download, Edit2, Inbox } from "lucide-react";

import { buildShareUrl } from "../features/share/shareClient.js";

const STORAGE_KEY = "archive_accessed_share_links";
const MAX_HISTORY = 50;

const PERMISSION_ICONS = {
  view: Eye,
  comment: MessageSquare,
  download: Download,
  edit: Edit2
};

const PERMISSION_LABELS = {
  view: "عرض",
  comment: "تعليق",
  download: "تحميل",
  edit: "تعديل"
};

function readHistory() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: any) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
    }
  } catch { /* ignore quota errors */ }
}

function addHistoryEntry(entry: any) {
  const entries = readHistory();
  const idx = entries.findIndex((e: any) => e.token === entry.token || (e.url && e.url === entry.url));
  if (idx >= 0) entries.splice(idx, 1, { ...entries[idx], lastAccessedAt: new Date().toISOString() });
  else entries.unshift(entry);
  saveHistory(entries);
}

function extractTokenFromInput(raw: any) {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split("/api/share/");
    if (pathParts.length > 1 && pathParts[1]) return { token: pathParts[1], url: trimmed };
    const shareParam = url.searchParams.get("shareToken") || url.searchParams.get("share");
    if (shareParam) return { token: shareParam, url: trimmed };
  } catch { /* not a URL */ }
  // Raw JWT: three dot-separated base64 parts
  if (trimmed.split(".").length === 3) return { token: trimmed, url: "" };
  return null;
}

function formatDate(iso: any) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function PermissionBadge({ permission }: any) {
  const Icon = (PERMISSION_ICONS as any)[permission] || Eye;
  const label = (PERMISSION_LABELS as any)[permission] || permission;
  return jsxs("span", {
    className: "badge badge-sm gap-1 badge-ghost",
    children: [jsx(Icon, { size: 10, className: "shrink-0" }), label]
  });
}

function HistoryCard({ entry, onOpen, onRemove }: any) {
  return jsxs("div", {
    className: "card card-border bg-base-100 p-3",
    children: [
      jsxs("div", {
        className: "flex items-start justify-between gap-2",
        children: [
          jsxs("div", {
            className: "flex-1 min-w-0",
            children: [
              jsx("p", { className: "font-medium text-sm truncate", children: entry.label || entry.url || `${entry.token.slice(0, 20)}…` }),
              entry.lastAccessedAt && jsx("p", {
                className: "text-xs text-base-content/50 mt-0.5",
                children: `آخر وصول: ${formatDate(entry.lastAccessedAt)}`
              })
            ]
          }),
          entry.permission && jsx(PermissionBadge, { permission: entry.permission })
        ]
      }),
      jsxs("div", {
        className: "flex gap-2 mt-2",
        children: [
          jsx("button", {
            type: "button",
            className: "btn btn-xs btn-primary flex-1",
            onClick: () => onOpen(entry),
            children: "فتح"
          }),
          jsx("button", {
            type: "button",
            className: "btn btn-xs btn-ghost text-error",
            onClick: () => onRemove(entry),
            children: "حذف"
          })
        ]
      })
    ]
  });
}

export default function SharedWithMePage({ openShareUrl }: any = {}) {
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [history, setHistory] = React.useState(readHistory);

  function handleOpen(entry: any) {
    addHistoryEntry({ ...entry, lastAccessedAt: new Date().toISOString() });
    setHistory(readHistory());
    const shareUrl = buildShareUrl(entry.token, {
      origin: typeof location !== "undefined" ? location.origin : ""
    });
    if (typeof openShareUrl === "function") {
      openShareUrl(shareUrl, entry);
    } else if (typeof window !== "undefined") {
      window.location.assign(shareUrl);
    }
  }

  function handleRemove(entry: any) {
    const updated = readHistory().filter((e: any) => e.token !== entry.token && e.url !== entry.url);
    saveHistory(updated);
    setHistory(updated);
  }

  function handleSubmit(e: any) {
    e.preventDefault();
    setError("");
    const parsed = extractTokenFromInput(input);
    if (!parsed) {
      setError("أدخل رابط مشاركة صالحاً أو رمز JWT مكوّن من ثلاثة أجزاء.");
      return;
    }
    let labelGuess = "رابط مشاركة";
    try { labelGuess = new URL(parsed.url || input.trim()).hostname; } catch { /* use default */ }
    const entry = {
      token: parsed.token,
      url: parsed.url || input.trim(),
      label: labelGuess,
      permission: "view",
      addedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString()
    };
    addHistoryEntry(entry);
    setHistory(readHistory());
    setInput("");
    handleOpen(entry);
  }

  return jsxs("div", {
    className: "max-w-2xl mx-auto px-4 py-6 space-y-6",
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "space-y-1",
        children: [
          jsx("h1", { className: "text-xl font-bold", children: "المشترك معي" }),
          jsx("p", { className: "text-sm text-base-content/60", children: "الوصول إلى المحتوى الذي شاركه معك آخرون برابط مشاركة." })
        ]
      }),

      jsx("div", {
        className: "alert alert-info block text-sm",
        role: "note",
        children: jsxs("p", {
          children: [
            jsx("strong", { children: "الدعوات بالبريد الإلكتروني: " }),
            "قريباً — ستتلقى إشعاراً داخل التطبيق عند دعوتك مباشرة لمشاركة."
          ]
        })
      }),

      jsxs("form", {
        onSubmit: handleSubmit,
        className: "card card-border bg-base-100 p-4 space-y-3",
        children: [
          jsx("p", { className: "text-sm font-medium", children: "أدخل رابط أو رمز مشاركة" }),
          jsxs("div", {
            className: "flex gap-2",
            children: [
              jsx("input", {
                type: "text",
                className: "input input-bordered flex-1 text-sm",
                placeholder: "https://… أو رمز JWT",
                value: input,
                onChange: (e: any) => setInput(e.target.value),
                dir: "ltr",
                "aria-label": "رابط أو رمز المشاركة"
              }),
              jsxs("button", {
                type: "submit",
                className: "btn btn-primary btn-sm",
                disabled: !input.trim(),
                children: [jsx(Link2, { size: 14, "aria-hidden": true }), " فتح"]
              })
            ]
          }),
          error && jsx("p", { className: "text-error text-xs", role: "alert", children: error })
        ]
      }),

      history.length > 0
        ? jsxs("div", {
            className: "space-y-2",
            children: [
              jsx("h2", { className: "text-sm font-semibold text-base-content/60 uppercase tracking-wide", children: "الروابط السابقة" }),
              jsx("div", {
                className: "grid gap-2",
                children: history.map((entry: any) =>
                  jsx(HistoryCard, { entry, onOpen: handleOpen, onRemove: handleRemove }, entry.token || entry.url)
                )
              }),
              jsx("button", {
                type: "button",
                className: "btn btn-xs btn-ghost text-error mt-1",
                onClick: () => { saveHistory([]); setHistory([]); },
                children: "مسح السجل"
              })
            ]
          })
        : jsxs("div", {
            className: "flex flex-col items-center gap-3 py-12 text-base-content/40",
            children: [
              jsx(Inbox, { size: 40, "aria-hidden": true }),
              jsx("p", { className: "text-sm", children: "لا توجد روابط في السجل بعد." })
            ]
          })
    ]
  });
}
