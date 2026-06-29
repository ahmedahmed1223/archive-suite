/**
 * FieldPermissionsSettings — per-field role-based access control UI.
 *
 * Reads contentTypes from the store, renders a per-field permission matrix
 * (admin / editor / viewer), and saves changes via updateContentType().
 *
 * fieldAcl shape: { [fieldKey]: string[] }
 *   • empty array / missing key → field visible to everyone
 *   • ["admin", "editor"]      → only those roles can see the field
 *
 * The server-side enforcement is in archive-server/src/share/fieldAcl.js;
 * this component manages the data that controls that logic.
 */
import React, { useState, useCallback } from "react";
import { Eye, EyeOff, Shield } from "lucide-react";
import { useAppStore } from "../../stores/index.js";

const ROLES = [
  { id: "admin",  label: "مسؤول",  color: "text-red-400" },
  { id: "editor", label: "محرر",   color: "text-amber-400" },
  { id: "viewer", label: "مشاهد",  color: "text-sky-400" },
];

function isRestricted(acl: any, key: any) {
  const allowed = acl?.[key];
  return Array.isArray(allowed) && allowed.length > 0;
}

function hasRole(acl: any, key: any, role: any) {
  const allowed = acl?.[key];
  return Array.isArray(allowed) && allowed.includes(role);
}

function toggleRole(acl: any = {}, key: any, role: any) {
  const current = Array.isArray(acl[key]) ? [...acl[key]] : [];
  const next = current.includes(role)
    ? current.filter((r: any) => r !== role)
    : [...current, role];
  return { ...acl, [key]: next };
}

function removeRestriction(acl: any = {}, key: any) {
  const next = { ...acl };
  delete next[key];
  return next;
}

export function FieldPermissionsSettings() {
  const { contentTypes, updateContentType } = useAppStore();
  const [saving, setSaving] = useState({});
  const [saved,  setSaved]  = useState({});
  // local drafts: { [typeId]: fieldAcl }
  const [drafts, setDrafts] = useState({});

  const getDraft = useCallback(
    (type: any) => (drafts as any)[type.id] ?? type.fieldAcl ?? {},
    [drafts]
  );

  const patch = useCallback((typeId: any, updater: any) => {
    setDrafts((prev: any) => ({
      ...prev,
      [typeId]: updater(prev[typeId] ?? contentTypes.find((t: any) => t.id === typeId)?.fieldAcl ?? {}),
    }));
  }, [contentTypes]);

  const save = useCallback(async (type: any) => {
    const acl = (drafts as any)[type.id] ?? type.fieldAcl ?? {};
    setSaving((p: any) => ({ ...p, [type.id]: true }));
    try {
      await updateContentType({ ...type, fieldAcl: acl });
      setSaved((p: any) => ({ ...p, [type.id]: true }));
      setTimeout(() => setSaved((p: any) => ({ ...p, [type.id]: false })), 2000);
    } finally {
      setSaving((p: any) => ({ ...p, [type.id]: false }));
    }
  }, [updateContentType, drafts]);

  const activeTypes = contentTypes.filter(
    (t: any) => t.status !== "archived" && Array.isArray(t.fields) && t.fields.length > 0
  );

  if (activeTypes.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-gray-950/30 p-6 text-center text-sm text-gray-500">
        <Shield className="mx-auto mb-3 h-8 w-8 opacity-30" />
        <p>لا توجد أنواع محتوى بحقول مخصصة.</p>
        <p className="mt-1 text-xs">أضف حقولاً مخصصة من صفحة إدارة الأنواع أولاً.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <p role="alert" className="alert alert-warning block rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
        <strong>ملاحظة:</strong> تُطبَّق هذه القيود عند جلب السجلات من الخادم.
        المسؤولون يرون جميع الحقول دائمًا.
      </p>

      {activeTypes.map((type: any) => {
        const acl     = getDraft(type);
        const isDirty = JSON.stringify(acl) !== JSON.stringify(type.fieldAcl ?? {});

        return (
          <section key={type.id} className="rounded-xl border border-white/10 bg-gray-950/30">

            {/* ── Type header ── */}
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{type.name}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                  {type.fields.length} حقل
                </span>
              </div>
              <button
                type="button"
                disabled={!isDirty || (saving as any)[type.id]}
                onClick={() => save(type)}
                className="min-h-8 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {(saving as any)[type.id] ? "جاري الحفظ…" : (saved as any)[type.id] ? "✓ تم الحفظ" : "حفظ"}
              </button>
            </div>

            {/* ── Column headers ── */}
            <div className="flex items-center gap-4 border-b border-white/5 px-4 py-1.5">
              <span className="flex-1 text-[11px] text-gray-500">الحقل</span>
              <span className="w-16 text-[11px] text-gray-500">الوصول</span>
              {ROLES.map((r: any) => (
                <span key={r.id} className={`w-10 text-center text-[11px] font-medium ${r.color}`}>{r.label}</span>
              ))}
            </div>

            {/* ── Field rows ── */}
            <div className="divide-y divide-white/5">
              {type.fields.map((field: any) => {
                const key        = field.key || field.id || field.name;
                const restricted = isRestricted(acl, key);

                return (
                  <div key={key} className="flex items-center gap-4 px-4 py-2.5">

                    {/* Field name */}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-200">{field.label || field.name}</span>
                      {field.type && <span className="text-[11px] text-gray-500">{field.type}</span>}
                    </div>

                    {/* Open / Restricted toggle */}
                    <button
                      type="button"
                      title={restricted ? "إزالة القيد — مفتوح للجميع" : "تفعيل قيد الوصول"}
                      onClick={() =>
                        patch(type.id, (a: any) =>
                          restricted
                            ? removeRestriction(a, key)
                            : { ...a, [key]: ["admin"] }
                        )
                      }
                      className={`flex w-16 items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs transition ${
                        restricted
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                      }`}
                    >
                      {restricted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {restricted ? "مقيّد" : "مفتوح"}
                    </button>

                    {/* Per-role checkboxes */}
                    {ROLES.map((role: any) => (
                      <label
                        key={role.id}
                        title={restricted ? `منح صلاحية للـ${role.label}` : "فعّل القيد أولاً"}
                        className={`flex w-10 cursor-pointer items-center justify-center ${
                          restricted ? role.color : "cursor-not-allowed text-gray-600"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!restricted}
                          checked={restricted && hasRole(acl, key, role.id)}
                          onChange={() => patch(type.id, (a: any) => toggleRole(a, key, role.id))}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="sr-only">{role.label}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

FieldPermissionsSettings.displayName = "FieldPermissionsSettings";
export default FieldPermissionsSettings;
