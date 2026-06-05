import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Database, HardDrive } from "lucide-react";

import {
  DEFAULT_LOCAL_ENGINE,
  getBackendChoice,
  getBackendUrl,
  getLocalEngine,
  setBackendChoice,
  shouldForceLocalBackend
} from "../../bootstrap/backendChoice.js";
import { useAppStore } from "../../stores/index.js";
import { SettingsCard } from "./SettingsControls.jsx";

const OPTIONS = [
  { id: "indexeddb", label: "IndexedDB", detail: "الافتراضي المستقر داخل المتصفح." },
  { id: "sqlite", label: "SQLite (WASM)", detail: "ملف SQLite محلي عبر OPFS، مع تراجع آمن عند عدم توفره." }
];

export function LocalStorageEngineSettings() {
  const { showToast } = useAppStore();
  const [value, setValue] = React.useState(() => getLocalEngine());
  const forced = shouldForceLocalBackend();
  const save = (next) => {
    setValue(next);
    const ok = setBackendChoice(getBackendChoice(), getBackendUrl(), { localEngine: next });
    if (ok) {
      showToast?.("حُفِظ محرّك التخزين المحلي. أعد تحميل التطبيق لتطبيق الاختيار.", "success");
    } else {
      showToast?.("تعذّر حفظ اختيار التخزين المحلي.", "error");
    }
  };

  return jsx(SettingsCard, {
    title: "محرّك التخزين المحلي",
    description: "اختر محرك التخزين عندما يعمل التطبيق بدون خادم SQL. IndexedDB هو الخيار المستقر، وSQLite يستخدم WASM وOPFS مع تراجع آمن.",
    icon: jsx(HardDrive, { className: "h-5 w-5 text-emerald-400" }),
    aside: jsx("span", { className: "rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300", children: value || DEFAULT_LOCAL_ENGINE }),
    children: jsxs("div", { className: "space-y-3", dir: "rtl", children: [
      forced && jsx("p", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100", children: "AI Studio يفرض IndexedDB المحلي لهذا التشغيل." }),
      jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: OPTIONS.map((option) => {
        const active = value === option.id;
        return jsxs("button", {
          type: "button",
          onClick: () => !forced && save(option.id),
          disabled: forced,
          "aria-pressed": active,
          className: `min-h-[6rem] rounded-xl border p-3 text-start transition-colors disabled:opacity-60 ${
            active ? "border-emerald-500/35 bg-emerald-500/12 text-white" : "border-white/10 va-surface-subtle text-gray-300 hover:bg-white/[0.05]"
          }`,
          children: [
            jsxs("p", { className: "flex items-center gap-2 text-sm font-semibold", children: [jsx(Database, { className: "h-4 w-4 text-emerald-300" }), option.label] }),
            jsx("p", { className: "mt-2 text-xs leading-6 text-gray-500", children: option.detail })
          ]
        }, option.id);
      }) }),
      value === "sqlite" && jsx("p", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100", children: "تنبيه: يتطلب SQLite المحلي دعماً لـ OPFS في المتصفح. إذا لم يتوفر، سيعمل التطبيق تلقائياً عبر IndexedDB." })
    ] })
  });
}

export default LocalStorageEngineSettings;
