/**
 * RightsPanel — compact rights/license management panel for DetailPage.
 *
 * Displays and edits the RightsRecord for a single archive item.
 * Only renders in cloud mode (postgres / pocketbase / firebase backends).
 * Uses design tokens exclusively — no hardcoded hex colors.
 * CSS Logical Properties throughout for RTL safety.
 *
 * @param {{ itemId: string, baseUrl?: string, getToken?: () => string }} props
 */
import * as React from "react";
import { BadgeV2 } from "../../components/ui/BadgeV2.jsx";
import { fetchItemRights, saveItemRights } from "./rightsClient.js";
import { getBackendChoice, resolveBackendChoice } from "../../bootstrap/backendChoice.js";
import { getCloudToken } from "../../bootstrap/cloudSession.js";

/* ── helpers ─────────────────────────────────────────────────────── */

/** True if date string is in the past (or today) relative to now. */
function isExpired(dateStr: any) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

/** True if today falls within [embargoStart, embargoEnd]. */
function isUnderEmbargo(start: any, end: any) {
  if (!start && !end) return false;
  const now = new Date();
  const from = start ? new Date(start) : null;
  const to = end ? new Date(end) : null;
  if (from && now < from) return false;
  if (to && now > to) return false;
  return Boolean(from || to);
}

/** True if date string is within `days` days from now. */
function isExpiringWithin(dateStr: any, days: any = 30) {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return target > now && target <= cutoff;
}

/* ── license type config ─────────────────────────────────────────── */

const LICENSE_OPTIONS = [
  { value: "OWNED",        label: "مملوك",         badge: "success" },
  { value: "LICENSED",     label: "مرخّص",         badge: "warning" },
  { value: "PUBLIC_DOMAIN", label: "ملك عام",      badge: "info"    },
  { value: "FAIR_USE",     label: "استخدام عادل", badge: "info"    },
  { value: "UNKNOWN",      label: "غير معروف",     badge: "default" },
];

function licenseConfig(type: any) {
  return LICENSE_OPTIONS.find((o: any) => o.value === type) ?? LICENSE_OPTIONS[LICENSE_OPTIONS.length - 1];
}

/* ── small presentational sub-components ────────────────────────── */

function FieldLabel({ htmlFor, children }: any) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-medium text-[var(--va-text-muted)]"
    >
      {children}
    </label>
  );
}

function TextInput({ id, value, onChange, placeholder = "", dir = "rtl" }: any) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      className="mt-1 block w-full rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action)] focus:ring-1 focus:ring-[var(--va-action)]"
    />
  );
}

function DateInput({ id, value, onChange, label }: any) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        dir="ltr"
        className="mt-1 block w-full rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action)] focus:ring-1 focus:ring-[var(--va-action)]"
      />
    </div>
  );
}

/* ── main component ──────────────────────────────────────────────── */

export function RightsPanel({ itemId, baseUrl, getToken }: any) {
  const backend = getBackendChoice();
  if (backend === "local") return null;

  return <RightsPanelInner itemId={itemId} baseUrl={baseUrl} getToken={getToken} />;
}

function RightsPanelInner({ itemId, baseUrl, getToken }: any) {
  const resolvedBase  = baseUrl  ?? resolveBackendChoice().url ?? "";
  const resolvedToken = getToken ?? getCloudToken;

  const [loading, setLoading]   = React.useState(true);
  const [saving,  setSaving]    = React.useState(false);
  const [error,   setError]     = React.useState("");
  const [success, setSuccess]   = React.useState("");
  const [recordId, setRecordId] = React.useState(null);

  // Form fields
  const [rightsHolder,    setRightsHolder]    = React.useState("");
  const [licenseType,     setLicenseType]     = React.useState("UNKNOWN");
  const [embargoStart,    setEmbargoStart]    = React.useState("");
  const [embargoEnd,      setEmbargoEnd]      = React.useState("");
  const [expiresAt,       setExpiresAt]       = React.useState("");
  const [geoRestrictions, setGeoRestrictions] = React.useState("");
  const [notes,           setNotes]           = React.useState("");

  /* load ─────────────────────────────────────────────────────────── */

  React.useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchItemRights({ base: resolvedBase, getToken: resolvedToken, itemId, fetchImpl: undefined })
      .then((data: any) => {
        if (cancelled) return;
        const r = data?.record;
        if (r) {
          setRecordId(r.id ?? null);
          setRightsHolder(r.rightsHolder  ?? "");
          setLicenseType( r.licenseType   ?? "UNKNOWN");
          setEmbargoStart(r.embargoStart  ?? "");
          setEmbargoEnd(  r.embargoEnd    ?? "");
          setExpiresAt(   r.expiresAt     ?? "");
          setGeoRestrictions(
            Array.isArray(r.geoRestrictions) ? r.geoRestrictions.join(", ") : ""
          );
          setNotes(r.notes ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setError("تعذّر تحميل بيانات الحقوق");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [itemId, resolvedBase]);

  /* save ─────────────────────────────────────────────────────────── */

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const geoArray = geoRestrictions
        .split(",")
        .map((s: any) => s.trim().toUpperCase())
        .filter(Boolean);
      const payload = {
        itemId,
        rightsHolder,
        licenseType,
        embargoStart: embargoStart || null,
        embargoEnd:   embargoEnd   || null,
        expiresAt:    expiresAt    || null,
        geoRestrictions: geoArray,
        notes: notes.slice(0, 500),
      };
      const result = await saveItemRights({
        base:     resolvedBase,
        getToken: resolvedToken,
        payload,
        fetchImpl: undefined,
      });
      if (result?.record?.id) setRecordId(result.record.id);
      setSuccess("تم حفظ بيانات الحقوق");
    } catch {
      setError("تعذّر حفظ بيانات الحقوق");
    } finally {
      setSaving(false);
    }
  };

  /* derived status flags ──────────────────────────────────────────── */

  const expired      = isExpired(expiresAt);
  const underEmbargo = isUnderEmbargo(embargoStart, embargoEnd);
  const nearExpiry   = !expired && isExpiringWithin(expiresAt, 30);
  const cfg          = licenseConfig(licenseType);

  /* render ────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <section
        className="rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-5"
        aria-label="لوحة الحقوق"
        dir="rtl"
      >
        <p className="text-sm text-[var(--va-text-muted)]">جاري تحميل بيانات الحقوق…</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-5 text-right"
      aria-label="لوحة الحقوق"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[var(--va-text)]">الحقوق والترخيص</h2>
          <BadgeV2 variant={cfg.badge as any}>{cfg.label}</BadgeV2>
        </div>

        {/* Status warnings */}
        <div className="flex flex-wrap gap-2">
          {expired && (
            <span
              role="alert"
              className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--va-status-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--va-status-danger)_10%,transparent)] px-2.5 py-0.5 text-xs text-[var(--va-status-danger)]"
            >
              ⚠ الحقوق منتهية
            </span>
          )}
          {underEmbargo && (
            <span
              role="status"
              className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--va-status-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--va-status-warning)_10%,transparent)] px-2.5 py-0.5 text-xs text-[var(--va-status-warning)]"
            >
              🔒 تحت الحجب
            </span>
          )}
          {nearExpiry && !expired && (
            <BadgeV2 variant="warning">تنتهي قريباً</BadgeV2>
          )}
        </div>
      </div>

      {/* Fields grid */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Rights Holder */}
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="rights-holder">صاحب الحق / الجهة المانحة</FieldLabel>
          <TextInput
            id="rights-holder"
            value={rightsHolder}
            onChange={setRightsHolder}
            placeholder="اسم الجهة أو الشخص صاحب الحق"
          />
        </div>

        {/* License Type */}
        <div>
          <FieldLabel htmlFor="license-type">نوع الترخيص</FieldLabel>
          <select
            id="license-type"
            value={licenseType}
            onChange={(e: any) => setLicenseType(e.target.value)}
            aria-label="نوع الترخيص"
            className="mt-1 block w-full rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action)] focus:ring-1 focus:ring-[var(--va-action)]"
          >
            {LICENSE_OPTIONS.map((opt: any) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Expiry Date */}
        <div>
          <FieldLabel htmlFor="expires-at">تاريخ انتهاء الحق</FieldLabel>
          <input
            id="expires-at"
            type="date"
            value={expiresAt}
            onChange={(e: any) => setExpiresAt(e.target.value)}
            dir="ltr"
            aria-label="تاريخ الانتهاء"
            className="mt-1 block w-full rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action)] focus:ring-1 focus:ring-[var(--va-action)]"
          />
        </div>

        {/* Embargo Start */}
        <DateInput
          id="embargo-start"
          value={embargoStart}
          onChange={setEmbargoStart}
          label="بداية الحجب (اختياري)"
        />

        {/* Embargo End */}
        <DateInput
          id="embargo-end"
          value={embargoEnd}
          onChange={setEmbargoEnd}
          label="نهاية الحجب (اختياري)"
        />

        {/* Embargo summary row */}
        {(embargoStart || embargoEnd) && (
          <div className="sm:col-span-2">
            <p className="text-xs text-[var(--va-text-muted)]">
              {"الحجب: "}
              <span dir="ltr" className="font-mono">
                {embargoStart || "—"} → {embargoEnd || "—"}
              </span>
            </p>
          </div>
        )}

        {/* Geo Restrictions */}
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="geo-restrictions">الدول المقيدة (رموز ISO مفصولة بفواصل)</FieldLabel>
          <TextInput
            id="geo-restrictions"
            value={geoRestrictions}
            onChange={setGeoRestrictions}
            placeholder="مثال: SA, AE, KW"
            dir="ltr"
          />
        </div>

        {/* Notes */}
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="rights-notes">ملاحظات</FieldLabel>
          <textarea
            id="rights-notes"
            value={notes}
            onChange={(e: any) => setNotes(e.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            aria-label="ملاحظات"
            placeholder="ملاحظات إضافية حول الحقوق أو الترخيص…"
            className="mt-1 block w-full rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2 text-sm text-[var(--va-text)] outline-none focus:border-[var(--va-action)] focus:ring-1 focus:ring-[var(--va-action)]"
          />
          <p className="mt-1 text-right text-[11px] text-[var(--va-text-muted)]">
            {notes.length} / 500
          </p>
        </div>
      </div>

      {/* Feedback messages */}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--va-status-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--va-status-danger)_10%,transparent)] px-3 py-2 text-sm text-[var(--va-status-danger)]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-3 rounded-lg border border-[color-mix(in_srgb,var(--va-status-success)_28%,transparent)] bg-[color-mix(in_srgb,var(--va-status-success)_10%,transparent)] px-3 py-2 text-sm text-[var(--va-status-success)]">
          {success}
        </p>
      )}

      {/* Save button */}
      <div className="mt-4 flex justify-start">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          aria-label="حفظ بيانات الحقوق"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--va-btn-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--va-btn-primary-text)] transition-colors hover:bg-[var(--va-btn-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "جاري الحفظ…" : "حفظ الحقوق"}
        </button>
      </div>

      {/* Record ID (debug aid, visually muted) */}
      {recordId && (
        <p dir="ltr" className="mt-3 truncate text-left font-mono text-[10px] text-[var(--va-text-muted)]">
          id: {recordId}
        </p>
      )}
    </section>
  );
}

RightsPanel.displayName = "RightsPanel";
