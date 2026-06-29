import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  ArrowRight,
  FileAudio,
  FileText,
  Film,
  Loader2,
  ScanText,
  Zap
} from "lucide-react";

import { fileTypeFromKey } from "./viewModel.js";

// §16.15 — ConversionPanel: reusable UI for requesting format conversions.
// Shows conversion options relevant to the source file type and submits jobs
// via the injected mediaClient. Does NOT read or write item metadata directly —
// the parent (DetailPage) handles saving derived file records from completed jobs.
// PURE component: no store access, all deps are injected via props.

/** Conversion recipes keyed by source file category. */
const CONVERSIONS_BY_TYPE = Object.freeze({
  video: [
    {
      id: "audio",
      label: "استخراج الصوت",
      description: "MP3 من الفيديو",
      icon: FileAudio,
      params: { format: "mp3" },
      method: "audio"
    },
    {
      id: "webvideo",
      label: "نسخة ويب",
      description: "MP4 مضغوط للبث",
      icon: Film,
      params: { format: "mp4", preset: "web" },
      method: "transcode"
    },
    {
      id: "preview",
      label: "معاينة GIF",
      description: "GIF قصير للمعاينة",
      icon: Zap,
      params: { format: "gif" },
      method: "transcode"
    }
  ],
  audio: [
    {
      id: "mp3",
      label: "تحويل إلى MP3",
      description: "صيغة صوت متوافقة",
      icon: FileAudio,
      params: { format: "mp3" },
      method: "transcode"
    }
  ],
  image: [
    {
      id: "ocr",
      label: "استخراج النص (OCR)",
      description: "تحويل الصورة إلى نص",
      icon: ScanText,
      params: { mode: "ocr" },
      method: "transcode"
    }
  ],
  document: [
    {
      id: "pdf",
      label: "تحويل إلى PDF",
      description: "صيغة PDF قابلة للمشاركة",
      icon: FileText,
      params: { format: "pdf" },
      method: "transcode"
    }
  ]
});

/** Single conversion option button. */
function ConversionOption({ recipe, onStart, busy, disabled }: any) {
  const Icon = recipe.icon || ArrowRight;
  const isActive = busy === recipe.id;
  return jsx("button", {
    type: "button",
    onClick: () => onStart(recipe),
    disabled: disabled || Boolean(busy),
    className: `btn h-auto flex-col gap-1 px-3 py-3 text-xs ${isActive ? "btn-primary" : "btn-outline border-white/15 text-gray-300"} disabled:opacity-40`,
    "aria-label": recipe.label,
    title: recipe.description,
    children: jsxs(React.Fragment, {
      children: [
        isActive
          ? jsx(Loader2, { className: "h-5 w-5 animate-spin" })
          : jsx(Icon, { className: "h-5 w-5" }),
        jsx("span", { className: "font-semibold", children: recipe.label }),
        jsx("span", { className: "text-[10px] font-normal opacity-60", children: recipe.description })
      ]
    })
  }, recipe.id);
}

/**
 * ConversionPanel — shows format conversion options for a media item and
 * submits conversion jobs via mediaClient.
 *
 * @param {{
 *   sourceKey: string,
 *   mediaClient: object,
 *   disabled?: boolean,
 *   onJobCreated?: (job: object, recipe: object) => void,
 *   onError?: (error: Error, recipe: object) => void,
 * }} props
 */
export function ConversionPanel({ sourceKey, mediaClient, disabled = false, onJobCreated, onError }: any) {
  const [busy, setBusy] = React.useState("");
  const [lastJob, setLastJob] = React.useState(null);
  const [error, setError] = React.useState("");

  const fileType = fileTypeFromKey(sourceKey);
  const recipes = (CONVERSIONS_BY_TYPE as any)[fileType] || [];

  if (!recipes.length) {
    return jsx("p", {
      className: "text-xs text-gray-600",
      children: "لا توجد تحويلات متاحة لهذا النوع من الملفات."
    });
  }

  async function handleStart(recipe: any) {
    if (!mediaClient || busy || disabled) return;
    setBusy(recipe.id);
    setError("");
    setLastJob(null);
    try {
      let result;
      if (recipe.method === "audio") {
        result = await mediaClient.audio(sourceKey, recipe.params || {});
      } else {
        result = await mediaClient.transcode(sourceKey, { ...recipe.params, outputLabel: recipe.label });
      }
      setLastJob(result);
      onJobCreated?.(result, recipe);
    } catch (err: any) {
      const msg = err?.message || "فشل بدء التحويل.";
      setError(msg);
      onError?.(err, recipe);
    } finally {
      setBusy("");
    }
  }

  return jsxs("div", {
    className: "space-y-3",
    children: [
      jsx("div", {
        className: `grid gap-2 ${recipes.length <= 2 ? "grid-cols-2" : "grid-cols-3"}`,
        children: recipes.map((recipe: any) =>
          jsx(ConversionOption, {
            recipe,
            onStart: handleStart,
            busy,
            disabled: disabled || !sourceKey
          }, recipe.id)
        )
      }),

      error && jsx("div", {
        role: "alert",
        className: "rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300",
        children: error
      }),

      lastJob && jsxs("div", {
        role: "status",
        className: "rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200",
        children: [
          "✓ المهمة بدأت — معرّف: ",
          jsx("span", { dir: "ltr", className: "font-mono", children: String((lastJob as any).id || (lastJob as any).jobId || "—") })
        ]
      })
    ]
  });
}

export default ConversionPanel;
