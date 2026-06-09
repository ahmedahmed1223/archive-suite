import { Filter, X } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useAppStore } from "../../stores/index.js";

const SIZE_OPTIONS = [
  { label: "الكل", min: 0, max: Infinity },
  { label: "< 10 MB", min: 0, max: 10 * 1024 * 1024 },
  { label: "10–100 MB", min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
  { label: "> 100 MB", min: 100 * 1024 * 1024, max: Infinity }
];

function matchesFilters(item, filters) {
  if (item.isDeleted && !filters.includeDeleted) return false;
  if (filters.type && item.type !== filters.type) return false;
  if (filters.subtype && item.subtype !== filters.subtype) return false;

  if (filters.dateFrom || filters.dateTo) {
    const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
    if (filters.dateFrom && created < new Date(filters.dateFrom).getTime()) return false;
    if (filters.dateTo && created > new Date(filters.dateTo + "T23:59:59").getTime()) return false;
  }

  if (filters.tags && filters.tags.length > 0) {
    const itemTags = Array.isArray(item.tags) ? item.tags : [];
    const hasTag = filters.tagMode === "any"
      ? filters.tags.some((t) => itemTags.includes(t))
      : filters.tags.every((t) => itemTags.includes(t));
    if (!hasTag) return false;
  }

  const { min, max } = SIZE_OPTIONS[filters.sizeIndex ?? 0];
  const size = Number(item.fileSize || item.metadata?.fileSize || 0);
  if (size && (size < min || size > max)) return false;

  return true;
}

export function SmartSelectionBuilder({ onApply, onClose }) {
  const { videoItems } = useAppStore();

  const [filters, setFilters] = React.useState({
    type: "",
    subtype: "",
    dateFrom: "",
    dateTo: "",
    tags: [],
    tagInput: "",
    tagMode: "any",
    sizeIndex: 0,
    includeDeleted: false
  });

  const update = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const matchingIds = React.useMemo(
    () => videoItems.filter((item) => matchesFilters(item, filters)).map((item) => item.id),
    [videoItems, filters]
  );

  const typesInData = React.useMemo(() => {
    const set = new Set(videoItems.map((i) => i.type).filter(Boolean));
    return [...set];
  }, [videoItems]);

  const subtypesInData = React.useMemo(() => {
    if (!filters.type) return [];
    const set = new Set(videoItems.filter((i) => i.type === filters.type).map((i) => i.subtype).filter(Boolean));
    return [...set];
  }, [videoItems, filters.type]);

  function handleAddTag() {
    const tag = filters.tagInput.trim();
    if (!tag || filters.tags.includes(tag)) return;
    update({ tags: [...filters.tags, tag], tagInput: "" });
  }

  function handleApply() {
    onApply(matchingIds);
    onClose();
  }

  return jsx("div", {
    className: "fixed inset-0 z-[9970] flex items-center justify-center p-4",
    children: jsxs("div", {
      className: "relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1626] p-6 shadow-2xl",
      children: [
        jsxs("div", {
          className: "mb-5 flex items-center justify-between",
          children: [
            jsxs("h2", {
              className: "flex items-center gap-2 text-base font-bold text-gray-100",
              children: [jsx(Filter, { className: "h-4 w-4 text-blue-400" }), "تحديد شرطي ذكي"]
            }),
            jsx("button", {
              type: "button",
              onClick: onClose,
              className: "rounded-lg p-1.5 text-gray-500 hover:text-white",
              children: jsx(X, { className: "h-4 w-4" })
            })
          ]
        }),

        jsxs("div", {
          className: "space-y-4",
          children: [
            jsxs("div", {
              className: "grid grid-cols-2 gap-3",
              children: [
                jsxs("div", {
                  children: [
                    jsx("label", { className: "mb-1 block text-xs text-gray-500", children: "النوع" }),
                    jsxs("select", {
                      value: filters.type,
                      onChange: (e) => update({ type: e.target.value, subtype: "" }),
                      className: "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500",
                      children: [
                        jsx("option", { value: "", children: "كل الأنواع" }),
                        typesInData.map((t) => jsx("option", { value: t, children: t }, t))
                      ]
                    })
                  ]
                }),
                jsxs("div", {
                  children: [
                    jsx("label", { className: "mb-1 block text-xs text-gray-500", children: "النوع الفرعي" }),
                    jsxs("select", {
                      value: filters.subtype,
                      onChange: (e) => update({ subtype: e.target.value }),
                      disabled: !filters.type,
                      className: "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-100 disabled:opacity-40 focus:outline-none focus:border-blue-500",
                      children: [
                        jsx("option", { value: "", children: "الكل" }),
                        subtypesInData.map((s) => jsx("option", { value: s, children: s }, s))
                      ]
                    })
                  ]
                })
              ]
            }),

            jsxs("div", {
              className: "grid grid-cols-2 gap-3",
              children: [
                jsxs("div", {
                  children: [
                    jsx("label", { className: "mb-1 block text-xs text-gray-500", children: "من تاريخ" }),
                    jsx("input", {
                      type: "date",
                      value: filters.dateFrom,
                      onChange: (e) => update({ dateFrom: e.target.value }),
                      className: "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                    })
                  ]
                }),
                jsxs("div", {
                  children: [
                    jsx("label", { className: "mb-1 block text-xs text-gray-500", children: "إلى تاريخ" }),
                    jsx("input", {
                      type: "date",
                      value: filters.dateTo,
                      onChange: (e) => update({ dateTo: e.target.value }),
                      className: "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                    })
                  ]
                })
              ]
            }),

            jsxs("div", {
              children: [
                jsx("label", { className: "mb-1 block text-xs text-gray-500", children: "الحجم" }),
                jsxs("div", {
                  className: "flex flex-wrap gap-2",
                  children: SIZE_OPTIONS.map((opt, i) =>
                    jsx("button", {
                      type: "button",
                      onClick: () => update({ sizeIndex: i }),
                      className: `rounded-lg border px-3 py-1 text-xs transition-colors ${
                        filters.sizeIndex === i
                          ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
                          : "border-white/10 text-gray-500 hover:text-gray-300"
                      }`,
                      children: opt.label
                    }, i)
                  )
                })
              ]
            }),

            jsxs("div", {
              children: [
                jsxs("div", {
                  className: "mb-1 flex items-center justify-between",
                  children: [
                    jsx("label", { className: "text-xs text-gray-500", children: "وسوم" }),
                    jsxs("div", {
                      className: "flex gap-1",
                      children: [
                        jsx("button", {
                          type: "button",
                          onClick: () => update({ tagMode: "any" }),
                          className: `rounded px-2 py-0.5 text-xs ${filters.tagMode === "any" ? "bg-white/10 text-white" : "text-gray-600"}`,
                          children: "أي"
                        }),
                        jsx("button", {
                          type: "button",
                          onClick: () => update({ tagMode: "all" }),
                          className: `rounded px-2 py-0.5 text-xs ${filters.tagMode === "all" ? "bg-white/10 text-white" : "text-gray-600"}`,
                          children: "كل"
                        })
                      ]
                    })
                  ]
                }),
                jsxs("div", {
                  className: "flex gap-2",
                  children: [
                    jsx("input", {
                      type: "text",
                      value: filters.tagInput,
                      onChange: (e) => update({ tagInput: e.target.value }),
                      onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } },
                      placeholder: "أضف وسماً…",
                      className: "flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                    }),
                    jsx("button", {
                      type: "button",
                      onClick: handleAddTag,
                      className: "rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white",
                      children: "إضافة"
                    })
                  ]
                }),
                filters.tags.length > 0 && jsx("div", {
                  className: "mt-2 flex flex-wrap gap-1",
                  children: filters.tags.map((tag) =>
                    jsxs("span", {
                      className: "flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-gray-300",
                      children: [
                        tag,
                        jsx("button", {
                          type: "button",
                          onClick: () => update({ tags: filters.tags.filter((t) => t !== tag) }),
                          className: "text-gray-600 hover:text-red-400",
                          children: jsx(X, { className: "h-3 w-3" })
                        })
                      ]
                    }, tag)
                  )
                })
              ]
            })
          ]
        }),

        jsxs("div", {
          className: "mt-6 flex items-center justify-between",
          children: [
            jsx("p", {
              className: `text-sm ${matchingIds.length > 0 ? "text-blue-300" : "text-gray-500"}`,
              children: matchingIds.length === 0
                ? "لا يوجد عناصر مطابقة"
                : `سيحدد ${matchingIds.length} عنصر`
            }),
            jsxs("div", {
              className: "flex gap-2",
              children: [
                jsx("button", {
                  type: "button",
                  onClick: onClose,
                  className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-400 hover:bg-white/5",
                  children: "إلغاء"
                }),
                jsx("button", {
                  type: "button",
                  onClick: handleApply,
                  disabled: matchingIds.length === 0,
                  className: "rounded-xl bg-blue-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-40 transition-colors",
                  children: "تطبيق التحديد"
                })
              ]
            })
          ]
        })
      ]
    })
  });
}
