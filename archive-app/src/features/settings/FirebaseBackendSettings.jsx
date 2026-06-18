import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Flame } from "lucide-react";

import { getFirebaseConfig, getLocalEngine } from "../../bootstrap/backendChoice.js";
import { parseFirebaseConfigText, stringifyFirebaseConfig } from "../../bootstrap/firebaseConfig.js";
import { switchBackendHot } from "../../bootstrap/switchBackendHot.js";
import { useAppStore } from "../../stores/index.js";
import { SettingsCard } from "./SettingsControls.jsx";

export function FirebaseBackendSettings() {
  const { showToast } = useAppStore();
  const [text, setText] = React.useState(() => stringifyFirebaseConfig(getFirebaseConfig() || {}));
  const [migrate, setMigrate] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const parsed = React.useMemo(() => parseFirebaseConfigText(text), [text]);

  const save = async () => {
    if (!parsed.ok || saving) return;
    setSaving(true);
    const result = await switchBackendHot("firebase", "", {
      firebaseConfig: parsed.config,
      localEngine: getLocalEngine(),
      migrate
    });
    setSaving(false);
    if (result.ok) showToast?.("تم تفعيل Firebase كخيار تخزين.", "success");
    else showToast?.(result.error || "تعذر تفعيل Firebase.", "error");
  };

  return jsx(SettingsCard, {
    title: "Firebase داخل AI Studio",
    description: "ألصق firebaseConfig من مشروعك لتفعيل Firestore/Auth/Storage من جانب العميل. لا تُحفظ مفاتيح خادم خاصة هنا.",
    icon: jsx(Flame, { className: "h-5 w-5 text-orange-300" }),
    aside: jsx("span", { className: `rounded-full border px-3 py-1 text-xs ${parsed.ok ? "border-green-500/30 text-green-200" : "border-amber-500/30 text-amber-100"}`, children: parsed.ok ? "جاهز" : "ينقصه إعداد" }),
    children: jsxs("div", { className: "space-y-3", dir: "rtl", children: [
      jsx("textarea", {
        value: text,
        onChange: (event) => setText(event.target.value),
        dir: "ltr",
        rows: 7,
        spellCheck: false,
        className: "textarea textarea-bordered w-full font-mono text-xs",
        placeholder: "{\n  \"apiKey\": \"...\",\n  \"projectId\": \"...\",\n  \"appId\": \"...\"\n}"
      }),
      !parsed.ok && jsx("p", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100", children: `حقول مطلوبة: ${parsed.errors.join(", ")}` }),
      jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-300", children: [
        jsx("input", {
          type: "checkbox",
          checked: migrate,
          onChange: (event) => setMigrate(event.target.checked),
          className: "checkbox checkbox-sm"
        }),
        "ترحيل لقطة من التخزين الحالي إلى Firebase بعد التفعيل"
      ] }),
      jsx("button", {
        type: "button",
        onClick: save,
        disabled: !parsed.ok || saving,
        className: "btn btn-primary",
        children: saving ? "يتم الحفظ…" : "تفعيل Firebase"
      })
    ] })
  });
}

export default FirebaseBackendSettings;
