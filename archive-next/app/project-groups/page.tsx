"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type Project } from "@/lib/archive-api";
import { useCapability } from "@/components/RoleGate";

export default function ProjectGroupsPage() {
  const { t } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const canManage = useCapability("collections.manage");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [recordIds, setRecordIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [recordId, setRecordId] = useState("");
  const [status, setStatus] = useState("");

  const selected = projects.find((project) => project.id === selectedId) ?? null;
  const refresh = useCallback(async () => {
    const response = await api.projects();
    if (!response.ok) return setStatus(response.error || "تعذر تحميل مشاريع العمل.");
    setProjects(response.projects);
    setSelectedId((current) => current || response.projects[0]?.id || "");
  }, [api]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!selectedId) return setRecordIds([]);
    void api.projectRecords(selectedId).then((response) => {
      if (response.ok) setRecordIds(response.recordIds);
      else setStatus(response.error || "تعذر تحميل مواد المشروع.");
    });
  }, [api, selectedId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const response = await api.createProject(name, notes);
    if (!response.ok) return setStatus(response.error || "تعذر إنشاء المشروع.");
    setName(""); setNotes(""); setSelectedId(response.project.id); setStatus("تم إنشاء مشروع العمل."); await refresh();
  }
  async function saveNotes() {
    if (!selected) return;
    const response = await api.updateProject(selected.id, { notes });
    if (!response.ok) return setStatus(response.error || "تعذر حفظ الملاحظات.");
    setProjects((current) => current.map((project) => project.id === selected.id ? response.project : project));
    setStatus("حُفظت ملاحظات المشروع.");
  }
  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !recordId.trim()) return;
    const response = await api.linkProjectRecord(selected.id, recordId.trim());
    if (!response.ok) return setStatus(response.error || "تعذر ربط المادة.");
    setRecordId(""); setStatus("رُبطت المادة بالمشروع.");
    const records = await api.projectRecords(selected.id); if (records.ok) setRecordIds(records.recordIds);
  }
  async function reorder(next: string[]) {
    if (!selected) return;
    const response = await api.reorderProjectRecords(selected.id, next);
    if (!response.ok) return setStatus(response.error || "تعذر حفظ الترتيب.");
    setRecordIds(response.recordIds); setStatus("حُفظ ترتيب المواد.");
  }

  return <AppShell subtitle={t.pageTitles.workProjects} contentClassName="stack" tipsPage="projects">
    <PageToolbar title="مشاريع العمل" description="حقائب عمل مستقلة تجمع المواد مع ملاحظات وترتيب محفوظ للخادم." meta={<span className="badge">{projects.length} مشاريع</span>} />
    {canManage ? <form className="panel auth-form" onSubmit={create}><label>اسم المشروع<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>ملاحظات المشروع<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} /></label><button className="button button-primary">إنشاء مشروع</button></form> : null}
    {status ? <p className="form-status" role="status">{status}</p> : null}
    {projects.length === 0 ? <EmptyState title="لا توجد مشاريع عمل" description="أنشئ مشروعاً لجمع المواد وترتيبها." /> : <div className="split-layout"><aside className="panel"><h2>المشاريع</h2><div className="stack">{projects.map((project) => <button type="button" className={`button ${project.id === selectedId ? "button-primary" : "button-secondary"}`} onClick={() => { setSelectedId(project.id); setNotes(project.notes || ""); }} key={project.id}>{project.name}</button>)}</div></aside>{selected ? <section className="stack"><article className="panel"><h2>{selected.name}</h2><label>ملاحظات المشروع<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} disabled={!canManage} /></label>{canManage ? <button type="button" className="button button-secondary" onClick={() => void saveNotes()}>حفظ الملاحظات</button> : null}</article><article className="panel"><h2>مواد المشروع</h2>{canManage ? <form className="button-row" onSubmit={addRecord}><input value={recordId} onChange={(event) => setRecordId(event.target.value)} placeholder="معرّف المادة" /><button className="button button-secondary">ربط مادة</button></form> : null}{recordIds.length ? <ol className="record-note-list">{recordIds.map((id, index) => <li key={id}><a href={`/archive/${encodeURIComponent(id)}`}>{id}</a>{canManage ? <span className="button-row"><button className="button button-secondary button-sm" disabled={index === 0} onClick={() => void reorder([...recordIds.slice(0, index - 1), id, recordIds[index - 1], ...recordIds.slice(index + 1)])}>↑</button><button className="button button-secondary button-sm" disabled={index === recordIds.length - 1} onClick={() => void reorder([...recordIds.slice(0, index), recordIds[index + 1], id, ...recordIds.slice(index + 2)])}>↓</button></span> : null}</li>)}</ol> : <p className="helper-text">لا توجد مواد مرتبطة بعد.</p>}</article></section> : null}</div>}
  </AppShell>;
}
