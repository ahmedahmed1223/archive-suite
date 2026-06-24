/**
 * BatchFixToolbar — inline bulk-edit bar shown above archive results when
 * one or more items are selected (bulk mode active).
 *
 * Provides quick-fix dropdowns for الحالة (status), النوع (type), and الفرع
 * (branch/department). Dispatches per-item updates via the updateItem action
 * and shows a toast on completion.
 */
import { Check, X } from "lucide-react";
import * as React from "react";

import { WORKFLOW_STATES, STATE_META } from "./itemStatus.js";

/** @param {{ label: string, value: string, onChange: (v: string) => void, options: Array<{value: string, label: string}>, placeholder: string }} */
function FixDropdown({ label, value, onChange, options, placeholder }) {
  const id = React.useId();
  return (
    <label htmlFor={id} className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className="shrink-0">{label}:</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[7rem] rounded-lg border border-white/10 bg-[#0b1626]/80 px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--va-action)]/40"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * BatchFixToolbar
 *
 * @param {{
 *   selectedItems: string[],
 *   videoItems: Array<{id: string}>,
 *   contentTypes: Array<{id: string, name: string}>,
 *   updateVideoItem: (item: object) => Promise<void>,
 *   showToast: (msg: string, variant?: string) => void,
 *   onClear: () => void,
 * }} props
 */
export function BatchFixToolbar({
  selectedItems = [],
  videoItems = [],
  contentTypes = [],
  updateVideoItem,
  showToast,
  onClear,
}) {
  const [batchStatus, setBatchStatus] = React.useState("");
  const [batchType, setBatchType] = React.useState("");
  const [batchBranch, setBatchBranch] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const count = selectedItems.length;
  if (count === 0) return null;

  const statusOptions = WORKFLOW_STATES.map((s) => ({
    value: s,
    label: STATE_META[s]?.label || s,
  }));

  const typeOptions = contentTypes.map((ct) => ({
    value: ct.id,
    label: ct.name,
  }));

  // Branch options are derived from whatever branches exist in the current
  // items. Falls back to an empty list when no branch field is present.
  const branchOptions = React.useMemo(() => {
    const seen = new Set();
    const opts = [];
    for (const item of videoItems) {
      const branch = item.branch || item.metadata?.branch || "";
      if (branch && !seen.has(branch)) {
        seen.add(branch);
        opts.push({ value: branch, label: branch });
      }
    }
    return opts;
  }, [videoItems]);

  const hasAnyChange = batchStatus || batchType || batchBranch;

  const handleApply = async () => {
    if (!hasAnyChange || busy) return;

    const patch = {};
    if (batchStatus) patch.workflowStatus = batchStatus;
    if (batchType) { patch.type = batchType; patch.subtype = ""; }
    if (batchBranch) patch.branch = batchBranch;

    const selected = videoItems.filter((item) => selectedItems.includes(item.id));
    if (!selected.length) return;

    setBusy(true);
    try {
      await Promise.all(
        selected.map((item) =>
          updateVideoItem?.({ ...item, ...patch, version: (item.version || 1) + 1 })
        )
      );
      showToast?.(`تم تحديث ${selected.length} عنصر`, "success");
      // reset dropdowns after apply
      setBatchStatus("");
      setBatchType("");
      setBatchBranch("");
    } catch (err) {
      showToast?.(err?.message || "تعذر تطبيق التعديلات", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="تحرير العناصر المحددة"
      dir="rtl"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--va-action)_35%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_8%,transparent)] px-4 py-2.5 text-sm"
      data-testid="batch-fix-toolbar"
    >
      {/* Selection count badge */}
      <span className="shrink-0 rounded-full border border-[color-mix(in_srgb,var(--va-action)_40%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_20%,transparent)] px-3 py-0.5 text-xs font-semibold text-white">
        تحرير المحدد ({count})
      </span>

      <div className="flex flex-wrap items-center gap-3">
        <FixDropdown
          label="الحالة"
          value={batchStatus}
          onChange={setBatchStatus}
          options={statusOptions}
          placeholder="— لا تغيير —"
        />
        <FixDropdown
          label="النوع"
          value={batchType}
          onChange={setBatchType}
          options={typeOptions}
          placeholder="— لا تغيير —"
        />
        {branchOptions.length > 0 && (
          <FixDropdown
            label="الفرع"
            value={batchBranch}
            onChange={setBatchBranch}
            options={branchOptions}
            placeholder="— لا تغيير —"
          />
        )}
      </div>

      {/* Apply */}
      <button
        type="button"
        onClick={handleApply}
        disabled={!hasAnyChange || busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--va-action)_60%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_25%,transparent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[color-mix(in_srgb,var(--va-action)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="تطبيق التعديلات على العناصر المحددة"
      >
        <Check className="h-3.5 w-3.5" />
        {busy ? "جارٍ التطبيق…" : "تطبيق"}
      </button>

      {/* Dismiss */}
      <button
        type="button"
        onClick={onClear}
        aria-label="إغلاق شريط التحرير"
        className="ms-auto rounded-lg p-1 text-gray-500 hover:bg-white/5 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default BatchFixToolbar;
