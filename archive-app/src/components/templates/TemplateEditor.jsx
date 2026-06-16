import * as React from "react";
import { createPortal } from "react-dom";
import { X, Save, Trash2, AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useAppStore } from "../../stores/index.js";
import { createItemTemplate } from "../../features/templates/viewModel.js";

const EMOJI_OPTIONS = ["📋", "🎓", "📄", "🎵", "🎬", "📸", "📊", "📰", "🗂️", "📁", "🔖", "💡", "🔬", "📚", "🎯"];
const COLOR_OPTIONS = ["#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1", "#f97316", "#64748b"];

/**
 * TemplateEditor — dialog to create or edit a user template.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object|null} [props.template] - null to create new, object to edit
 * @param {() => void} props.onClose
 * @param {(template: object) => void} [props.onSaved]
 */
export function TemplateEditor({ isOpen, template, onClose, onSaved }) {
  const createTemplate = useAppStore((state) => state.createTemplate);
  const updateTemplate = useAppStore((state) => state.updateTemplate);
  const deleteTemplate = useAppStore((state) => state.deleteTemplate);
  const showToast = useAppStore((state) => state.showToast);

  const isEdit = !!template?.id && !template?.isBuiltIn;

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [icon, setIcon] = React.useState("📋");
  const [color, setColor] = React.useState("#10b981");
  const [tagsRaw, setTagsRaw] = React.useState("");
  const [typeField, setTypeField] = React.useState("");
  const [notesField, setNotesField] = React.useState("");
  const [titleFormula, setTitleFormula] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const nameRef = React.useRef(null);

  React.useEffect(() => {
    if (isOpen) {
      setName(template?.name || "");
      setDescription(template?.description || "");
      setIcon(template?.icon || "📋");
      setColor(template?.color || "#10b981");
      setTagsRaw(Array.isArray(template?.fields?.tags) ? template.fields.tags.join("، ") : (template?.fields?.tags || ""));
      setTypeField(template?.fields?.type || "");
      setNotesField(template?.fields?.notes || "");
      setTitleFormula(template?.dynamicFields?.title || "");
      setSaving(false);
      setConfirmDelete(false);
      window.requestAnimationFrame(() => nameRef.current?.focus());
    }
  }, [isOpen, template]);

  React.useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast?.("يرجى إدخال اسم القالب", "warning");
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const tags = tagsRaw.split(/[,،]/).map((t) => t.trim()).filter(Boolean);
      const fields = {};
      if (typeField.trim()) fields.type = typeField.trim();
      if (tags.length) fields.tags = tags;
      if (notesField.trim()) fields.notes = notesField.trim();

      const dynamicFields = {};
      if (titleFormula.trim()) dynamicFields.title = titleFormula.trim();

      const partial = { name: name.trim(), description: description.trim(), icon, color, fields, dynamicFields };

      let saved;
      if (isEdit) {
        saved = await updateTemplate({ ...partial, id: template.id, createdAt: template.createdAt });
        showToast?.("تم تحديث القالب", "success");
      } else {
        saved = await createTemplate(partial);
        showToast?.("تم حفظ القالب الجديد", "success");
      }
      onSaved?.(saved);
      onClose?.();
    } catch (error) {
      showToast?.(error?.message || "تعذر حفظ القالب", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteTemplate(template.id);
      showToast?.("تم حذف القالب", "success");
      onClose?.();
    } catch {
      showToast?.("تعذر حذف القالب", "error");
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="template-editor-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            key="template-editor-panel"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={isEdit ? "تعديل القالب" : "إنشاء قالب جديد"}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-gray-900 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">
                {isEdit ? "تعديل القالب" : "قالب جديد"}
              </h2>
              <button type="button" onClick={onClose} aria-label="إغلاق"
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 overflow-y-auto p-5" style={{ maxHeight: "calc(100vh - 200px)" }}>
              {/* Icon + Name + Description */}
              <div className="flex items-start gap-3">
                {/* Icon picker */}
                <div className="space-y-1.5">
                  <label className="block text-xs text-gray-400">أيقونة</label>
                  <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-gray-950/50 p-2" style={{ width: 112 }}>
                    {EMOJI_OPTIONS.map((e) => (
                      <button key={e} type="button" onClick={() => setIcon(e)}
                        className={`rounded p-1 text-base transition-colors ${icon === e ? "bg-white/20" : "hover:bg-white/10"}`}
                        aria-label={`أيقونة ${e}`} aria-pressed={icon === e}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name + description */}
                <div className="flex-1 space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="template-name" className="block text-xs text-gray-400">
                      الاسم <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="template-name"
                      ref={nameRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="اسم القالب"
                      className="w-full rounded-lg border border-white/10 bg-gray-950/50 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/25"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="template-desc" className="block text-xs text-gray-400">وصف (اختياري)</label>
                    <input
                      id="template-desc"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="وصف مختصر للقالب"
                      className="w-full rounded-lg border border-white/10 bg-gray-950/50 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/25"
                    />
                  </div>
                </div>
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <label className="block text-xs text-gray-400">لون</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className={`h-6 w-6 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-gray-900" : "hover:scale-110"}`}
                      aria-label={`لون ${c}`} aria-pressed={color === c}
                    />
                  ))}
                </div>
              </div>

              {/* Static fields */}
              <div className="space-y-3 rounded-xl border border-white/5 bg-gray-800/30 p-4">
                <p className="text-xs font-medium text-gray-300">الحقول الثابتة</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="template-type" className="block text-xs text-gray-400">نوع المحتوى</label>
                    <input id="template-type" type="text" value={typeField}
                      onChange={(e) => setTypeField(e.target.value)}
                      placeholder="video / document / audio"
                      className="w-full rounded-lg border border-white/10 bg-gray-950/50 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/25"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="template-tags" className="block text-xs text-gray-400">وسوم</label>
                    <input id="template-tags" type="text" value={tagsRaw}
                      onChange={(e) => setTagsRaw(e.target.value)}
                      placeholder="وسم1، وسم2، وسم3"
                      className="w-full rounded-lg border border-white/10 bg-gray-950/50 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/25"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="template-notes" className="block text-xs text-gray-400">ملاحظات افتراضية</label>
                  <textarea id="template-notes" value={notesField}
                    onChange={(e) => setNotesField(e.target.value)}
                    placeholder="ملاحظات تُضاف تلقائيًا عند تطبيق القالب"
                    rows={2}
                    className="w-full resize-none rounded-lg border border-white/10 bg-gray-950/50 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/25"
                  />
                </div>
              </div>

              {/* Dynamic fields */}
              <div className="space-y-3 rounded-xl border border-white/5 bg-gray-800/30 p-4">
                <p className="text-xs font-medium text-gray-300">الحقول الديناميكية</p>
                <p className="text-xs text-gray-500">
                  الصيغ: <code className="text-gray-300">today()</code>، <code className="text-gray-300">autoNumber()</code>،{" "}
                  <code className="text-gray-300">concat(نص, today())</code>
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="template-title-formula" className="block text-xs text-gray-400">صيغة العنوان</label>
                  <input id="template-title-formula" type="text" value={titleFormula}
                    onChange={(e) => setTitleFormula(e.target.value)}
                    placeholder="concat(محاضرة, autoNumber())"
                    className="w-full rounded-lg border border-white/10 bg-gray-950/50 px-3 py-2 font-mono text-sm text-white placeholder-gray-500 outline-none focus:border-white/25"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
              <div>
                {isEdit && (
                  <button type="button" onClick={handleDelete}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-colors ${
                      confirmDelete
                        ? "bg-red-900/50 text-red-300 hover:bg-red-900/70"
                        : "text-gray-400 hover:bg-white/5 hover:text-red-400"
                    }`}
                  >
                    {confirmDelete
                      ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    {confirmDelete ? "تأكيد الحذف" : "حذف"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white">
                  إلغاء
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="btn btn-primary gap-1.5">
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  {saving ? "جاري الحفظ…" : "حفظ"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
