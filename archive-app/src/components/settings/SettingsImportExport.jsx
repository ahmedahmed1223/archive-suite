import { jsx, jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { Download, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { buildExportPayload, diffSettings } from "../../features/settings/settingsRegistry.js";
import { SettingDiffPreview } from "./SettingDiffPreview.jsx";
import { mergeAppSettings } from "../../utils/settings.js";
import { useAppStore } from "../../stores/index.js";

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsImportExport() {
  const settings       = useAppStore((s) => s.settings || {});
  const updateSettings = useAppStore((s) => s.updateSettings);

  const fileInputRef = useRef(null);
  const [phase, setPhase]     = useState("idle"); // idle | diff | done | error
  const [diffs, setDiffs]     = useState([]);
  const [pending, setPending] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  function handleExport() {
    const payload = buildExportPayload(settings);
    const now = new Date().toISOString().slice(0, 10);
    downloadJson(
      { _exported: now, _version: 1, settings: payload },
      `archive-settings-${now}.json`,
    );
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result);
        const incoming = raw.settings ?? raw;
        if (typeof incoming !== "object" || Array.isArray(incoming)) {
          throw new Error("الملف لا يحتوي على كائن إعدادات صالح.");
        }
        const computed = diffSettings(settings, incoming);
        setPending(incoming);
        setDiffs(computed);
        setPhase("diff");
      } catch (err) {
        setErrorMsg(err.message || "تعذّر قراءة الملف.");
        setPhase("error");
      }
    };
    reader.readAsText(file);
  }

  function handleConfirm() {
    if (!pending || !updateSettings) return;
    const merged = mergeAppSettings(settings, pending);
    updateSettings(merged);
    setPhase("done");
    setTimeout(() => setPhase("idle"), 3000);
  }

  function handleCancel() {
    setPending(null);
    setDiffs([]);
    setPhase("idle");
  }

  return jsxs("div", {
    className: "flex flex-col gap-4",
    children: [
      jsxs("div", {
        className: "flex flex-wrap gap-3",
        children: [
          jsxs("button", {
            type: "button",
            onClick: handleExport,
            className: "flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-gray-200 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-100",
            children: [
              jsx(Download, { className: "h-4 w-4 shrink-0" }),
              "تصدير الإعدادات (JSON)",
            ],
          }),
          jsxs("button", {
            type: "button",
            onClick: () => fileInputRef.current?.click(),
            className: "flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-gray-200 transition-colors hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-blue-100",
            children: [
              jsx(Upload, { className: "h-4 w-4 shrink-0" }),
              "استيراد إعدادات",
            ],
          }),
          jsx("input", {
            ref: fileInputRef,
            type: "file",
            accept: ".json,application/json",
            className: "hidden",
            onChange: handleFileChange,
          }),
        ],
      }),

      jsx("p", {
        className: "text-xs text-gray-600",
        children: "التصدير لا يشمل كلمات المرور أو المفاتيح الخاصة أو الحقول الحساسة.",
      }),

      phase === "diff" && jsx(SettingDiffPreview, {
        diffs,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
      }),

      phase === "done" && jsxs("div", {
        className: "flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300",
        children: [
          jsx(CheckCircle2, { className: "h-4 w-4 shrink-0" }),
          "تم تطبيق الإعدادات بنجاح.",
        ],
      }),

      phase === "error" && jsxs("div", {
        className: "flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300",
        children: [
          jsx(AlertCircle, { className: "mt-0.5 h-4 w-4 shrink-0" }),
          jsxs("span", {
            children: [
              jsx("span", { className: "font-semibold", children: "خطأ في الاستيراد: " }),
              errorMsg,
            ],
          }),
        ],
      }),
    ],
  });
}
