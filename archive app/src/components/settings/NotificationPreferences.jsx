/**
 * NotificationPreferences
 * UI panel for managing per-user email notification preferences.
 * Renders inside SettingsPage under the Maintenance/Notifications section.
 */
import { useState, useEffect, useCallback } from "react";
import { Bell, Mail, Upload, Share2 } from "lucide-react";
import { useAppStore } from "../../stores/index.js";

const DEFAULT_PREFS = { emailOnShare: true, emailOnUpload: false, emailOnMention: true };

const PREF_ITEMS = [
  {
    key: "emailOnShare",
    icon: Share2,
    label: "إشعار عند مشاركة سجل معك",
    desc: "يصلك بريد إلكتروني عند مشاركة أحدهم سجلاً معك",
  },
  {
    key: "emailOnUpload",
    icon: Upload,
    label: "إشعار عند اكتمال معالجة الرفع",
    desc: "يصلك بريد عند اكتمال OCR ومعالجة الملف",
  },
  {
    key: "emailOnMention",
    icon: Bell,
    label: "إشعار عند الإشارة إليك",
    desc: "يصلك بريد عند الإشارة إلى اسمك في ملاحظات السجل",
  },
];

export function NotificationPreferences() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const { showToast } = useAppStore((s) => ({ showToast: s.showToast }));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notification-preferences", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.prefs) setPrefs({ ...DEFAULT_PREFS, ...d.prefs });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(async (key) => {
    const prev = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) throw new Error("server error");
    } catch {
      showToast?.("فشل حفظ التفضيل", "error");
      setPrefs(prev); // revert optimistic update
    } finally {
      setSaving(false);
    }
  }, [prefs, showToast]);

  return (
    <section aria-labelledby="email-notif-heading" className="space-y-3">
      <h3
        id="email-notif-heading"
        className="flex items-center gap-2 text-sm font-semibold text-white"
      >
        <Mail className="h-4 w-4 text-[var(--va-action)]" />
        إشعارات البريد الإلكتروني
      </h3>

      {loadError && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
          تعذّر تحميل التفضيلات. تأكد من اتصال الخادم.
        </p>
      )}

      <ul className="space-y-2">
        {PREF_ITEMS.map((item) => {
          const Icon = item.icon;
          const checked = prefs[item.key];
          return (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--va-border,rgba(255,255,255,0.1))] bg-[var(--va-surface,rgba(255,255,255,0.03))] p-3"
            >
              <div className="flex items-start gap-2 min-w-0">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs leading-5 text-gray-500">{item.desc}</p>
                </div>
              </div>

              {/* Accessible toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={item.label}
                onClick={() => toggle(item.key)}
                disabled={saving}
                className={[
                  "relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  checked ? "bg-emerald-600" : "bg-gray-700",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                    checked ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
                <span className="sr-only">{checked ? "مفعّل" : "معطّل"}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-5 text-gray-500">
        تطبّق هذه الإعدادات على البريد الإلكتروني المرتبط بحسابك. يتطلّب تكوين SMTP على الخادم.
      </p>
    </section>
  );
}
