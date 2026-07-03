"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { getRecordWorkflowStatus, recordMatches } from "@/lib/record-utils";

type RuleTrigger = "record.created" | "record.updated" | "media.failed" | "schedule.daily";
type RuleAction = "add-tag" | "set-review" | "notify-admin" | "create-inbox-item";

interface AutomationRule {
  id: string;
  name: string;
  trigger: RuleTrigger;
  query: string;
  type: string;
  tag: string;
  status: string;
  action: RuleAction;
  enabled: boolean;
  createdAt: string;
}

const STORAGE_KEY = "masar:automation:v1";
const triggerLabels: Record<RuleTrigger, string> = {
  "record.created": "عند إنشاء سجل",
  "record.updated": "عند تحديث سجل",
  "media.failed": "عند فشل مهمة وسائط",
  "schedule.daily": "تشغيل يومي"
};
const actionLabels: Record<RuleAction, string> = {
  "add-tag": "إضافة وسم",
  "set-review": "إرسال للمراجعة",
  "notify-admin": "تنبيه المدير",
  "create-inbox-item": "إنشاء عنصر وارد"
};

function readRules(): AutomationRule[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRules(rules: AutomationRule[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export default function AutomationPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [error, setError] = useState("");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<RuleTrigger>("record.created");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [tag, setTag] = useState("all");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<RuleAction>("notify-admin");

  useEffect(() => {
    setRules(readRules());
    void (async () => {
      const response = await api.search({ limit: 1000 });
      if (response.ok) setRecords(response.records);
      else setError(response.error);
    })();
  }, [api]);

  const types = useMemo(() => Array.from(new Set(records.map((record) => record.type).filter(Boolean))) as string[], [records]);
  const tags = useMemo(() => Array.from(new Set(records.flatMap((record) => record.tags || []))).sort((a, b) => a.localeCompare(b, "ar")), [records]);
  const statuses = useMemo(() => Array.from(new Set(records.map((record) => getRecordWorkflowStatus(record)))), [records]);

  function addRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const next: AutomationRule = {
      id: crypto.randomUUID(),
      name: name.trim(),
      trigger,
      query: query.trim(),
      type,
      tag,
      status,
      action,
      enabled: true,
      createdAt: new Date().toISOString()
    };
    const nextRules = [next, ...rules].slice(0, 40);
    writeRules(nextRules);
    setRules(nextRules);
    setName("");
    setQuery("");
    setType("all");
    setTag("all");
    setStatus("all");
    setAction("notify-admin");
  }

  function updateRules(nextRules: AutomationRule[]) {
    writeRules(nextRules);
    setRules(nextRules);
  }

  function matchingCount(rule: AutomationRule) {
    return records.filter((record) => recordMatches(record, rule)).length;
  }

  return (
    <AppShell subtitle="الأتمتة" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Rules</span>}
        title="محرّك القواعد"
        description="مصمم قواعد مرئي خفيف: trigger، شروط، action، وdry-run على السجلات الحالية. التنفيذ التلقائي الدائم ينتظر backend rules engine."
        meta={(
          <>
            <span className="badge">{rules.length} قاعدة</span>
            <span className="badge">{rules.filter((rule) => rule.enabled).length} مفعّلة</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/inbox">فتح الوارد</a>}
      >
        <form className="archive-toolbar-grid" onSubmit={addRule}>
          <label>
            <span>اسم القاعدة</span>
            <input className="search-input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>المشغّل</span>
            <select value={trigger} onChange={(event) => setTrigger(event.target.value as RuleTrigger)}>
              {(Object.keys(triggerLabels) as RuleTrigger[]).map((item) => <option key={item} value={item}>{triggerLabels[item]}</option>)}
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
            <select value={action} onChange={(event) => setAction(event.target.value as RuleAction)}>
              {(Object.keys(actionLabels) as RuleAction[]).map((item) => <option key={item} value={item}>{actionLabels[item]}</option>)}
            </select>
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary" disabled={!name.trim()}>حفظ القاعدة</button>
          </div>
        </form>
      </PageToolbar>

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل بيانات dry-run</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      {rules.length === 0 ? (
        <EmptyState title="لا توجد قواعد بعد." description="أنشئ قاعدة لتوثيق أتمتة قابلة للاختبار قبل تفعيل backend rules engine." />
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
              </dl>
              <div className="button-row">
                <button
                  className="button button-secondary button-sm"
                  type="button"
                  onClick={() => updateRules(rules.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled } : item))}
                >
                  {rule.enabled ? "إيقاف" : "تفعيل"}
                </button>
                <button className="button button-danger button-sm" type="button" onClick={() => updateRules(rules.filter((item) => item.id !== rule.id))}>حذف</button>
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
