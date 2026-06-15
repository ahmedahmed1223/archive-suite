import { createSyncPolicy } from "../../features/sync/selectiveSyncPolicy.js";

const MODES = [
  { value: "all", label: "مزامنة كل العناصر" },
  { value: "selective", label: "مزامنة انتقائية" },
];

const BANDWIDTHS = [
  { value: "unlimited", label: "بلا حدود" },
  { value: "wifi-only", label: "WiFi فقط" },
  { value: "metered", label: "بيانات الجوال مسموحة" },
];

const CACHE_POLICIES = [
  { value: "full", label: "تخزين كامل" },
  { value: "metadata", label: "بيانات وصفية فقط" },
  { value: "recent", label: "الأحدث فقط" },
];

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function Select({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function BandwidthSettings({ policy, onChange }) {
  const safe = createSyncPolicy(policy);

  function update(patch) {
    onChange(createSyncPolicy({ ...safe, ...patch }));
  }

  return (
    <div className="flex flex-col gap-4 p-4 rounded-lg border border-gray-200 bg-white" dir="rtl">
      <Field label="وضع المزامنة">
        <Select
          value={safe.mode}
          options={MODES}
          onChange={(mode) => update({ mode })}
        />
      </Field>

      <Field label="استخدام البيانات">
        <Select
          value={safe.bandwidth}
          options={BANDWIDTHS}
          onChange={(bandwidth) => update({ bandwidth })}
        />
      </Field>

      <Field label="سياسة التخزين المؤقت">
        <Select
          value={safe.cachePolicy}
          options={CACHE_POLICIES}
          onChange={(cachePolicy) => update({ cachePolicy })}
        />
      </Field>

      {safe.cachePolicy === "recent" && (
        <Field label="عدد الأيام">
          <input
            type="number"
            min={1}
            max={3650}
            value={safe.recentDays}
            onChange={(e) => update({ recentDays: Number(e.target.value) })}
            className="w-24 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </Field>
      )}
    </div>
  );
}
