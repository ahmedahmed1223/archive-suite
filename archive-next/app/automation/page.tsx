"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import { useCapability } from "@/components/RoleGate";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createArchiveApiClient,
  type ArchiveRecord,
  type AutomationRule,
  type AutomationRuleAction,
  type AutomationRuleRun,
  type AutomationRuleTemplate,
  type AutomationRuleTrigger
} from "@/lib/archive-api";
import { getRecordWorkflowStatus, recordMatches } from "@/lib/record-utils";
import { Skeleton } from "@/components/ui/Skeleton";

function formatDate(value: string | null | undefined, locale: "ar" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "en" ? "en-US" : "ar-SA");
}

export default function AutomationPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.automation;
  const triggerLabels: Record<AutomationRuleTrigger, string> = {
    "record.created": copy.triggers.recordCreated,
    "record.updated": copy.triggers.recordUpdated,
    "media.failed": copy.triggers.mediaFailed,
    "schedule.daily": copy.triggers.scheduleDaily
  };
  const actionLabels: Record<AutomationRuleAction, string> = {
    "add-tag": copy.actions.addTag,
    "set-review": copy.actions.setReview,
    "notify-admin": copy.actions.notifyAdmin,
    "create-inbox-item": copy.actions.createInboxItem
  };
  const dialogs = useConfirmDialog();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [error, setError] = useState("");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRuleRun[]>([]);
  const [templates, setTemplates] = useState<AutomationRuleTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<AutomationRuleTrigger>("record.created");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [tag, setTag] = useState("all");
  const [status, setStatus] = useState("all");
  const [departmentId, setDepartmentId] = useState("");
  const [action, setAction] = useState<AutomationRuleAction>("notify-admin");
  const canManageAutomation = useCapability("automation.manage");

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
    void (async () => {
      const response = await api.automationRuleTemplates();
      if (response.ok) setTemplates(response.templates);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshAutomation and the inline search/template callbacks are redefined every render; api is the only stable dependency and is already listed
  }, [api]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;

    setName(template.name);
    setTrigger(template.trigger);
    setQuery(template.query);
    setType(template.type || "all");
    setTag(template.tag || "all");
    setStatus(template.status || "all");
    setDepartmentId(template.departmentId);
    setAction(template.action);
  }

  const types = useMemo(() => Array.from(new Set(records.map((record) => record.type).filter(Boolean))) as string[], [records]);
  const tags = useMemo(() => Array.from(new Set(records.flatMap((record) => record.tags || []))).sort((a, b) => a.localeCompare(b, "ar")), [records]);
  const statuses = useMemo(() => Array.from(new Set(records.map((record) => getRecordWorkflowStatus(record)))), [records]);

  async function addRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setStatusMessage(copy.feedback.saving);
    const response = await api.createAutomationRule({
      name: name.trim(),
      trigger,
      query: query.trim(),
      type,
      tag,
      status,
      departmentId: departmentId.trim(),
      action,
      enabled: true
    });

    if (!response.ok) {
      setStatusMessage(response.error || copy.feedback.saveError);
      return;
    }

    setName("");
    setQuery("");
    setType("all");
    setTag("all");
    setStatus("all");
    setDepartmentId("");
    setAction("notify-admin");
    setTemplateId("");
    setStatusMessage(copy.feedback.saved);
    await refreshAutomation();
  }

  async function toggleRule(rule: AutomationRule) {
    setBusyId(rule.id);
    const response = await api.updateAutomationRule(rule.id, { enabled: !rule.enabled });
    if (!response.ok) setStatusMessage(response.error || copy.feedback.updateError);
    else setStatusMessage(rule.enabled ? copy.feedback.stopped : copy.feedback.enabled);
    await refreshAutomation();
    setBusyId(null);
  }

  async function deleteRule(rule: AutomationRule) {
    const confirmed = await dialogs.confirm({
      title: copy.deleteDialog.title,
      message: copy.deleteDialog.message.replace("{name}", rule.name),
      confirmLabel: copy.deleteDialog.confirm,
      destructive: true
    });
    if (!confirmed) return;

    setBusyId(rule.id);
    const response = await api.deleteAutomationRule(rule.id);
    if (!response.ok) setStatusMessage(response.error || copy.feedback.deleteError);
    else setStatusMessage(copy.feedback.deleted);
    await refreshAutomation();
    setBusyId(null);
  }

  async function runRule(rule: AutomationRule, dryRun: boolean) {
    setBusyId(rule.id);
    const response = await api.runAutomationRule(rule.id, { dryRun });
    if (!response.ok) {
      setStatusMessage(response.error || copy.feedback.runError);
    } else {
      setStatusMessage(`${dryRun ? copy.feedback.dryRun : copy.feedback.liveRun}: ${response.run.message || copy.feedback.runCompleted}`);
    }
    await refreshAutomation();
    setBusyId(null);
  }

  function matchingCount(rule: AutomationRule) {
    return records.filter((record) => recordMatches(record, rule)).length;
  }

  return (
    <AppShell subtitle={t.pageTitles.automation} contentClassName="local-list-content" tipsPage="automation">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={(
          <>
            <span className="badge">{copy.toolbar.ruleCount.replace("{count}", String(rules.length))}</span>
            <span className="badge">{copy.toolbar.enabledCount.replace("{count}", String(rules.filter((rule) => rule.enabled).length))}</span>
            <span className="badge">{copy.toolbar.runCount.replace("{count}", String(runs.length))}</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/activity">{copy.toolbar.activityLink}</a>}
      >
        {canManageAutomation ? (
          <form className="archive-toolbar-grid" onSubmit={addRule}>
            {templates.length > 0 ? (
              <label>
                <span>{copy.form.templateLabel}</span>
                <select value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
                  <option value="">{copy.form.templateNone}</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>{copy.form.nameLabel}</span>
              <input className="search-input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              <span>{copy.form.triggerLabel}</span>
              <select value={trigger} onChange={(event) => setTrigger(event.target.value as AutomationRuleTrigger)}>
                {(Object.keys(triggerLabels) as AutomationRuleTrigger[]).map((item) => <option key={item} value={item}>{triggerLabels[item]}</option>)}
              </select>
            </label>
            <label>
              <span>{copy.form.queryLabel}</span>
              <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.form.queryPlaceholder} />
            </label>
            <label>
              <span>{copy.form.typeLabel}</span>
              <select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="all">{copy.form.allTypes}</option>
                {types.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>{copy.form.tagLabel}</span>
              <select value={tag} onChange={(event) => setTag(event.target.value)}>
                <option value="all">{copy.form.allTags}</option>
                {tags.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>{copy.form.statusLabel}</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">{copy.form.allStatuses}</option>
                {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>{copy.form.actionLabel}</span>
              <select value={action} onChange={(event) => setAction(event.target.value as AutomationRuleAction)}>
                {(Object.keys(actionLabels) as AutomationRuleAction[]).map((item) => <option key={item} value={item}>{actionLabels[item]}</option>)}
              </select>
            </label>
            {action === "create-inbox-item" ? <label>
              <span>{copy.form.departmentLabel}</span>
              <input className="search-input" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} placeholder={copy.form.optional} />
            </label> : null}
            <div className="archive-toolbar-actions">
              <button type="submit" className="button button-primary" disabled={!name.trim()}>{copy.form.save}</button>
            </div>
          </form>
        ) : null}
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
      </PageToolbar>

      <OperationalSafetyPanel action={copy.safetyAction} dryRun confidence={82} auditHref="/activity" />

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.load.errorTitle}</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="panel panel-compact" role="status">
          <Skeleton label={copy.load.loading} />
        </div>
      ) : null}

      {!loading && rules.length === 0 ? (
        <EmptyState title={copy.empty.title} description={copy.empty.description} />
      ) : (
        <section className="rules-grid" aria-label={copy.rules.ariaLabel}>
          {rules.map((rule) => (
            <article className="local-list-card" key={rule.id} data-enabled={rule.enabled ? "true" : "false"}>
              <div className="local-list-card__main">
                <div>
                  <span className="badge">{rule.enabled ? copy.rules.enabled : copy.rules.stopped}</span>
                  <h3>{rule.name}</h3>
                </div>
                <strong className="metric-value">{matchingCount(rule)}</strong>
              </div>
              <dl className="mobile-field-list">
                <div><dt>{copy.rules.triggerLabel}</dt><dd>{triggerLabels[rule.trigger]}</dd></div>
                <div><dt>{copy.rules.conditionsLabel}</dt><dd>{[rule.query, rule.type !== "all" ? rule.type : "", rule.tag !== "all" ? rule.tag : "", rule.status !== "all" ? rule.status : ""].filter(Boolean).join(" · ") || copy.rules.allRecords}</dd></div>
                <div><dt>{copy.rules.actionLabel}</dt><dd>{actionLabels[rule.action]}{rule.departmentId ? ` · ${rule.departmentId}` : ""}</dd></div>
                <div><dt>{copy.rules.lastRunLabel}</dt><dd>{formatDate(rule.lastRunAt, locale)}</dd></div>
              </dl>
              <div className="button-row">
                <button className="button button-secondary button-sm" type="button" onClick={() => void runRule(rule, true)} disabled={busyId === rule.id}>
                  {copy.rules.dryRun}
                </button>
                {canManageAutomation ? (
                  <>
                    <button className="button button-primary button-sm" type="button" onClick={() => void runRule(rule, false)} disabled={busyId === rule.id || !rule.enabled}>
                      {copy.rules.liveRun}
                    </button>
                    <button className="button button-secondary button-sm" type="button" onClick={() => void toggleRule(rule)} disabled={busyId === rule.id}>
                      {rule.enabled ? copy.rules.stop : copy.rules.enable}
                    </button>
                    <button className="button button-danger button-sm" type="button" onClick={() => void deleteRule(rule)} disabled={busyId === rule.id}>{copy.rules.delete}</button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}

      {runs.length > 0 ? (
        <article className="panel">
          <div className="panel-section-header">
            <h2>{copy.runs.title}</h2>
          </div>
          <ul className="compact-list">
            {runs.map((run) => (
              <li key={run.id}>
                <strong>{run.dryRun ? copy.runs.dryRun : copy.runs.liveRun} · {run.status}</strong>
                <span className="helper-text">
                  {copy.runs.matched.replace("{count}", String(run.matchedCount))} · {copy.runs.executed.replace("{count}", String(run.executedCount))} · {formatDate(run.createdAt, locale)}
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
