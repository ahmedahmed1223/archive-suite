import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Search,
  Trash2,
  X
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useAppStore } from "../stores/index.js";

function normalizeTitle(title = "") {
  return String(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(a = "", b = "") {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const setA = new Set(na.split(" "));
  const setB = new Set(nb.split(" "));
  let common = 0;
  setA.forEach((w) => { if (setB.has(w)) common++; });
  return (2 * common) / (setA.size + setB.size);
}

function detectDuplicates(items) {
  const active = items.filter((item) => !item.isDeleted);
  const pairs = [];
  const seen = new Set();

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const pairKey = [a.id, b.id].sort().join("|");
      if (seen.has(pairKey)) continue;

      let score = 0;
      const reasons = [];

      const hashA = a.metadata?.fileHash || a.fileHash;
      const hashB = b.metadata?.fileHash || b.fileHash;
      if (hashA && hashB && hashA === hashB) {
        score = 1;
        reasons.push("نفس الـ hash");
      } else {
        const sim = titleSimilarity(a.title, b.title);
        if (sim >= 0.85) {
          score = Math.max(score, sim);
          reasons.push("عنوان متطابق تقريباً");
        } else if (sim >= 0.6) {
          score = Math.max(score, sim * 0.9);
          reasons.push("عنوان مشابه");
        }

        if (a.type && b.type && a.type === b.type) {
          if (a.url && b.url && a.url === b.url) {
            score = Math.max(score, 0.95);
            reasons.push("نفس الرابط");
          }
          const sizeA = Number(a.fileSize || a.metadata?.fileSize);
          const sizeB = Number(b.fileSize || b.metadata?.fileSize);
          if (sizeA && sizeB && sizeA === sizeB) {
            score = Math.max(score, 0.8);
            reasons.push("نفس الحجم");
          }
        }
      }

      if (score >= 0.6) {
        seen.add(pairKey);
        pairs.push({ a, b, score, reasons });
      }
    }
  }

  return pairs.sort((x, y) => y.score - x.score);
}

function ConfidencePill({ score }) {
  const pct = Math.round(score * 100);
  const cls =
    pct >= 95 ? "bg-red-500/20 text-red-300" :
    pct >= 80 ? "bg-amber-500/20 text-amber-300" :
                "bg-yellow-500/20 text-yellow-300";
  return jsx("span", {
    className: `rounded-full px-2 py-0.5 text-xs font-medium ${cls}`,
    children: `${pct}% تطابق`
  });
}

function ItemMini({ item }) {
  return jsxs("div", {
    className: "rounded-xl border border-white/8 bg-white/[0.03] p-3",
    children: [
      jsx("p", { className: "truncate text-sm font-medium text-gray-100", children: item.title || item.id }),
      jsxs("p", {
        className: "mt-0.5 text-xs text-gray-500",
        children: [
          item.type || "—",
          item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString("ar-SA")}` : ""
        ]
      })
    ]
  });
}

function PairCard({ pair, onDismiss, onDelete }) {
  const [expanded, setExpanded] = React.useState(false);

  return jsxs("div", {
    className: "rounded-2xl border border-white/8 bg-white/[0.03] p-4",
    children: [
      jsxs("div", {
        className: "flex items-center gap-3",
        children: [
          jsx(Copy, { className: "h-4 w-4 shrink-0 text-amber-400" }),
          jsxs("div", {
            className: "flex-1 min-w-0",
            children: [
              jsx(ConfidencePill, { score: pair.score }),
              jsx("p", {
                className: "mt-1 text-xs text-gray-500",
                children: pair.reasons.join(" · ")
              })
            ]
          }),
          jsx("button", {
            type: "button",
            onClick: () => setExpanded((e) => !e),
            className: "text-gray-500 hover:text-gray-300",
            "aria-label": expanded ? "طي" : "توسيع",
            children: expanded
              ? jsx(ChevronDown, { className: "h-4 w-4" })
              : jsx(ChevronRight, { className: "h-4 w-4" })
          })
        ]
      }),

      expanded && jsxs("div", {
        className: "mt-3 space-y-2",
        children: [
          jsx(ItemMini, { item: pair.a }),
          jsx(ItemMini, { item: pair.b }),
          jsxs("div", {
            className: "flex gap-2 pt-1",
            children: [
              jsx("button", {
                type: "button",
                onClick: () => onDelete(pair.a.id),
                className: "flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors",
                children: [jsx(Trash2, { className: "h-3.5 w-3.5" }), "حذف الأقدم"]
              }),
              jsx("button", {
                type: "button",
                onClick: () => onDismiss(pair.a.id, pair.b.id),
                className: "flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/5 transition-colors",
                children: [jsx(X, { className: "h-3.5 w-3.5" }), "ليسا مكررَين"]
              })
            ]
          })
        ]
      })
    ]
  });
}

const DISMISSED_KEY = "videoArchive:dismissedDuplicates";

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]")); }
  catch { return new Set(); }
}

function saveDismissed(set) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set])); } catch {}
}

export default function DuplicatesPage() {
  const { videoItems, deleteItem, showToast } = useAppStore();
  const [scanning, setScanning] = React.useState(false);
  const [pairs, setPairs] = React.useState(null);
  const [dismissed, setDismissed] = React.useState(loadDismissed);
  const [query, setQuery] = React.useState("");

  function runScan() {
    setScanning(true);
    setTimeout(() => {
      setPairs(detectDuplicates(videoItems));
      setScanning(false);
    }, 50);
  }

  function handleDismiss(idA, idB) {
    const key = [idA, idB].sort().join("|");
    const next = new Set([...dismissed, key]);
    setDismissed(next);
    saveDismissed(next);
  }

  function handleDelete(itemId) {
    deleteItem?.(itemId);
    showToast?.("تم نقل العنصر إلى سلة المحذوفات", "success");
    setPairs((prev) => prev?.filter((p) => p.a.id !== itemId && p.b.id !== itemId));
  }

  const visiblePairs = React.useMemo(() => {
    if (!pairs) return null;
    return pairs.filter((p) => {
      const key = [p.a.id, p.b.id].sort().join("|");
      if (dismissed.has(key)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          String(p.a.title || "").toLowerCase().includes(q) ||
          String(p.b.title || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [pairs, dismissed, query]);

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
                children: [jsx(Copy, { className: "h-5 w-5 text-amber-400" }), "كشف المكررات"]
              }),
              jsx("p", {
                className: "mt-1 text-sm text-gray-500",
                children: "يفحص العناصر النشطة بحثاً عن عناوين متكررة أو ملفات مكررة"
              })
            ]
          }),
          jsx("button", {
            type: "button",
            onClick: runScan,
            disabled: scanning,
            className: "inline-flex items-center gap-1.5 rounded-xl bg-amber-600/20 px-3 py-1.5 text-sm font-medium text-amber-300 hover:bg-amber-600/30 disabled:opacity-50 transition-colors",
            children: scanning
              ? [jsx(Loader2, { className: "h-4 w-4 animate-spin" }), "جاري الفحص…"]
              : "ابدأ الفحص"
          })
        ]
      }),

      pairs === null && jsx("div", {
        className: "py-16 text-center",
        children: jsxs("div", {
          className: "mx-auto max-w-xs",
          children: [
            jsx(Copy, { className: "mx-auto mb-3 h-10 w-10 text-gray-700" }),
            jsx("p", { className: "text-sm text-gray-500", children: "اضغط \"ابدأ الفحص\" للبحث عن العناصر المكررة" })
          ]
        })
      }),

      pairs !== null && visiblePairs !== null && jsxs(React.Fragment, {
        children: [
          jsxs("div", {
            className: `mb-4 flex items-center gap-3 rounded-xl border p-3 ${
              visiblePairs.length === 0
                ? "border-green-500/20 bg-green-500/10"
                : "border-amber-500/20 bg-amber-500/10"
            }`,
            children: [
              visiblePairs.length === 0
                ? jsx(CheckCircle2, { className: "h-5 w-5 text-green-400" })
                : jsx(AlertTriangle, { className: "h-5 w-5 text-amber-400" }),
              jsx("p", {
                className: `text-sm ${visiblePairs.length === 0 ? "text-green-300" : "text-amber-300"}`,
                children: visiblePairs.length === 0
                  ? "لم يُعثر على مكررات — الأرشيف نظيف"
                  : `عُثر على ${visiblePairs.length} زوج محتمل من المكررات`
              })
            ]
          }),

          visiblePairs.length > 0 && jsxs("div", {
            className: "mb-4 relative",
            children: [
              jsx(Search, { className: "absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" }),
              jsx("input", {
                type: "search",
                value: query,
                onChange: (e) => setQuery(e.target.value),
                placeholder: "فلترة حسب العنوان…",
                className: "w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pr-9 pl-3 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
              })
            ]
          }),

          jsx("div", {
            className: "space-y-3",
            children: visiblePairs.map((pair) => {
              const key = [pair.a.id, pair.b.id].sort().join("|");
              return jsx(PairCard, {
                pair,
                onDismiss: handleDismiss,
                onDelete: handleDelete
              }, key);
            })
          })
        ]
      })
    ]
  });
}
