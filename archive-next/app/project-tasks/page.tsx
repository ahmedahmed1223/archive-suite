"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import PageToolbar from "@/components/PageToolbar";
import EmptyState from "@/components/EmptyState";
import { createArchiveApiClient, type Project, type ProjectTask, type ProjectTaskStatus } from "@/lib/archive-api";

const columns: Array<[ProjectTaskStatus, string]> = [["todo", "للعمل"], ["in_progress", "قيد التنفيذ"], ["review", "للمراجعة"], ["done", "مكتملة"]];

function formatDueDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)) : "بلا تاريخ استحقاق";
}

export default function ProjectTasksPage() {
  const { t } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [recordId, setRecordId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const [projectResponse, taskResponse] = await Promise.all([api.projects(), api.projectTasks()]);
    if (projectResponse.ok) setProjects(projectResponse.projects);
    if (taskResponse.ok) setTasks(taskResponse.tasks);
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !title.trim()) return;
    const response = await api.createProjectTask({ projectId, title: title.trim(), status: "todo", assignee: assignee || null, recordId: recordId || null, dueDate: dueDate || null });
    if (!response.ok) return setStatus(response.error || "تعذر إنشاء المهمة.");
    setTasks((current) => [response.task, ...current]);
    setTitle(""); setAssignee(""); setRecordId(""); setDueDate(""); setStatus("تم إنشاء المهمة.");
  }

  async function move(task: ProjectTask, next: ProjectTaskStatus) {
    const response = await api.updateProjectTask(task.id, { status: next });
    if (!response.ok) return setStatus(response.error || "تعذر تحديث الحالة.");
    setTasks((current) => current.map((item) => item.id === task.id ? response.task : item));
  }

  return <AppShell subtitle={t.pageTitles.projectTasks} contentClassName="stack">
    <PageToolbar title="لوحة مهام المشاريع" description="مهام مستقلة مرتبطة بمشروع، مع مكلّف واستحقاق وتاريخ تحديث وربط اختياري بسجل أرشيفي." actions={<a className="button button-secondary" href="/kanban">كانبان السجلات</a>} />
    <form className="panel archive-toolbar-grid" onSubmit={create}>
      <label>المشروع<select value={projectId} onChange={(event) => setProjectId(event.target.value)} required><option value="">اختر مشروعاً</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
      <label>المهمة<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
      <label>المكلّف<input value={assignee} onChange={(event) => setAssignee(event.target.value)} /></label>
      <label>معرّف المادة (اختياري)<input value={recordId} onChange={(event) => setRecordId(event.target.value)} /></label>
      <label>تاريخ الاستحقاق<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      <button className="button button-primary">إضافة مهمة</button>
    </form>
    {status ? <p className="form-status">{status}</p> : null}
    {tasks.length ? <section className="workflow-board">{columns.map(([key, label]) => <article className="workflow-column" key={key}><h2>{label}</h2>{tasks.filter((task) => task.status === key).map((task) => <div className="kanban-card" key={task.id}><strong>{task.title}</strong><small>{projects.find((project) => project.id === task.projectId)?.name || task.projectId} · {task.assignee || "غير مسند"}</small><small>الاستحقاق: {formatDueDate(task.dueDate)}</small>{task.recordId ? <a href={`/archive/${encodeURIComponent(task.recordId)}`}>المادة المرتبطة</a> : null}<select aria-label={`حالة ${task.title}`} value={task.status} onChange={(event) => void move(task, event.target.value as ProjectTaskStatus)}>{columns.map(([value, columnLabel]) => <option value={value} key={value}>{columnLabel}</option>)}</select><small>آخر تحديث: {new Date(task.updatedAt).toLocaleString("ar-SA")}</small></div>)}</article>)}</section> : <EmptyState title="لا توجد مهام بعد" description="أضف أول مهمة إلى مشروع عمل." />}
  </AppShell>;
}
