"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import {
  createArchiveApiClient,
  type ArchiveRecord,
  type AutomationRule,
  type AutomationRuleAction,
  type AutomationRuleRun,
  type AutomationRuleTrigger
} from "@/lib/archive-api";
import { getRecordWorkflowStatus, recordMatches } from "@/lib/record-utils";

const triggerLabels: Record<AutomationRuleTrigger, string> = {
  "record.created": "عند إنشاء سجل",
  "record.updated": "عند تحديث سجل",
  "media.failed": "عند فشل مهمة وسائط",
  "schedule.daily": "تشغيل يومي"
};

const actionLabels: Record<AutomationRuleAction, string> = {
  "add-tag": "إضافة وسم",
  "set-review": "إرسال للمراجعة",
  "notify-admin": "تنبيه المدير",
  "create-inbox-item": "إنشاء عنصر وارد"
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ar-SA");
}

export default function AutomationPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [error, setError] = useState("");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRuleRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationRuleTrigger>("record.created");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [tag, setTag] = useState("all");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<AutomationRuleAction>("notify-admin");

  async function refreshAutomation() {
    setLoading(true);
    const response = await api.automationRules();
    if (response.ok) {
      setRules(response.rules);
      setRuns(response.runs);
      setError("");
    } else {
      setError(response.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refreshAutomation();
    void (async () => {
      const response = await api.search({ limit: 100 });
      if (response.ok) setRecords(response.records);
      else setError(response.error);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const types = useMemo(() => Array.from(new Set(records.map((record) => record.type).filter(Boolean))) as string[], [records]);
  const tags = useMemo(() => Array.from(new Set(records.flatMap((record) => record.tags || []))).sort((a, b) => a.localeCompare(b, "ar")), [records]);
  const statuses = useMemo(() => Array.from(new Set(records.map((record) => getRecordWorkflowStatus(record)))), [records]);

  async function addRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setStatusMessage("جار حفظ القاعدة...");
    const response = await api.createAutomationRule({
      name: name.trim(),
      trigger,
      query: query.trim(),
      type,
      tag,
      status,
      action,
      enabled: true
    });

    if (!response.ok) {
      setStatusMessage(response.error || "تعذر حفظ القاعدة.");
      return;
    }

    setName("");
    setQuery("");
    setType("all");
    setTag("all");
    setStatus("all");
    setAction("notify-admin");
    setStatusMessage("تم حفظ القاعدة في الخادم.");
    await refreshAutomation();
  }

  async function toggleRule(rule: AutomationRule) {
    setBusyId(rule.id);
    const response = await api.updateAutomationRule(rule.id, { enabled: !rule.enabled });
    if (!response.ok) setStatusMessage(response.error || "تعذر تحديث القاعدة.");
    else setStatusMessage(rule.enabled ? "تم إيقاف القاعدة." : "تم تفعيل القاعدة.");
    await refreshAutomation();
    setBusyId(null);
  }

  async function deleteRule(rule: AutomationRule) {
    const confirmed = window.confirm(`حذف القاعدة "${rule.name}"؟`);
    if (!confirmed) return;

    setBusyId(rule.id);
    const response = await api.deleteAutomationRule(rule.id);
    if (!response.ok) setStatusMessage(response.error || "تعذر حذف القاعدة.");
    else setStatusMessage("تم حذف القاعدة.");
    await refreshAutomation();
    setBusyId(null);
  }

  async function runRule(rule: AutomationRule, dryRun: boolean) {
    setBusyId(rule.id);
    const response = await api.runAutomationRule(rule.id, { dryRun });
    if (!response.ok) {
      setStatusMessage(response.error || "تعذر تشغيل القاعدة.");
    } else {
      setStatusMessage(`${dryRun ? "Dry-run" : "تشغيل فعلي"}: ${response.run.message || "اكتمل التشغيل."}`);
    }
    await refreshAutomation();
    setBusyId(null);
  }

  function matchingCount(rule: AutomationRule) {
    return records.filter((record) => recordMatches(record, rule)).length;
  }

  return (
    <AppShell subtitle="الأتمتة" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Rules Engine</span>}
        title="محرّك القواعد"
        description="قواعد محفوظة في الخادم مع dry-run، تشغيل فعلي محدود، وسجل تنفيذ قابل للمراجعة."
        meta={(
          <>
            <span className="badge">{rules.length} قاعدة</span>
            <span className="badge">{rules.filter((rule) => rule.enabled).length} مفعّلة</span>
            <span className="badge">{runs.length} تشغيل</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/activity">سجل النشاط</a>}
      >
        <form className="archive-toolbar-grid" onSubmit={addRule}>
          <label>
            <span>اسم القاعدة</span>
            <input className="search-input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>المشغّل</span>
            <select value={trigger} onChange={(event) => setTrigger(event.target.value as AutomationRuleTrigger)}>
              {(Object.keys(triggerLabels) as AutomationRuleTrigger[]).map((item) => <option key={item} value={item}>{triggerLabels[item]}</option>)}
            </select>
          </label>
          <label>
            <span>بحث</span>
            <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="شرط نصي اختياري" />
          </label>
          <label>
            <span>نوع</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">كل الأنواع</option>
              {types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>وسم</span>
            <select value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="all">كل الوسوم</option>
              {tags.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>حالة</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">كل الحالات</option>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>الإجراء</span>
            <select value={action} onChange={(event) => setAction(event.target.value as AutomationRuleAction)}>
              {(Object.keys(actionLabels) as AutomationRuleAction[]).map((item) => <option key={item} value={item}>{actionLabels[item]}</option>)}
            </select>
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary" disabled={!name.trim()}>حفظ القاعدة</button>
          </div>
        </form>
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
      </PageToolbar>

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل بيانات الأتمتة</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="panel panel-compact" role="status">
          <p className="form-status">جار تحميل قواعد الأتمتة...</p>
        </div>
      ) : null}

      {!loading && rules.length === 0 ? (
        <EmptyState title="لا توجد قواعد بعد." description="أنشئ قاعدة محفوظة في الخادم، ثم اختبرها بـ dry-run قبل التشغيل الفعلي." />
      ) : (
        <section className="rules-grid" aria-label="قواعد الأتمتة">
          {rules.map((rule) => (
            <article className="local-list-card" key={rule.id} data-enabled={rule.enabled ? "true" : "false"}>
              <div className="local-list-card__main">
                <div>
                  <span className="badge">{rule.enabled ? "مفعّلة" : "متوقفة"}</span>
                  <h3>{rule.name}</h3>
                </div>
                <strong className="metric-value">{matchingCount(rule)}</strong>
              </div>
              <dl className="mobile-field-list">
                <div><dt>المشغّل</dt><dd>{triggerLabels[rule.trigger]}</dd></div>
                <div><dt>الشروط</dt><dd>{[rule.query, rule.type !== "all" ? rule.type : "", rule.tag !== "all" ? rule.tag : "", rule.status !== "all" ? rule.status : ""].filter(Boolean).join(" · ") || "كل السجلات"}</dd></div>
                <div><dt>الإجراء</dt><dd>{actionLabels[rule.action]}</dd></div>
                <div><dt>آخر تشغيل</dt><dd>{formatDate(rule.lastRunAt)}</dd></div>
              </dl>
              <div className="button-row">
                <button className="button button-secondary button-sm" type="button" onClick={() => void runRule(rule, true)} disabled={busyId === rule.id}>
                  Dry-run
                </button>
                <button className="button button-primary button-sm" type="button" onClick={() => void runRule(rule, false)} disabled={busyId === rule.id || !rule.enabled}>
                  تشغيل فعلي
                </button>
                <button className="button button-secondary button-sm" type="button" onClick={() => void toggleRule(rule)} disabled={busyId === rule.id}>
                  {rule.enabled ? "إيقاف" : "تفعيل"}
                </button>
                <button className="button button-danger button-sm" type="button" onClick={() => void deleteRule(rule)} disabled={busyId === rule.id}>حذف</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {runs.length > 0 ? (
        <article className="panel">
          <div className="panel-section-header">
            <h2>سجل تشغيل الأتمتة</h2>
          </div>
          <ul className="compact-list">
            {runs.map((run) => (
              <li key={run.id}>
                <strong>{run.dryRun ? "Dry-run" : "تشغيل فعلي"} · {run.status}</strong>
                <span className="helper-text">
                  مطابق {run.matchedCount} · منفذ {run.executedCount} · {formatDate(run.createdAt)}
                </span>
                {run.message ? <span className="helper-text">{run.message}</span> : null}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </AppShell>
  );
}
