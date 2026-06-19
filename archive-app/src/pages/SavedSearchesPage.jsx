import {
  Bell,
  BellOff,
  Bookmark,
  Clock,
  Filter,
  Loader2,
  Play,
  Search,
  Trash2
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { EmptyState, SkeletonCard } from "../components/ui/primitives.jsx";
import { useAppStore } from "../stores/index.js";

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("ar-SA", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return null;
  }
}

function FilterChips({ filters = {} }) {
  const chips = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);

  if (chips.length === 0) return null;
  return jsxs("div", {
    className: "mt-1.5 flex flex-wrap gap-1",
    children: chips.map((chip) =>
      jsx("span", {
        className: "badge badge-xs rounded-full bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-muted)]",
        children: chip
      }, chip)
    )
  });
}

function SearchCard({ search, onRun, onDelete, onToggleAlert }) {
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    await onDelete(search.id);
  }

  return jsxs("div", {
    className: "card rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 shadow-[var(--va-elev-1)] transition-colors hover:border-emerald-500/25",
    children: [
      jsxs("div", {
        className: "flex items-start gap-3",
        children: [
          jsx("div", {
            className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)]",
            children: jsx(Bookmark, { className: "h-4 w-4 text-[var(--va-status-info)]" })
          }),
          jsxs("div", {
            className: "flex-1 min-w-0",
            children: [
              jsx("p", { className: "truncate text-sm font-medium text-[var(--va-text)]", children: search.name }),
              search.query && jsxs("p", {
                className: "mt-0.5 flex items-center gap-1 text-xs text-[var(--va-text-muted)]",
                children: [jsx(Search, { className: "h-3 w-3 shrink-0" }), jsx("span", { className: "truncate", children: search.query })]
              }),
              jsx(FilterChips, { filters: search.filters }),
              jsxs("div", {
                className: "mt-1.5 flex items-center gap-3 text-xs text-[var(--va-text-muted)]",
                children: [
                  jsxs("span", {
                    className: "flex items-center gap-1",
                    children: [jsx(Clock, { className: "h-3 w-3" }), formatDate(search.createdAt) || "—"]
                  }),
                  search.lastRunAt && jsxs("span", {
                    children: ["آخر تشغيل: ", formatDate(search.lastRunAt)]
                  })
                ]
              })
            ]
          }),
          jsxs("div", {
            className: "flex shrink-0 items-center gap-1",
            children: [
              jsx("button", {
                type: "button",
                onClick: () => onToggleAlert(search.id),
                title: search.alertEnabled ? "إيقاف التنبيه" : "تفعيل التنبيه",
                className: `btn btn-ghost btn-circle btn-sm rounded-lg p-1.5 transition-colors ${
                  search.alertEnabled
                    ? "text-[var(--va-highlight)] hover:brightness-110"
                    : "text-[var(--va-text-muted)] hover:text-[var(--va-text-2)]"
                }`,
                "aria-label": search.alertEnabled ? "إيقاف التنبيه" : "تفعيل التنبيه",
                children: search.alertEnabled
                  ? jsx(Bell, { className: "h-4 w-4" })
                  : jsx(BellOff, { className: "h-4 w-4" })
              }),
              jsx("button", {
                type: "button",
                onClick: () => onRun(search),
                title: "تشغيل البحث",
                "aria-label": "تشغيل البحث",
                className: "btn btn-ghost btn-circle btn-sm rounded-lg p-1.5 text-[var(--va-status-info)] hover:brightness-110 transition-colors",
                children: jsx(Play, { className: "h-4 w-4" })
              }),
              jsx("button", {
                type: "button",
                onClick: handleDelete,
                disabled: deleting,
                title: "حذف",
                "aria-label": "حذف البحث المحفوظ",
                className: "btn btn-ghost btn-circle btn-sm rounded-lg p-1.5 text-[var(--va-text-muted)] hover:text-rose-400 disabled:opacity-40 transition-colors",
                children: deleting
                  ? jsx(Loader2, { className: "h-4 w-4 animate-spin" })
                  : jsx(Trash2, { className: "h-4 w-4" })
              })
            ]
          })
        ]
      })
    ]
  });
}

export default function SavedSearchesPage() {
  const {
    savedSearches,
    savedSearchesLoading,
    savedSearchesError,
    loadSavedSearchesFromStorage,
    deleteSavedSearch,
    toggleSavedSearchAlert,
    markSavedSearchRun,
    navigateToPage
  } = useAppStore();

  const [filter, setFilter] = React.useState("all");

  React.useEffect(() => {
    loadSavedSearchesFromStorage();
  }, [loadSavedSearchesFromStorage]);

  function handleRun(search) {
    markSavedSearchRun(search.id);
    if (typeof navigateToPage === "function") {
      navigateToPage("search", { q: search.query, ...search.filters });
    }
  }

  const visible = React.useMemo(() => {
    if (filter === "alerts") return savedSearches.filter((s) => s.alertEnabled);
    return savedSearches;
  }, [savedSearches, filter]);

  return jsxs("div", {
    className: "mx-auto max-w-2xl px-4 py-8",
    children: [
      jsxs("div", {
        className: "mb-6",
        children: [
          jsxs("h1", {
            className: "flex items-center gap-2 text-lg font-bold text-[var(--va-text)]",
            children: [jsx(Bookmark, { className: "h-5 w-5 text-[var(--va-status-info)]" }), "عمليات البحث المحفوظة"]
          }),
          jsx("p", {
            className: "mt-1 text-sm text-[var(--va-text-muted)]",
            children: "احفظ بحثاً وشغّله بنقرة، أو فعّل تنبيهاً عند ظهور عناصر جديدة مطابقة"
          })
        ]
      }),

      savedSearchesError && jsx("div", {
        role: "alert",
        className: "alert alert-error block mb-4 rounded-[var(--va-radius-md)] border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-400",
        children: savedSearchesError
      }),

      jsxs("div", {
        className: "mb-4 flex gap-2",
        children: [
          jsx("button", {
            type: "button",
            onClick: () => setFilter("all"),
            "aria-pressed": filter === "all",
            className: `btn btn-sm btn-ghost rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "all" ? "bg-emerald-500/15 text-emerald-300" : "text-[var(--va-text-muted)] hover:text-[var(--va-text-2)]"
            }`,
            children: `الكل (${savedSearches.length})`
          }),
          jsx("button", {
            type: "button",
            onClick: () => setFilter("alerts"),
            "aria-pressed": filter === "alerts",
            className: `btn btn-sm btn-ghost flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "alerts" ? "bg-[var(--va-highlight-soft)] text-[var(--va-highlight)]" : "text-[var(--va-text-muted)] hover:text-[var(--va-text-2)]"
            }`,
            children: [
              jsx(Bell, { className: "h-3 w-3" }),
              `التنبيهات (${savedSearches.filter((s) => s.alertEnabled).length})`
            ]
          })
        ]
      }),

      savedSearchesLoading && jsx("div", {
        className: "space-y-3",
        children: [0, 1, 2].map((i) => jsx(SkeletonCard, {}, i))
      }),

      !savedSearchesLoading && visible.length === 0 && jsx(EmptyState, {
        icon: jsx(Bookmark, { className: "h-7 w-7" }),
        title: filter === "alerts" ? "لا توجد بحوث مع تنبيهات مفعّلة" : "لم تحفظ أي بحث بعد",
        description: "استخدم زر الحفظ في صفحة البحث لإضافة بحث هنا."
      }),

      !savedSearchesLoading && visible.length > 0 && jsx("div", {
        className: "space-y-3",
        children: visible.map((search) =>
          jsx(SearchCard, {
            search,
            onRun: handleRun,
            onDelete: deleteSavedSearch,
            onToggleAlert: toggleSavedSearchAlert
          }, search.id)
        )
      }),

      savedSearches.length > 0 && jsxs("div", {
        className: "alert mt-4 flex items-start gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3 text-xs text-[var(--va-text-muted)]",
        children: [
          jsx(Filter, { className: "mt-0.5 h-3.5 w-3.5 shrink-0" }),
          "التنبيهات تُشغَّل داخل التطبيق فقط في الوضع المحلي. لتفعيل التنبيهات التلقائية عبر البريد أو خارج التطبيق، يلزم وجود السيرفر."
        ]
      })
    ]
  });
}
