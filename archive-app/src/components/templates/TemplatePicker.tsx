import * as React from "react";
import { createPortal } from "react-dom";
import { X, Search, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useAppStore } from "../../stores/index.js";
import { BUILT_IN_TEMPLATES, filterTemplates, resolveDynamicFields } from "../../features/templates/viewModel.js";

/**
 * TemplatePicker — modal dialog for choosing a template to pre-fill a form.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {(template: object, resolved: object) => void} props.onApply
 * @param {{ counter?: number, lastValues?: object }} [props.context]
 */
export function TemplatePicker({ isOpen, onClose, onApply, context = {} }: any) {
  const userTemplates = useAppStore((state: any) => state.templates || []);
  const [query, setQuery] = React.useState("");
  const searchRef = React.useRef(null);

  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
      window.requestAnimationFrame(() => (searchRef.current as any)?.focus());
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: any) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const allTemplates = React.useMemo(() => {
    const custom = (userTemplates || []).filter((t: any) => !t.isBuiltIn);
    return [...custom, ...BUILT_IN_TEMPLATES] as any[];
  }, [userTemplates]);

  const filtered = React.useMemo(() => filterTemplates(allTemplates as never[], query), [allTemplates, query]);

  const handleApply = (template: any) => {
    const resolved = resolveDynamicFields(template, context);
    onApply?.(template, resolved);
    onClose?.();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="template-picker-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e: any) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            key="template-picker-panel"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="اختيار قالب"
            className="relative z-10 w-full max-w-xl rounded-2xl border border-white/10 bg-gray-900 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 va-accent-text" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-white">تطبيق قالب</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-white/10 px-5 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-gray-950/50 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e: any) => setQuery(e.target.value)}
                  placeholder="ابحث في القوالب…"
                  className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                  aria-label="بحث في القوالب"
                />
              </div>
            </div>

            {/* Template list */}
            <div className="max-h-80 overflow-y-auto overscroll-contain p-3">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  {query ? "لا قوالب تطابق البحث" : "لا توجد قوالب بعد"}
                </p>
              ) : (
                <div className="grid gap-2">
                  {filtered.map((template: any) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleApply(template)}
                      className="group flex w-full items-start gap-3 rounded-xl border border-white/5 bg-gray-800/40 px-4 py-3 text-right transition-colors hover:border-white/15 hover:bg-gray-800/70"
                    >
                      <span className="mt-0.5 shrink-0 text-xl leading-none" aria-hidden="true">
                        {template.icon || "📋"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{template.name}</span>
                          {template.isBuiltIn && (
                            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">مدمج</span>
                          )}
                          {(template.usageCount || 0) > 0 && (
                            <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500">
                              {template.usageCount}×
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">{template.description}</p>
                        )}
                      </div>
                      <span
                        className="mt-0.5 shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ backgroundColor: template.color || "#10b981" }}
                      >
                        تطبيق
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
              <p className="text-xs text-gray-500">{filtered.length} قالب</p>
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-gray-400 transition-colors hover:text-white"
              >
                تخطي
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
