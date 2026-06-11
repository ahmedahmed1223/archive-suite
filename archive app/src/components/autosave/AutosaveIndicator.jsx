import * as React from "react";
import { CheckCircle2, CloudOff, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * AutosaveIndicator — compact status badge for form autosave state.
 *
 * @param {object} props
 * @param {"idle"|"saving"|"saved"|"error"} props.status
 * @param {string} [props.className]
 */
export function AutosaveIndicator({ status, className = "" }) {
  if (status === "idle") return null;

  const config = {
    saving: { icon: Loader2, text: "يحفظ…", spin: true, tone: "text-gray-400" },
    saved:  { icon: CheckCircle2, text: "تم الحفظ", spin: false, tone: "text-emerald-400" },
    error:  { icon: CloudOff, text: "تعذر الحفظ", spin: false, tone: "text-red-400" }
  }[status];

  if (!config) return null;
  const { icon: Icon, text, spin, tone } = config;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className={`inline-flex items-center gap-1.5 text-xs ${tone} ${className}`}
        aria-live="polite"
        aria-label={text}
      >
        <Icon className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} aria-hidden="true" />
        <span>{text}</span>
      </motion.div>
    </AnimatePresence>
  );
}
