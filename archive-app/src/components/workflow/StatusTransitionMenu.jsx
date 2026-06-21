/**
 * StatusTransitionMenu (§20.3)
 * Badge showing an item's workflow state + a menu of the transitions the
 * current role is allowed to make. Persists via POST /api/workflow/transition.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { getCloudToken } from "../../bootstrap/cloudSession.js";
import {
  getItemStateMeta,
  getAvailableTransitions,
  isOverdue,
} from "../../features/archive/itemStatus.js";

const BADGE_COLORS = {
  gray: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  green: "bg-green-500/15 text-green-300 border-green-500/30",
  zinc: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

/**
 * @param {object} props
 * @param {object} props.item       - archive item ({id, workflowStatus, workflowDueDate})
 * @param {string} props.role       - current user role (viewer/editor/admin/owner)
 * @param {string} [props.store]    - storage store name (default video_items)
 * @param {string} [props.baseUrl]
 * @param {(result:object)=>void} [props.onChanged] - fires after a successful transition
 * @param {typeof fetch} [props.fetchImpl]
 */
export function StatusTransitionMenu({ item, role = "viewer", store = "video_items", baseUrl = "", onChanged, fetchImpl }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingTo, setPendingTo] = useState(null);
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const menuRef = useRef(null);

  const meta = getItemStateMeta(item);
  const overdue = isOverdue(item);
  const options = getAvailableTransitions(item, role);
  const pendingOption = pendingTo ? options.find((o) => o.to === pendingTo) : null;

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setPendingTo(null);
    setNote("");
    setDueDate("");
    setError("");
  }, []);

  const transition = useCallback(async (to, opts = {}) => {
    setBusy(true);
    setError("");
    const doFetch = fetchImpl || fetch.bind(globalThis);
    try {
      const token = getCloudToken();
      const body = { store, id: item?.id, to };
      if (opts.note?.trim()) body.note = opts.note.trim();
      if (opts.dueDate) body.dueDate = opts.dueDate;
      const res = await doFetch(`${String(baseUrl || "").replace(/\/+$/, "")}/api/workflow/transition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "فشل تغيير الحالة.");
      closeMenu();
      onChanged?.(json.result);
    } catch (err) {
      setError(err?.message || "فشل تغيير الحالة.");
    } finally {
      setBusy(false);
    }
  }, [baseUrl, closeMenu, fetchImpl, item?.id, onChanged, store]);

  const badge = (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        BADGE_COLORS[meta.color] || BADGE_COLORS.gray,
      ].join(" ")}
    >
      {meta.label}
      {overdue && (
        <span className="inline-flex items-center gap-0.5 text-red-400" title="تجاوز تاريخ الاستحقاق">
          <Clock className="h-3 w-3" />
        </span>
      )}
    </span>
  );

  // Viewers (or states with no allowed exits) get a plain badge, no menu.
  if (!options.length) return badge;

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`حالة السجل: ${meta.label} — تغيير الحالة`}
        className="inline-flex items-center gap-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
      >
        {badge}
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && !pendingTo && (
        <ul
          role="menu"
          className="absolute z-50 mt-1 min-w-40 rounded-xl border border-[var(--va-border,rgba(255,255,255,0.1))] bg-[var(--va-surface-raised,#111827)] p-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.to} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => setPendingTo(option.to)}
                disabled={busy}
                className="w-full rounded-lg px-3 py-1.5 text-right text-sm text-gray-200 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && pendingTo && pendingOption && (
        <div
          className="absolute z-50 mt-1 w-72 rounded-xl border border-[var(--va-border,rgba(255,255,255,0.1))] bg-[var(--va-surface-raised,#111827)] p-3 shadow-lg"
          dir="rtl"
        >
          <p className="mb-3 text-xs font-semibold text-gray-300">
            الانتقال إلى: <span className="text-emerald-300">{pendingOption.label}</span>
          </p>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-gray-400">سبب التغيير (اختياري)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="أضف ملاحظة أو سبباً..."
                className="mt-1 w-full resize-none rounded-lg border border-[var(--va-border,rgba(255,255,255,0.1))] bg-white/5 px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">تاريخ الاستحقاق (اختياري)</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                dir="ltr"
                className="mt-1 w-full rounded-lg border border-[var(--va-border,rgba(255,255,255,0.1))] bg-white/5 px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-2 rounded-lg bg-red-500/15 px-2 py-1 text-xs text-red-300">
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-between gap-2">
            <button
              type="button"
              onClick={() => { setPendingTo(null); setNote(""); setDueDate(""); setError(""); }}
              disabled={busy}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 disabled:opacity-60"
            >
              رجوع
            </button>
            <button
              type="button"
              onClick={() => transition(pendingTo, { note, dueDate })}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy ? "يحفظ..." : "تأكيد"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
