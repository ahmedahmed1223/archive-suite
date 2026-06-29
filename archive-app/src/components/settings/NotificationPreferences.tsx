/**
 * NotificationPreferences
 * UI panel for managing per-user email notification preferences.
 * Renders inside SettingsPage under the Maintenance/Notifications section.
 */
import { useState, useEffect, useCallback } from "react";
import { Bell, BellRing, Mail, Upload, Share2, AlertTriangle } from "lucide-react";
import { useAppStore } from "../../stores/index.js";
import {
  isPushSupported,
  getPushSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
} from "../../services/pushService.js";

const DEFAULT_PREFS = {
  emailOnShare: true, emailOnUpload: false, emailOnMention: true,
  pushOnShare: true, pushOnUpload: true, pushOnMention: true, pushOnSystem: true,
};

const PUSH_PREF_ITEMS = [
  {
    key: "pushOnShare",
    icon: Share2,
    label: "تنبيه عند مشاركة سجل معك",
    desc: "إشعار فوري على هذا الجهاز عند مشاركة سجل",
  },
  {
    key: "pushOnUpload",
    icon: Upload,
    label: "تنبيه عند اكتمال معالجة الرفع",
    desc: "إشعار فوري عند اكتمال OCR ومعالجة الملف",
  },
  {
    key: "pushOnMention",
    icon: Bell,
    label: "تنبيه عند الإشارة إليك",
    desc: "إشعار فوري عند ذكر اسمك في ملاحظات سجل",
  },
  {
    key: "pushOnSystem",
    icon: AlertTriangle,
    label: "تنبيهات النظام",
    desc: "فشل النسخ الاحتياطي، اكتشاف مكررات، وأحداث النظام",
  },
];

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

// DaisyUI toggle (§1881 Phase 2) — native checkbox with switch styling
function ToggleSwitch({ checked, label, disabled, onToggle }: any) {
  return (
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      onChange={onToggle}
      disabled={disabled}
      className="toggle toggle-accent shrink-0"
    />
  );
}

function PrefList({ items, prefs, saving, onToggle }: any) {
  return (
    <ul className="space-y-2">
      {items.map((item: any) => {
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
            <ToggleSwitch
              checked={checked}
              label={item.label}
              disabled={saving}
              onToggle={() => onToggle(item.key)}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function NotificationPreferences() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [push, setPush] = useState({ supported: isPushSupported(), subscribed: false, busy: false });
  const { showToast } = useAppStore((s: any) => ({ showToast: s.showToast }));

  useEffect(() => {
    let cancelled = false;
    getPushSubscriptionState()
      .then((state: any) => {
        if (!cancelled) setPush((p: any) => ({ ...p, ...state }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const togglePushSubscription = useCallback(async () => {
    setPush((p: any) => ({ ...p, busy: true }));
    try {
      if (push.subscribed) {
        await unsubscribeFromPush();
        setPush((p: any) => ({ ...p, subscribed: false, busy: false }));
        showToast?.("أُلغيت تنبيهات هذا الجهاز", "info");
      } else {
        await subscribeToPush();
        setPush((p: any) => ({ ...p, subscribed: true, busy: false }));
        showToast?.("فُعّلت التنبيهات على هذا الجهاز", "success");
      }
    } catch (error: any) {
      setPush((p: any) => ({ ...p, busy: false }));
      showToast?.(error?.message || "فشل تغيير حالة التنبيهات", "error");
    }
  }, [push.subscribed, showToast]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notification-preferences", { credentials: "include" })
      .then((r: any) => r.json())
      .then((d: any) => {
        if (!cancelled && d?.prefs) setPrefs({ ...DEFAULT_PREFS, ...d.prefs });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(async (key: any) => {
    const prev = prefs;
    const next = { ...prefs, [key]: !(prefs as any)[key] };
    setPrefs(next);
    setSaving(true);
    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [key]: (next as any)[key] }),
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
        <p role="alert" className="alert alert-warning block rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
          تعذّر تحميل التفضيلات. تأكد من اتصال الخادم.
        </p>
      )}

      <PrefList items={PREF_ITEMS} prefs={prefs} saving={saving} onToggle={toggle} />

      <p className="text-xs leading-5 text-gray-500">
        تطبّق هذه الإعدادات على البريد الإلكتروني المرتبط بحسابك. يتطلّب تكوين SMTP على الخادم.
      </p>

      {/* Web Push (§20.2) — device-level subscription + per-type preferences */}
      <h3
        id="push-notif-heading"
        className="flex items-center gap-2 pt-2 text-sm font-semibold text-white"
      >
        <BellRing className="h-4 w-4 text-[var(--va-action)]" />
        التنبيهات خارج التطبيق (Web Push)
      </h3>

      {!push.supported ? (
        <p role="alert" className="alert alert-warning block rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
          هذا المتصفح لا يدعم تنبيهات Web Push.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--va-border,rgba(255,255,255,0.1))] bg-[var(--va-surface,rgba(255,255,255,0.03))] p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">تفعيل التنبيهات على هذا الجهاز</p>
              <p className="text-xs leading-5 text-gray-500">
                يطلب إذن الإشعارات من المتصفح ويسجّل هذا الجهاز لدى الخادم
              </p>
            </div>
            <ToggleSwitch
              checked={push.subscribed}
              label="تفعيل التنبيهات على هذا الجهاز"
              disabled={push.busy}
              onToggle={togglePushSubscription}
            />
          </div>

          {push.subscribed && (
            <PrefList items={PUSH_PREF_ITEMS} prefs={prefs} saving={saving} onToggle={toggle} />
          )}
        </>
      )}

      <p className="text-xs leading-5 text-gray-500">
        تتطلب التنبيهات الخارجية تهيئة مفاتيح VAPID على الخادم، وتعمل حتى عندما يكون التطبيق مغلقًا.
      </p>
    </section>
  );
}
