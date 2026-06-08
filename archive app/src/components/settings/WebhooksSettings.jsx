import { useState, useEffect } from "react";
import { Webhook, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "../../stores/index.js";

const ALL_EVENTS = [
  { id: "record.created", label: "إنشاء سجل" },
  { id: "record.updated", label: "تحديث سجل" },
  { id: "record.deleted", label: "حذف سجل" },
  { id: "record.restored", label: "استعادة سجل" },
];

export function WebhooksSettings() {
  const [hooks, setHooks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState(ALL_EVENTS.map(e => e.id));
  const showToast = useAppStore(s => s.showToast);

  useEffect(() => { fetchHooks(); }, []);

  async function fetchHooks() {
    try {
      const r = await fetch("/api/webhooks", { credentials: "include" });
      if (r.ok) setHooks((await r.json()).hooks ?? []);
    } catch {
      // silently ignore — server may not be available in local mode
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const r = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, events }),
      });
      if (r.ok) {
        showToast?.("تمت إضافة الـ Webhook", "success");
        setShowForm(false);
        setUrl("");
        setEvents(ALL_EVENTS.map(ev => ev.id));
        fetchHooks();
      } else {
        const data = await r.json().catch(() => ({}));
        showToast?.(data.error || "فشلت إضافة الـ Webhook", "error");
      }
    } catch {
      showToast?.("تعذر الاتصال بالخادم", "error");
    }
  }

  async function handleDelete(id) {
    if (!confirm("هل تريد حذف هذا الـ Webhook؟")) return;
    try {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE", credentials: "include" });
      fetchHooks();
    } catch {
      showToast?.("تعذر حذف الـ Webhook", "error");
    }
  }

  function toggleEvent(eventId, checked) {
    setEvents(prev =>
      checked ? [...prev, eventId] : prev.filter(x => x !== eventId)
    );
  }

  return (
    <section aria-labelledby="webhooks-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2
          id="webhooks-heading"
          className="text-base font-semibold flex items-center gap-2"
        >
          <Webhook className="w-4 h-4" /> Webhooks الصادرة
        </h2>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-xl border border-[var(--va-border)] bg-[var(--va-surface)] space-y-3"
        >
          <input
            type="url"
            required
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            className="w-full px-3 py-2 rounded-lg border border-[var(--va-border)] bg-[var(--va-bg)] text-sm focus:outline-none focus:ring-2 ring-emerald-500"
          />
          <div className="flex flex-wrap gap-3">
            {ALL_EVENTS.map(ev => (
              <label key={ev.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={events.includes(ev.id)}
                  onChange={e => toggleEvent(ev.id, e.target.checked)}
                />
                {ev.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={events.length === 0}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 rounded-lg border border-[var(--va-border)] text-sm"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {hooks.length === 0 ? (
        <p className="text-sm text-[var(--va-text-muted)] py-4 text-center">
          لا توجد Webhooks مسجّلة
        </p>
      ) : (
        <ul className="space-y-2">
          {hooks.map(hook => (
            <li
              key={hook.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-[var(--va-border)] bg-[var(--va-surface)]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono truncate">{hook.url}</p>
                <p className="text-xs text-[var(--va-text-muted)] mt-0.5">
                  {hook.events.join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(hook.id)}
                aria-label="حذف"
                className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
