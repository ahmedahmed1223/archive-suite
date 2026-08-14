"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createArchiveApiClient } from "@/lib/archive-api";
import type { ScheduledUpload, ScheduledUploadStatus } from "@/lib/archive-api";
import { scheduleSummary, validateScheduleTime } from "@/lib/scheduled-upload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const STATUS_BADGE_CLASS: Record<ScheduledUploadStatus, string> = {
  scheduled: "badge",
  claimed: "badge badge-info",
  processing: "badge badge-info",
  completed: "badge badge-success",
  cancelled: "badge",
  failed: "badge badge-danger"
};

type StatusTab = "all" | "scheduled" | "processing" | "completed" | "failed" | "cancelled";

const TAB_VALUES: readonly StatusTab[] = ["all", "scheduled", "processing", "completed", "failed", "cancelled"];

function matchesTab(status: ScheduledUploadStatus, tab: StatusTab): boolean {
  if (tab === "all") return true;
  if (tab === "processing") return status === "processing" || status === "claimed";
  return status === tab;
}

// Use a short initial poll interval, then back off while the schedule is idle.
const POLL_BASE_MS = 10_000;
const POLL_MAX_MS = 60_000;
const FETCH_LIMIT = 200;

export default function ScheduledUploadsClient() {
  const { locale, t } = useLocale();
  const tc = t.pages.scheduledUploadsClient;
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
    const validation = validateScheduleTime(rescheduleValue, rescheduleTarget.timeZone, new Date(), locale);
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
  }, [api, locale, rescheduleTarget, rescheduleValue, load]);

  if (schedules === null && !error) {
    return <p className="helper-text">{tc.loadingText}</p>;
  }

  if (error && schedules === null) {
    return <p className="state-banner state-banner-error">{error}</p>;
  }

  return (
    <div className="stack scheduled-uploads">
      <Tabs value={tab} onValueChange={(value) => setTab(value as StatusTab)}>
        <TabsList aria-label={tc.tabsAriaLabel}>
          {TAB_VALUES.map((value) => (
            <TabsTrigger key={value} value={value} onClick={() => setTab(value)}>
              {tc.tabLabels[value]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab}>
          <div className="scheduled-uploads-search">
            <span id="scheduled-uploads-search-label">{tc.searchLabel}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={tc.searchLabel}
            />
          </div>

          {error ? <p className="state-banner state-banner-error">{error}</p> : null}

          {filtered.length === 0 ? (
            <p className="helper-text">{tc.emptyText}</p>
          ) : (
            <ul className="scheduled-uploads-list">
              {filtered.map((item) => (
                <li key={item.id} className="scheduled-upload-row">
                  <div className="scheduled-upload-row__main">
                    <span className="scheduled-upload-row__name">{item.fileName}</span>
                    <span className={STATUS_BADGE_CLASS[item.status]}>{tc.statusLabels[item.status]}</span>
                    {item.scheduledAt ? (
                      <span className="helper-text">{scheduleSummary(item.scheduledAt, item.timeZone, locale === "en" ? "en-US" : "ar-SA")}</span>
                    ) : null}
                    {item.failureMessage ? <span className="helper-text">{item.failureMessage}</span> : null}
                  </div>
                  <div className="scheduled-upload-row__actions">
                    {item.status === "completed" && item.recordId ? (
                      <a className="button button-secondary" href={`/archive/${item.recordId}`}>
                        {tc.openRecordButton}
                      </a>
                    ) : null}
                    {item.canReschedule ? (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => openReschedule(item)}
                        disabled={busyId === item.id}
                      >
                        {tc.rescheduleButton}
                      </button>
                    ) : null}
                    {item.canCancel ? (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setCancelTarget(item)}
                        disabled={busyId === item.id}
                      >
                        {tc.cancelButton}
                      </button>
                    ) : null}
                    {item.canRetry ? (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => handleRetry(item)}
                        disabled={busyId === item.id}
                      >
                        {tc.retryButton}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {cancelTarget ? (
        <section
          className="panel scheduled-upload-dialog"
          role="alertdialog"
          aria-labelledby="cancel-schedule-title"
          aria-describedby="cancel-schedule-desc"
        >
          <h2 id="cancel-schedule-title">{tc.cancelDialogTitle}</h2>
          <p id="cancel-schedule-desc">
            {tc.cancelDialogDescription.replace("{fileName}", cancelTarget.fileName)}
          </p>
          <div className="panel-actions">
            <button type="button" className="button button-secondary" onClick={() => setCancelTarget(null)}>
              {tc.dialogDismiss}
            </button>
            <button type="button" className="button button-danger" onClick={handleCancelConfirm}>
              {tc.confirmCancelButton}
            </button>
          </div>
        </section>
      ) : null}

      {rescheduleTarget ? (
        <section className="panel scheduled-upload-dialog" aria-labelledby="reschedule-title">
          <h2 id="reschedule-title">{tc.rescheduleDialogTitle}</h2>
          <div className="scheduled-uploads-search">
            <span id="reschedule-input-label">{tc.rescheduleInputLabel}</span>
            <input
              type="datetime-local"
              value={rescheduleValue}
              onChange={(event) => setRescheduleValue(event.target.value)}
              aria-label={tc.rescheduleInputLabel}
            />
          </div>
          {rescheduleError ? <p className="state-banner state-banner-error">{rescheduleError}</p> : null}
          <div className="panel-actions">
            <button type="button" className="button button-secondary" onClick={() => setRescheduleTarget(null)}>
              {tc.cancelButton}
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={handleRescheduleSubmit}
              disabled={busyId === rescheduleTarget.id}
            >
              {tc.saveRescheduleButton}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
