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
  const menuRef = useRef(null);

  const meta = getItemStateMeta(item);
  const overdue = isOverdue(item);
  const options = getAvailableTransitions(item, role);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const transition = useCallback(async (to) => {
    setBusy(true);
    setError("");
    const doFetch = fetchImpl || fetch.bind(globalThis);
    try {
      const token = getCloudToken();
      const res = await doFetch(`${String(baseUrl || "").replace(/\/+$/, "")}/api/workflow/transition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ store, id: item?.id, to }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "فشل تغيير الحالة.");
      setOpen(false);
      onChanged?.(json.result);
    } catch (err) {
      setError(err?.message || "فشل تغيير الحالة.");
    } finally {
      setBusy(false);
    }
  }, [baseUrl, fetchImpl, item?.id, onChanged, store]);

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

      {open && (
        <ul
          role="menu"
          className="absolute z-50 mt-1 min-w-36 rounded-xl border border-[var(--va-border,rgba(255,255,255,0.1))] bg-[var(--va-surface-raised,#111827)] p-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.to} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => transition(option.to)}
                disabled={busy}
                className="w-full rounded-lg px-3 py-1.5 text-right text-sm text-gray-200 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="absolute mt-1 whitespace-nowrap rounded-lg bg-red-500/15 px-2 py-1 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
