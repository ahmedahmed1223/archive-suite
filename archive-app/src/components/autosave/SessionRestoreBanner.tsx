import * as React from "react";
import { History, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const PAGE_LABELS = {
  archive: "الأرشيف",
  dashboard: "لوحة التحكم",
  collections: "المجموعات",
  projects: "المشاريع",
  search: "البحث",
  settings: "الإعدادات"
};

/**
 * SessionRestoreBanner — non-intrusive top banner to restore a saved session.
 *
 * @param {object} props
 * @param {object|null} props.session - session object { page, filters, folderId, scrollPosition, updatedAt }
 * @param {(session: object) => void} props.onRestore
 * @param {() => void} props.onDismiss
 */
export function SessionRestoreBanner({ session, onRestore, onDismiss }: any) {
  const isVisible = !!session;
  const pageLabel = (PAGE_LABELS as any)[session?.page] || session?.page || "الصفحة السابقة";
  const hasFilters = session?.filters && Object.keys(session.filters).length > 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="session-restore-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-4 py-3 text-sm">
            <History className="h-4 w-4 shrink-0 text-[var(--va-text-muted)]" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-[var(--va-text-2)]">
              استئناف جلسة سابقة في <span className="font-medium text-[var(--va-text)]">{pageLabel}</span>
              {hasFilters && <span className="text-[var(--va-text-muted)]"> مع الفلاتر المحفوظة</span>}
            </p>
            <button
              type="button"
              onClick={() => onRestore?.(session)}
              className="shrink-0 rounded-lg va-accent-bg-soft px-3 py-1.5 text-xs font-semibold va-accent-text-on-soft transition-opacity hover:opacity-80"
            >
              استعادة
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="تجاهل"
              className="shrink-0 rounded-lg p-1 text-[var(--va-text-muted)] hover:bg-[var(--va-border-soft)] hover:text-[var(--va-text)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
