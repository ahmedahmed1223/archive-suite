"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import PageToolbar from "@/components/PageToolbar";
import EmptyState from "@/components/EmptyState";
import DisclosureToolbar from "@/components/DisclosureToolbar";
import { useAuthSession } from "@/lib/auth-session";
import { createArchiveApiClient, type Project, type ProjectTask, type ProjectTaskStatus, type ProjectTaskTemplate, type TaskEscalationPolicy } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";

function formatDueDate(value: string | null, locale: "ar" | "en", noDueDate: string) {
  return value ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)) : noDueDate;
}

export default function ProjectTasksPage() {
  const { t, locale } = useLocale();
  const copy = t.pages.projectTasks;
  const columns: Array<[ProjectTaskStatus, string]> = [
    ["todo", copy.columns.todo],
    ["in_progress", copy.columns.inProgress],
    ["review", copy.columns.review],
    ["done", copy.columns.done]
  ];
  const { user } = useAuthSession();
  const isAdmin = user?.role === "admin";
  const api = useMemo(() => createArchiveApiClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [recordId, setRecordId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("");
  const [templates, setTemplates] = useState<ProjectTaskTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [targetDurationMinutes, setTargetDurationMinutes] = useState("");
  const [policy, setPolicy] = useState<TaskEscalationPolicy | null>(null);
  const [policyStatus, setPolicyStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const loadFailed = Boolean(loadError);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [projectResponse, taskResponse, templateResponse] = await Promise.all([api.projects(), api.projectTasks(), api.projectTaskTemplates()]);
    if (projectResponse.ok) setProjects(projectResponse.projects);
    if (taskResponse.ok) setTasks(taskResponse.tasks);
    if (templateResponse.ok) setTemplates(templateResponse.templates);
    setLoadError(projectResponse.ok && taskResponse.ok && templateResponse.ok ? "" : (!projectResponse.ok ? projectResponse.error : !taskResponse.ok ? taskResponse.error : !templateResponse.ok ? templateResponse.error : "") || "");
    // V14-AUDIT-006: show loading instead of flashing the empty state.
    setIsLoading(false);
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const response = await api.taskEscalationPolicy();
      if (response.ok) setPolicy(response.policy);
    })();
  }, [api, isAdmin]);

  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    if (!policy) return;
    const response = await api.updateTaskEscalationPolicy({
      enabled: policy.enabled,
      warningBeforeMinutes: policy.warningBeforeMinutes,
      repeatMinutes: policy.repeatMinutes
    });
    if (!response.ok) return setPolicyStatus(response.error || copy.escalationPanel.saveError);
    setPolicy(response.policy);
    setPolicyStatus(copy.escalationPanel.saveSuccess);
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setTitle(template.title);
    setTargetDurationMinutes(template.targetDurationMinutes ? String(template.targetDurationMinutes) : "");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !title.trim()) return;
    const parsedDuration = targetDurationMinutes.trim() ? Number(targetDurationMinutes) : null;
    const response = await api.createProjectTask({ projectId, title: title.trim(), status: "todo", assignee: assignee || null, recordId: recordId || null, dueDate: dueDate || null, targetDurationMinutes: parsedDuration });
    if (!response.ok) return setStatus(response.error || copy.createError);
    setTasks((current) => [response.task, ...current]);
    setTitle(""); setAssignee(""); setRecordId(""); setDueDate(""); setTargetDurationMinutes(""); setTemplateId(""); setStatus(copy.createSuccess);
  }

  async function move(task: ProjectTask, next: ProjectTaskStatus) {
    const response = await api.updateProjectTask(task.id, { status: next });
    if (!response.ok) return setStatus(response.error || copy.updateError);
    setTasks((current) => current.map((item) => item.id === task.id ? response.task : item));
  }

  return <AppShell subtitle={t.pageTitles.projectTasks} contentClassName="stack">
    <PageToolbar title={copy.toolbarTitle} description={copy.toolbarDescription} actions={<><a className="button button-primary" href="/kanban">{copy.recordsKanban}</a></>} />
    {/* V14-UX-011 (P4): the board is the page's reason to exist — the 7-field
        create form waits behind a disclosure so tasks stay above the fold. */}
    <DisclosureToolbar summary={copy.addTask}>
      <form className="panel archive-toolbar-grid" onSubmit={create}>
      {templates.length > 0 ? (
        <label>{copy.templateLabel}<select value={templateId} onChange={(event) => applyTemplate(event.target.value)}><option value="">{copy.templateNone}</option>{templates.map((template) => <option value={template.id} key={template.id}>{template.title}</option>)}</select></label>
      ) : null}
      <label>{copy.projectLabel}<select value={projectId} onChange={(event) => setProjectId(event.target.value)} required><option value="">{copy.selectProject}</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
      <label>{copy.taskLabel}<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
      <label>{copy.assigneeLabel}<input value={assignee} onChange={(event) => setAssignee(event.target.value)} /></label>
      <label>{copy.recordIdLabel}<input value={recordId} onChange={(event) => setRecordId(event.target.value)} /></label>
      <label>{copy.dueDateLabel}<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      <label>{copy.targetDurationLabel}<input type="number" min={1} value={targetDurationMinutes} onChange={(event) => setTargetDurationMinutes(event.target.value)} /></label>
      <button className="button button-primary">{copy.addTask}</button>
      </form>
    </DisclosureToolbar>
    {status ? <p className="form-status" role="status">{status}</p> : null}
    {tasks.length ? <section className="workflow-board">{columns.map(([key, label]) => <article className="workflow-column" key={key}><h2>{label}</h2>{tasks.filter((task) => task.status === key).map((task) => <div className="kanban-card" key={task.id}><strong>{task.title}</strong><small>{projects.find((project) => project.id === task.projectId)?.name || task.projectId} · {task.assignee || copy.unassigned}</small><small>{copy.dueDatePrefix.replace("{date}", formatDueDate(task.dueDate, locale, copy.noDueDate))}</small>{task.targetDeadlineAt ? <small>{copy.targetDeadlinePrefix.replace("{date}", new Date(task.targetDeadlineAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA"))}</small> : null}{task.recordId ? <a href={`/archive/${encodeURIComponent(task.recordId)}`}>{copy.linkedRecord}</a> : null}<select aria-label={copy.statusAriaLabel.replace("{title}", task.title)} value={task.status} onChange={(event) => void move(task, event.target.value as ProjectTaskStatus)}>{columns.map(([value, columnLabel]) => <option value={value} key={value}>{columnLabel}</option>)}</select><small>{copy.lastUpdatedPrefix.replace("{date}", new Date(task.updatedAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA"))}</small></div>)}</article>)}</section> : loadFailed ? <div className="state-banner state-banner-error" role="alert"><strong>{copy.loadErrorTitle}</strong><span className="helper-text">{loadError}</span><div><button type="button" className="button button-secondary button-sm" onClick={() => void load()}>{t.shared.actions.retry}</button></div></div> : isLoading ? <Skeleton label={copy.loadingLabel} /> : <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />}
    {isAdmin && policy ? (
      <form className="panel archive-toolbar-grid" onSubmit={savePolicy} aria-label={copy.escalationPanel.title}>
        <h2>{copy.escalationPanel.title}</h2>
        <p className="helper-text">{copy.escalationPanel.description}</p>
        <label className="checkbox-label">
          <input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })} />
          {copy.escalationPanel.enabledLabel}
        </label>
        <label>{copy.escalationPanel.warningLabel}
          <input type="number" min={1} value={policy.warningBeforeMinutes ?? ""} onChange={(event) => setPolicy({ ...policy, warningBeforeMinutes: event.target.value ? Number(event.target.value) : null })} />
        </label>
        <label>{copy.escalationPanel.repeatLabel}
          <input type="number" min={1} value={policy.repeatMinutes ?? ""} onChange={(event) => setPolicy({ ...policy, repeatMinutes: event.target.value ? Number(event.target.value) : null })} />
        </label>
        <button className="button button-primary" type="submit">{copy.escalationPanel.save}</button>
        {policyStatus ? <p className="form-status">{policyStatus}</p> : null}
      </form>
    ) : null}
  </AppShell>;
}
