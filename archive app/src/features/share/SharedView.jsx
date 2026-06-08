import * as React from "react";
import { createRoot } from "react-dom/client";
import { jsx, jsxs } from "react/jsx-runtime";
import { Archive, ExternalLink, Loader2, ShieldAlert, Tag } from "lucide-react";

import { fetchSharedView } from "./shareClient.js";

// G6 — public read-only viewer. Rendered standalone by the boot path when the
// SPA is opened with ?share=<token>, so it never touches the store or auth.
// Fetches the scoped, privacy-safe snapshot from /api/share/:token and lists
// the shared items.

function SharedItemCard({ item, typeName }) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return jsxs("article", {
    className: "rounded-2xl border border-white/10 bg-gray-900/45 p-4 text-right",
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        jsx("h3", { className: "min-w-0 truncate text-base font-bold text-white", children: item.title || "بدون عنوان" }),
        typeName && jsx("span", { className: "shrink-0 rounded-full border va-accent-border va-accent-bg-soft px-2 py-0.5 text-xs va-accent-text-on-soft", children: typeName })
      ] }),
      item.notes && jsx("p", { className: "mt-2 line-clamp-3 text-sm leading-relaxed text-gray-400", children: item.notes }),
      tags.length > 0 && jsx("div", { className: "mt-3 flex flex-wrap gap-1.5", children: tags.slice(0, 12).map((t, i) => jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-gray-300", children: [jsx(Tag, { className: "h-3 w-3 opacity-60" }), t] }, `${t}-${i}`)) })
    ]
  });
}

function formatShareDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}

export function SharedView({ token, baseUrl = "", fetchImpl }) {
  const [state, setState] = React.useState({ status: "loading", data: null, error: "" });

  React.useEffect(() => {
    let alive = true;
    fetchSharedView({ token, baseUrl, fetchImpl })
      .then((data) => { if (alive) setState({ status: "ready", data, error: "" }); })
      .catch((err) => { if (alive) setState({ status: "error", data: null, error: err?.message || "تعذّر فتح الرابط." }); });
    return () => { alive = false; };
  }, [token, baseUrl, fetchImpl]);

  const typeName = (id, types) => (Array.isArray(types) ? types.find((t) => t.id === id)?.name : "") || "";
  const shareTitle = state.data?.share?.title || state.data?.scope?.label || "أرشيف مُشارَك";
  const expiresText = formatShareDate(state.data?.share?.expiresAt);

  return jsx("main", {
    dir: "rtl",
    className: "min-h-screen bg-[#07111f] px-4 py-8 text-white sm:px-6",
    children: jsxs("div", {
      className: "mx-auto w-full max-w-5xl",
      children: [
        jsxs("header", { className: "mb-6 flex items-center gap-3 border-b border-white/10 pb-5", children: [
          jsx("span", { className: "flex h-11 w-11 items-center justify-center rounded-xl va-accent-bg-soft va-accent-text", children: jsx(Archive, { className: "h-5 w-5" }) }),
          jsxs("div", { className: "min-w-0", children: [
            jsx("h1", { className: "truncate text-xl font-bold", children: shareTitle }),
            jsx("p", { className: "mt-1 text-sm text-gray-400", children: expiresText ? `عرض للقراءة فقط — صالح حتى ${expiresText}.` : "عرض للقراءة فقط — مجموعة مختارة من الأرشيف." })
          ] })
        ] }),

        state.status === "loading" && jsxs("div", { className: "flex items-center justify-center gap-3 py-24 text-gray-400", children: [
          jsx(Loader2, { className: "h-5 w-5 animate-spin" }), "جارٍ تحميل المشاركة…"
        ] }),

        state.status === "error" && jsxs("div", { className: "mx-auto max-w-md rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-center", children: [
          jsx(ShieldAlert, { className: "mx-auto h-10 w-10 text-red-300" }),
          jsx("h2", { className: "mt-3 text-lg font-bold", children: "تعذّر فتح الرابط" }),
          jsx("p", { className: "mt-2 text-sm text-red-100/90", children: state.error }),
          jsxs("a", { href: "/", className: "mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-gray-200 hover:bg-white/5", children: [jsx(ExternalLink, { className: "h-4 w-4" }), "فتح التطبيق"] })
        ] }),

        state.status === "ready" && jsxs(React.Fragment, { children: [
          jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400", children: [
            jsxs("span", { className: "rounded-full bg-white/5 px-3 py-1", children: [`${(state.data?.counts?.items ?? state.data?.videoItems?.length ?? 0)} عنصر`] }),
            state.data?.share?.scopeLabel && jsx("span", { className: "rounded-full bg-white/5 px-3 py-1", children: state.data.share.scopeLabel }),
            expiresText && jsx("span", { className: "rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-100", children: `ينتهي: ${expiresText}` })
          ] }),
          (state.data?.videoItems?.length
            ? jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3", children: state.data.videoItems.map((item) => jsx(SharedItemCard, { item, typeName: typeName(item.type, state.data.contentTypes) }, item.id)) })
            : jsx("p", { className: "py-16 text-center text-gray-500", children: "لا توجد عناصر في هذه المشاركة." }))
        ] })
      ]
    })
  });
}

/** Mount the standalone shared viewer (called by the boot path). */
export function mountSharedView(rootElement, token, options = {}) {
  if (!rootElement) throw new Error("Shared view root element was not found.");
  return createRoot(rootElement).render(
    jsx(React.StrictMode, { children: jsx(SharedView, { token, ...options }) })
  );
}

export default SharedView;
