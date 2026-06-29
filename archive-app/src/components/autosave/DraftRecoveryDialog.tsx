import * as React from "react";
import { createPortal } from "react-dom";
import { FileText, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

function formatRelativeTime(iso: any) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 2) return "قبل لحظة";
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  return `قبل ${Math.round(hours / 24)} يوم`;
}

/**
 * DraftRecoveryDialog — offers to restore or discard a saved draft.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object|null} props.draft - draft object with { data, updatedAt, key }
 * @param {(data: object) => void} props.onRestore
 * @param {() => void} props.onDiscard
 * @param {() => void} props.onClose
 */
export function DraftRecoveryDialog({ isOpen, draft, onRestore, onDiscard, onClose }: any) {
  const previewTitle = draft?.data?.title || draft?.data?.name || "";
  const savedAt = draft?.updatedAt || draft?.createdAt || "";

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: any) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && draft && (
        <motion.div
          key="draft-recovery-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          onClick={(e: any) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            key="draft-recovery-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="استعادة مسودة محفوظة"
            className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-5 shadow-2xl"
          >
            <button type="button" onClick={onClose} aria-label="إغلاق"
              className="absolute start-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl va-accent-bg-soft">
                <FileText className="h-4 w-4 va-accent-text" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white">مسودة غير محفوظة</h2>
                <p className="mt-1 text-xs text-gray-400">
                  {savedAt ? `حُفظت ${formatRelativeTime(savedAt)}` : "مسودة من جلسة سابقة"}
                  {previewTitle ? ` — ${previewTitle}` : ""}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-6 text-gray-400">
              هل تريد استعادة التعديلات غير المحفوظة من جلستك السابقة؟
            </p>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { onRestore?.(draft.data); onClose?.(); }}
                className="btn btn-primary flex-1"
              >
                استعادة المسودة
              </button>
              <button
                type="button"
                onClick={() => { onDiscard?.(); onClose?.(); }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-400 transition-colors hover:border-red-800/50 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                تجاهل
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
