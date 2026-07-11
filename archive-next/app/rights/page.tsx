"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import {
  createArchiveApiClient,
  type RightsRecord,
  type RightsEnforcementStatus
} from "@/lib/archive-api";

type RightsState =
  | { status: "loading" }
  | { status: "ready"; records: RightsRecord[] }
  | { status: "error"; message: string };

type EnforcementState =
  | { status: "loading" }
  | { status: "ready"; enforcement: RightsEnforcementStatus }
  | { status: "error"; message: string };

type UpsertState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; itemId: string }
  | { status: "error"; message: string };

type LicenseType = RightsRecord["licenseType"];

const WARNING_WINDOW_DAYS = 30;
const DAY_MS = 86400000;

const daysOptions: Array<DataViewOption<string>> = [
  { value: "30", label: "30 يوم" },
  { value: "90", label: "90 يوم" },
  { value: "365", label: "سنة" }
];

const licenseLabels: Record<LicenseType, string> = {
  OWNED: "مملوك",
  LICENSED: "مرخّص",
  PUBLIC_DOMAIN: "ملكية عامة",
  FAIR_USE: "استخدام عادل",
  UNKNOWN: "غير معروف"
};

function formatDate(value?: string | null) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
}

function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / DAY_MS);
}

export default function RightsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<RightsState>({ status: "loading" });
  const [days, setDays] = useState("365");
  const [enforcementByItem, setEnforcementByItem] = useState<Record<string, EnforcementState>>({});
  const [upsertState, setUpsertState] = useState<UpsertState>({ status: "idle" });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formItemId, setFormItemId] = useState("");
  const [formHolder, setFormHolder] = useState("");
  const [formLicense, setFormLicense] = useState<LicenseType>("OWNED");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const loadRights = useCallback(async (windowDays: string) => {
    setState({ status: "loading" });
    setEnforcementByItem({});
    try {
      const response = await api.expiringRights({ days: Number(windowDays) });
      if (response.ok) {
        setState({ status: "ready", records: response.records });
      } else {
        setState({ status: "error", message: response.error || "تعذر تحميل سجلات الحقوق." });
      }
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل سجلات الحقوق." });
    }
  }, [api]);

  useEffect(() => {
    void loadRights(days);
  }, [loadRights, days]);

  const records = state.status === "ready" ? state.records : [];
  const expiringSoonCount = records.filter((record) => {
    const remaining = daysUntil(record.expiresAt);
    return remaining !== null && remaining <= WARNING_WINDOW_DAYS;
  }).length;
  const hasBlockedRights = Object.values(enforcementByItem).some(
    (item) => item.status === "ready" && !item.enforcement.allowed
  );

  const checkEnforcement = async (itemId: string) => {
    setEnforcementByItem((current) => ({ ...current, [itemId]: { status: "loading" } }));
    try {
      const response = await api.rightsEnforcement(itemId);
      if (response.ok) {
        setEnforcementByItem((current) => ({
          ...current,
          [itemId]: { status: "ready", enforcement: response }
        }));
      } else {
        setEnforcementByItem((current) => ({
          ...current,
          [itemId]: { status: "error", message: response.error || "تعذر فحص الإنفاذ." }
        }));
      }
    } catch (error) {
      setEnforcementByItem((current) => ({
        ...current,
        [itemId]: { status: "error", message: error instanceof Error ? error.message : "تعذر فحص الإنفاذ." }
      }));
    }
  };

  const handleUpsert = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const itemId = formItemId.trim();
    const rightsHolder = formHolder.trim();
    if (!itemId || !rightsHolder) {
      setUpsertState({ status: "error", message: "معرّف العنصر وصاحب الحقوق حقلان إلزاميان." });
      return;
    }

    setUpsertState({ status: "saving" });
    try {
      const response = await api.upsertRights({
        itemId,
        rightsHolder,
        licenseType: formLicense,
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
        notes: formNotes.trim() || null
      });
      if (response.ok) {
        setUpsertState({ status: "success", itemId });
        setFormItemId("");
        setFormHolder("");
        setFormExpiresAt("");
        setFormNotes("");
        await loadRights(days);
      } else {
        setUpsertState({ status: "error", message: response.error || "تعذر حفظ سجل الحقوق." });
      }
    } catch (error) {
      setUpsertState({ status: "error", message: error instanceof Error ? error.message : "تعذر حفظ سجل الحقوق." });
    }
  };

  const renderEnforcement = (itemId: string) => {
    const enforcementState = enforcementByItem[itemId];
    if (!enforcementState) {
      return (
        <button type="button" className="button button-secondary button-sm" onClick={() => void checkEnforcement(itemId)}>
          فحص الإنفاذ
        </button>
      );
    }

    if (enforcementState.status === "loading") {
      return <span className="helper-text">جار الفحص...</span>;
    }

    if (enforcementState.status === "error") {
      return <span className="helper-text">{enforcementState.message}</span>;
    }

    const { enforcement } = enforcementState;
    return (
      <div className="record-meta">
        <span className={`badge ${enforcement.allowed ? "" : "badge-danger"}`}>
          {enforcement.allowed ? "مسموح" : "محظور"}
        </span>
        {enforcement.reason ? <span className="helper-text">{enforcement.reason}</span> : null}
        {(enforcement.warnings || []).map((warning) => (
          <span key={warning} className="badge badge-danger">{warning}</span>
        ))}
      </div>
    );
  };

  return (
    <AppShell subtitle="حقوق الاستخدام" navLabel="الحقوق" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">Rights Management</span>}
        title="حقوق الاستخدام والتراخيص"
        description="مراقبة سجلات الحقوق التي تقترب من الانتهاء، فحص حالة الإنفاذ لكل عنصر، وتسجيل حقوق جديدة."
        meta={(
          <>
            <span className="badge">{records.length} سجل حقوق</span>
            <span className={`badge ${expiringSoonCount > 0 ? "badge-danger" : ""}`}>
              {expiringSoonCount} ينتهي خلال {WARNING_WINDOW_DAYS} يوم
            </span>
          </>
        )}
        actions={(
          <>
            <button type="button" className="button button-primary" onClick={() => setIsFormOpen((open) => !open)}>
              {isFormOpen ? "إغلاق النموذج" : "تسجيل حقوق"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => void loadRights(days)} disabled={state.status === "loading"}>
              تحديث
            </button>
          </>
        )}
      >
        <DataViewSwitcher value={days} options={daysOptions} onChange={setDays} label="نافذة الانتهاء" />
      </PageToolbar>

      <OperationalSafetyPanel
        action="نشر أو مشاركة مادة"
        rights={hasBlockedRights ? "blocked" : "allowed"}
        auditHref="/activity"
      />

      {isFormOpen ? (
        <section className="panel" aria-label="تسجيل حقوق جديدة">
          <div className="panel-title-row">
            <div>
              <h2>تسجيل / تحديث حقوق عنصر</h2>
              <p>الحفظ يستبدل سجل الحقوق الحالي لنفس معرّف العنصر إن وجد.</p>
            </div>
          </div>
          <form className="archive-toolbar-grid" onSubmit={handleUpsert}>
            <label>
              <span>معرّف العنصر *</span>
              <input type="text" dir="ltr" value={formItemId} onChange={(e) => setFormItemId(e.target.value)} required />
            </label>
            <label>
              <span>صاحب الحقوق *</span>
              <input type="text" value={formHolder} onChange={(e) => setFormHolder(e.target.value)} required />
            </label>
            <label>
              <span>نوع الترخيص</span>
              <select value={formLicense} onChange={(e) => setFormLicense(e.target.value as LicenseType)}>
                {(Object.keys(licenseLabels) as LicenseType[]).map((license) => (
                  <option key={license} value={license}>{licenseLabels[license]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>تاريخ الانتهاء</span>
              <input type="date" value={formExpiresAt} onChange={(e) => setFormExpiresAt(e.target.value)} />
            </label>
            <label>
              <span>ملاحظات</span>
              <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} maxLength={4000} />
            </label>
            <div className="archive-toolbar-actions">
              <button type="submit" className="button button-primary" disabled={upsertState.status === "saving"}>
                {upsertState.status === "saving" ? "جار الحفظ..." : "حفظ الحقوق"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {upsertState.status === "success" ? (
        <div className="state-banner state-banner-success" role="status">
          <strong>تم حفظ سجل الحقوق</strong>
          <span className="helper-text">العنصر: {upsertState.itemId}</span>
        </div>
      ) : null}

      {upsertState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر حفظ سجل الحقوق</strong>
          <span className="helper-text">{upsertState.message}</span>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جار تحميل سجلات الحقوق...</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل سجلات الحقوق</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {state.status === "ready" ? (
        records.length === 0 ? (
          <EmptyState
            title="لا سجلات حقوق ضمن هذه النافذة."
            description="وسّع نافذة الانتهاء أو سجّل حقوقًا جديدة لعناصر الأرشيف."
            actions={<button type="button" className="button button-secondary" onClick={() => setIsFormOpen(true)}>تسجيل حقوق</button>}
          />
        ) : (
          <section className="panel" aria-label="سجلات الحقوق">
            <div className="panel-title-row">
              <div>
                <h2>سجلات الحقوق ({records.length})</h2>
                <p>السجلات التي ينتهي ترخيصها خلال {daysOptions.find((option) => option.value === days)?.label}. المميز بالأحمر ينتهي خلال {WARNING_WINDOW_DAYS} يوم.</p>
              </div>
            </div>
            <div className="scroll-x">
              <table className="data-table" aria-label="سجلات الحقوق">
                <thead>
                  <tr>
                    <th>العنصر</th>
                    <th>صاحب الحقوق</th>
                    <th>الترخيص</th>
                    <th>ينتهي في</th>
                    <th>المتبقي</th>
                    <th>الإنفاذ</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const remaining = daysUntil(record.expiresAt);
                    const isExpiringSoon = remaining !== null && remaining <= WARNING_WINDOW_DAYS;
                    return (
                      <tr key={record.id}>
                        <td>
                          <a className="text-accent" href={`/archive/${encodeURIComponent(record.itemId)}`}>
                            {record.itemId}
                          </a>
                        </td>
                        <td>{record.rightsHolder}</td>
                        <td><span className="badge">{licenseLabels[record.licenseType]}</span></td>
                        <td className="text-sm">{formatDate(record.expiresAt)}</td>
                        <td>
                          {remaining === null ? (
                            <span className="helper-text">-</span>
                          ) : (
                            <span className={`badge ${isExpiringSoon ? "badge-danger" : ""}`}>
                              {remaining <= 0 ? "منتهي" : `${remaining} يوم`}
                            </span>
                          )}
                        </td>
                        <td>{renderEnforcement(record.itemId)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      ) : null}
    </AppShell>
  );
}
