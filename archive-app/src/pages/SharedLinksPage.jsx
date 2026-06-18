import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  Copy,
  Check,
  Link2,
  Loader2,
  LockKeyhole,
  ShieldOff,
  Trash2
} from "lucide-react";

import { useAppStore } from "../stores/index.js";
import {
  getAllMintedLinks,
  markLinkRevoked,
  removeMintedLink,
  clearAllMintedLinks
} from "../features/share/mintedLinksStore.js";
import { revokeShareLink } from "../features/share/shareClient.js";

// §1697 — manage minted share links stored locally in the browser.
// Shows all links the user has minted this session/device, with their
// permission level, expiry, and revocation control.

const PERMISSION_LABELS = Object.freeze({
  view: "عرض فقط",
  comment: "تعليق",
  download: "تحميل",
  edit: "تعديل"
});

const SCOPE_LABELS = Object.freeze({
  items: "عنصر",
  collection: "مجموعة"
});

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  try {
    return new Date(expiresAt) < new Date();
  } catch {
    return false;
  }
}

function LinkRow({ entry, onRevoke, onRemove, baseUrl, getToken }) {
  const [copied, setCopied] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);
  const [revokeError, setRevokeError] = React.useState("");

  const expired = isExpired(entry.expiresAt);
  const unavailable = entry.revoked || expired;

  async function handleCopy() {
    if (!entry.url) return;
    try {
      await navigator?.clipboard?.writeText(entry.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function handleRevoke() {
    if (!entry.jti || revoking) return;
    setRevoking(true);
    setRevokeError("");
    try {
      await revokeShareLink({ jti: entry.jti, baseUrl, getToken });
      markLinkRevoked(entry.jti);
      onRevoke(entry.jti);
    } catch (err) {
      setRevokeError(err?.message || "تعذّر إلغاء الرابط.");
    } finally {
      setRevoking(false);
    }
  }

  return jsxs("li", {
    className: `rounded-xl border p-4 text-right transition-opacity ${unavailable ? "border-white/5 opacity-50" : "border-white/10 bg-white/[0.02]"}`,
    children: [
      jsxs("div", {
        className: "flex flex-wrap items-start justify-between gap-2",
        children: [
          jsxs("div", {
            className: "min-w-0 flex-1",
            children: [
              jsxs("div", {
                className: "flex flex-wrap items-center gap-2",
                children: [
                  jsx("span", {
                    className: "badge badge-sm rounded-full border-white/10 bg-white/5 text-gray-300",
                    children: SCOPE_LABELS[entry.scopeType] || entry.scopeType || "رابط"
                  }),
                  jsx("span", {
                    className: "badge badge-sm rounded-full va-accent-border va-accent-bg-soft va-accent-text-on-soft",
                    children: PERMISSION_LABELS[entry.permission] || entry.permission
                  }),
                  entry.passwordProtected && jsxs("span", {
                    className: "badge badge-sm rounded-full border-amber-500/25 bg-amber-500/10 text-amber-200 gap-1",
                    children: [jsx(LockKeyhole, { className: "h-2.5 w-2.5" }), "بكلمة مرور"]
                  }),
                  entry.revoked && jsx("span", { className: "badge badge-sm badge-error rounded-full", children: "ملغى" }),
                  expired && !entry.revoked && jsx("span", { className: "badge badge-sm badge-warning rounded-full", children: "منتهي" })
                ]
              }),
              entry.label && jsx("p", {
                className: "mt-1 text-sm font-semibold text-white",
                children: entry.label
              }),
              jsx("p", {
                dir: "ltr",
                className: "mt-1 truncate text-left font-mono text-[11px] text-gray-500",
                children: entry.url
              }),
              jsxs("p", {
                className: "mt-1.5 text-[11px] text-gray-600",
                children: [
                  "صُكّ: ",
                  formatDate(entry.mintedAt),
                  entry.expiresAt
                    ? jsxs(React.Fragment, { children: [" · ينتهي: ", formatDate(entry.expiresAt)] })
                    : " · بدون انتهاء"
                ]
              })
            ]
          }),
          jsxs("div", {
            className: "flex shrink-0 items-center gap-1",
            children: [
              jsx("button", {
                type: "button",
                onClick: handleCopy,
                disabled: unavailable,
                className: "btn btn-ghost btn-xs rounded-lg gap-1 text-gray-400",
                "aria-label": "نسخ الرابط",
                children: copied
                  ? jsx(Check, { className: "h-3.5 w-3.5 text-emerald-400" })
                  : jsx(Copy, { className: "h-3.5 w-3.5" })
              }),
              entry.jti && !entry.revoked && !expired && jsx("button", {
                type: "button",
                onClick: handleRevoke,
                disabled: revoking,
                className: "btn btn-ghost btn-xs rounded-lg gap-1 text-red-400 hover:bg-red-500/10",
                "aria-label": "إلغاء الرابط",
                children: revoking
                  ? jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" })
                  : jsx(ShieldOff, { className: "h-3.5 w-3.5" })
              }),
              jsx("button", {
                type: "button",
                onClick: () => onRemove(entry.jti || entry.url),
                className: "btn btn-ghost btn-xs rounded-lg text-gray-600 hover:text-gray-300",
                "aria-label": "إزالة من القائمة",
                children: jsx(Trash2, { className: "h-3.5 w-3.5" })
              })
            ]
          })
        ]
      }),
      revokeError && jsx("p", {
        role: "alert",
        className: "mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300",
        children: revokeError
      })
    ]
  }, entry.jti || entry.url);
}

export default function SharedLinksPage() {
  const backend = useAppStore((s) => s.settings?.backendChoice);
  const getToken = useAppStore((s) => s.auth?.getToken);
  const baseUrl = useAppStore((s) => s.settings?.serverUrl || "");

  const [links, setLinks] = React.useState(() => getAllMintedLinks());
  const [cleared, setCleared] = React.useState(false);

  function refresh() {
    setLinks(getAllMintedLinks());
  }

  function handleRevoke(jti) {
    setLinks((prev) => prev.map((e) => (e.jti === jti ? { ...e, revoked: true } : e)));
  }

  function handleRemove(key) {
    removeMintedLink(key);
    refresh();
  }

  function handleClearAll() {
    clearAllMintedLinks();
    setLinks([]);
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  }

  const isCloud = backend && backend !== "local";
  const active = links.filter((l) => !l.revoked && !isExpired(l.expiresAt));
  const inactive = links.filter((l) => l.revoked || isExpired(l.expiresAt));

  return jsxs("div", {
    className: "mx-auto max-w-2xl space-y-6 px-4 py-6 text-right",
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "flex items-center justify-between gap-3",
        children: [
          jsxs("div", {
            children: [
              jsxs("h1", {
                className: "flex items-center gap-2 text-xl font-bold text-white",
                children: [jsx(Link2, { className: "h-5 w-5 va-accent-text" }), "روابط المشاركة"]
              }),
              jsx("p", {
                className: "mt-1 text-sm text-gray-500",
                children: "الروابط التي أنشأتها على هذا الجهاز. الإلغاء يتطلب اتصالاً بالخادم."
              })
            ]
          }),
          links.length > 0 && jsx("button", {
            type: "button",
            onClick: handleClearAll,
            className: "btn btn-ghost btn-sm text-gray-500",
            children: cleared ? "تم المسح" : "مسح الكل"
          })
        ]
      }),

      !isCloud && jsx("div", {
        role: "status",
        className: "rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200",
        children: "الإلغاء يتطلب الاتصال بخادم سحابي. لا يزال بإمكانك مراجعة الروابط المحلية."
      }),

      links.length === 0 && jsx("div", {
        className: "rounded-2xl border border-white/10 py-16 text-center text-gray-500",
        children: jsxs("div", {
          className: "flex flex-col items-center gap-3",
          children: [
            jsx(Link2, { className: "h-10 w-10 opacity-20" }),
            jsx("p", { className: "text-sm", children: "لم تُنشئ أي روابط مشاركة بعد." }),
            jsx("p", { className: "text-xs text-gray-600", children: "الروابط التي تنشئها من حوار المشاركة ستظهر هنا." })
          ]
        })
      }),

      active.length > 0 && jsxs("section", {
        className: "space-y-2",
        children: [
          jsxs("h2", {
            className: "flex items-center gap-2 text-sm font-semibold text-gray-400",
            children: [
              "الروابط النشطة",
              jsx("span", { className: "badge badge-sm rounded-full border-white/10 bg-white/5", children: active.length })
            ]
          }),
          jsx("ul", {
            className: "space-y-2",
            children: active.map((entry) =>
              jsx(LinkRow, {
                entry,
                onRevoke: handleRevoke,
                onRemove: handleRemove,
                baseUrl,
                getToken
              }, entry.jti || entry.url)
            )
          })
        ]
      }),

      inactive.length > 0 && jsxs("section", {
        className: "space-y-2",
        children: [
          jsxs("h2", {
            className: "flex items-center gap-2 text-sm font-semibold text-gray-400",
            children: [
              "الروابط الملغاة / المنتهية",
              jsx("span", { className: "badge badge-sm rounded-full border-white/10 bg-white/5", children: inactive.length })
            ]
          }),
          jsx("ul", {
            className: "space-y-2",
            children: inactive.map((entry) =>
              jsx(LinkRow, {
                entry,
                onRevoke: handleRevoke,
                onRemove: handleRemove,
                baseUrl,
                getToken
              }, entry.jti || entry.url)
            )
          })
        ]
      })
    ]
  });
}
