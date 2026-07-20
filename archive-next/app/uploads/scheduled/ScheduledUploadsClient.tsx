"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createArchiveApiClient } from "@/lib/archive-api";
import type { ScheduledUpload, ScheduledUploadStatus } from "@/lib/archive-api";
import { scheduleSummary, validateScheduleTime } from "@/lib/scheduled-upload";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";

const STATUS_LABELS: Record<ScheduledUploadStatus, string> = {
  scheduled: "مجدولة",
  claimed: "قيد المعالجة",
  processing: "قيد المعالجة",
  completed: "مكتملة",
  cancelled: "ملغاة",
  failed: "فشلت"
};

const STATUS_BADGE_CLASS: Record<ScheduledUploadStatus, string> = {
  scheduled: "badge",
  claimed: "badge badge-info",
  processing: "badge badge-info",
  completed: "badge badge-success",
  cancelled: "badge",
  failed: "badge badge-danger"
};

type StatusTab = "all" | "scheduled" | "processing" | "completed" | "failed" | "cancelled";

const TABS: ReadonlyArray<{ value: StatusTab; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "scheduled", label: "مجدولة" },
  { value: "processing", label: "قيد المعالجة" },
  { value: "completed", label: "مكتملة" },
  { value: "failed", label: "فشلت" },
  { value: "cancelled", label: "ملغاة" }
];

function matchesTab(status: ScheduledUploadStatus, tab: StatusTab): boolean {
  if (tab === "all") return true;
  if (tab === "processing") return status === "processing" || status === "claimed";
  return status === tab;
}

// ponytail: 10s/60s poll backoff is the plan's spec, not a guessed value — see docs/agents/v1-712-scheduled-upload-implementation.md Task 7.
const POLL_BASE_MS = 10_000;
const POLL_MAX_MS = 60_000;
const FETCH_LIMIT = 200;

export default function ScheduledUploadsClient() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [schedules, setSchedules] = useState<ScheduledUpload[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ScheduledUpload | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledUpload | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const pollDelayRef = useRef(POLL_BASE_MS);

  const load = useCallback(async () => {
    const response = await api.scheduledUploads({ limit: FETCH_LIMIT });
    if (!response.ok) {
      setError(response.error);
      pollDelayRef.current = Math.min(pollDelayRef.current * 2, POLL_MAX_MS);
      return;
    }
    setError(null);
    setSchedules(response.schedules);
    pollDelayRef.current = POLL_BASE_MS;
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!document.hidden) {
        await load();
      }
      if (!cancelled) {
        timer = setTimeout(tick, pollDelayRef.current);
      }
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load]);

  const filtered = useMemo(() => {
    if (!schedules) return [];
    const query = search.trim().toLowerCase();
    return schedules.filter((item) => {
      if (!matchesTab(item.status, tab)) return false;
      if (!query) return true;
      return item.fileName.toLowerCase().includes(query) || (item.title ?? "").toLowerCase().includes(query);
    });
  }, [schedules, tab, search]);

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelTarget) return;
    setBusyId(cancelTarget.id);
    const response = await api.cancelScheduledUpload(cancelTarget.id);
    setBusyId(null);
    setCancelTarget(null);
    if (response.ok) {
      setSchedules((prev) => prev?.map((item) => (item.id === response.schedule.id ? response.schedule : item)) ?? prev);
    } else {
      setError(response.error);
    }
  }, [api, cancelTarget]);

  const handleRetry = useCallback(
    async (item: ScheduledUpload) => {
      setBusyId(item.id);
      const response = await api.retryScheduledUpload(item.id);
      setBusyId(null);
      if (response.ok) {
        setSchedules((prev) => prev?.map((row) => (row.id === response.schedule.id ? response.schedule : row)) ?? prev);
      } else {
        setError(response.error);
      }
    },
    [api]
  );

  const openReschedule = useCallback((item: ScheduledUpload) => {
    setRescheduleTarget(item);
    setRescheduleError(null);
    setRescheduleValue(item.scheduledAt ? item.scheduledAt.slice(0, 16) : "");
  }, []);

  const handleRescheduleSubmit = useCallback(async () => {
    if (!rescheduleTarget) return;
    const validation = validateScheduleTime(rescheduleValue, rescheduleTarget.timeZone, new Date());
    if (!validation.valid) {
      setRescheduleError(validation.message);
      return;
    }
    setBusyId(rescheduleTarget.id);
    const response = await api.rescheduleScheduledUpload(rescheduleTarget.id, {
      scheduledAt: validation.utc,
      timeZone: rescheduleTarget.timeZone,
      version: rescheduleTarget.version
    });
    setBusyId(null);
    if (response.ok) {
      setSchedules((prev) => prev?.map((row) => (row.id === response.schedule.id ? response.schedule : row)) ?? prev);
      setRescheduleTarget(null);
    } else {
      setRescheduleError(response.error);
      await load();
    }
  }, [api, rescheduleTarget, rescheduleValue, load]);

  if (schedules === null && !error) {
    return <p className="helper-text">جارٍ التحميل…</p>;
  }

  if (error && schedules === null) {
    return <p className="state-banner state-banner-error">{error}</p>;
  }

  return (
    <div className="stack scheduled-uploads">
      <Tabs value={tab} onValueChange={(value) => setTab(value as StatusTab)}>
        <TabsList aria-label="تصفية حسب الحالة">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} onClick={() => setTab(item.value)}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="scheduled-uploads-search">
        <span id="scheduled-uploads-search-label">بحث بالملف أو العنوان</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="بحث بالملف أو العنوان"
        />
      </div>

      {error ? <p className="state-banner state-banner-error">{error}</p> : null}

      {filtered.length === 0 ? (
        <p className="helper-text">لا توجد رفعات مجدولة تطابق الفلترة الحالية.</p>
      ) : (
        <ul className="scheduled-uploads-list">
          {filtered.map((item) => (
            <li key={item.id} className="scheduled-upload-row">
              <div className="scheduled-upload-row__main">
                <span className="scheduled-upload-row__name">{item.fileName}</span>
                <span className={STATUS_BADGE_CLASS[item.status]}>{STATUS_LABELS[item.status]}</span>
                {item.scheduledAt ? (
                  <span className="helper-text">{scheduleSummary(item.scheduledAt, item.timeZone, "ar")}</span>
                ) : null}
                {item.failureMessage ? <span className="helper-text">{item.failureMessage}</span> : null}
              </div>
              <div className="scheduled-upload-row__actions">
                {item.status === "completed" && item.recordId ? (
                  <a className="button button-secondary" href={`/archive/${item.recordId}`}>
                    فتح السجل
                  </a>
                ) : null}
                {item.canReschedule ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => openReschedule(item)}
                    disabled={busyId === item.id}
                  >
                    إعادة الجدولة
                  </button>
                ) : null}
                {item.canCancel ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setCancelTarget(item)}
                    disabled={busyId === item.id}
                  >
                    إلغاء
                  </button>
                ) : null}
                {item.canRetry ? (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => handleRetry(item)}
                    disabled={busyId === item.id}
                  >
                    إعادة المحاولة
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {cancelTarget ? (
        <section
          className="panel scheduled-upload-dialog"
          role="alertdialog"
          aria-labelledby="cancel-schedule-title"
          aria-describedby="cancel-schedule-desc"
        >
          <h2 id="cancel-schedule-title">إلغاء الرفع المجدول</h2>
          <p id="cancel-schedule-desc">
            سيُلغى جدول رفع &quot;{cancelTarget.fileName}&quot; ولن تتم معالجته. يمكن الاحتفاظ بالملف الأصلي مؤقتاً بحسب سياسة الاستبقاء.
          </p>
          <div className="panel-actions">
            <button type="button" className="button button-secondary" onClick={() => setCancelTarget(null)}>
              تراجع
            </button>
            <button type="button" className="button button-danger" onClick={handleCancelConfirm}>
              إلغاء الجدولة
            </button>
          </div>
        </section>
      ) : null}

      {rescheduleTarget ? (
        <section className="panel scheduled-upload-dialog" aria-labelledby="reschedule-title">
          <h2 id="reschedule-title">إعادة جدولة الرفع</h2>
          <div className="scheduled-uploads-search">
            <span id="reschedule-input-label">موعد المعالجة الجديد</span>
            <input
              type="datetime-local"
              value={rescheduleValue}
              onChange={(event) => setRescheduleValue(event.target.value)}
              aria-label="موعد المعالجة الجديد"
            />
          </div>
          {rescheduleError ? <p className="state-banner state-banner-error">{rescheduleError}</p> : null}
          <div className="panel-actions">
            <button type="button" className="button button-secondary" onClick={() => setRescheduleTarget(null)}>
              إلغاء
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleRescheduleSubmit}
              disabled={busyId === rescheduleTarget.id}
            >
              حفظ الموعد الجديد
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
