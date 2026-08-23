"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type Project } from "@/lib/archive-api";
import { useCapability } from "@/components/RoleGate";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ProjectGroupsPage() {
  const { t } = useLocale();
  const copy = t.pages.projectGroups;
  const api = useMemo(() => createArchiveApiClient(), []);
  const canManage = useCapability("collections.manage");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [recordIds, setRecordIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [recordId, setRecordId] = useState("");
  const [status, setStatus] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const selected = projects.find((project) => project.id === selectedId) ?? null;
  const refresh = useCallback(async () => {
    setIsLoading(true);
    const response = await api.projects();
    if (!response.ok) return setLoadError(response.error || copy.errors.projectsLoad);
    setLoadError("");
    // V14-AUDIT-006: don't flash the empty state before data arrives.
    setIsLoading(false);
    setProjects(response.projects);
    setSelectedId((current) => current || response.projects[0]?.id || "");
  }, [api, copy.errors.projectsLoad]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!selectedId) return setRecordIds([]);
    void api.projectRecords(selectedId).then((response) => {
      if (response.ok) setRecordIds(response.recordIds);
      else setStatus(response.error || copy.errors.recordsLoad);
    });
  }, [api, copy.errors.recordsLoad, selectedId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const response = await api.createProject(name, notes);
    if (!response.ok) return setStatus(response.error || copy.errors.create);
    setName(""); setNotes(""); setSelectedId(response.project.id); setStatus(copy.feedback.created); await refresh();
  }
  async function saveNotes() {
    if (!selected) return;
    const response = await api.updateProject(selected.id, { notes });
    if (!response.ok) return setStatus(response.error || copy.errors.saveNotes);
    setProjects((current) => current.map((project) => project.id === selected.id ? response.project : project));
    setStatus(copy.feedback.notesSaved);
  }
  async function addRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !recordId.trim()) return;
    const response = await api.linkProjectRecord(selected.id, recordId.trim());
    if (!response.ok) return setStatus(response.error || copy.errors.linkRecord);
    setRecordId(""); setStatus(copy.feedback.recordLinked);
    const records = await api.projectRecords(selected.id); if (records.ok) setRecordIds(records.recordIds);
  }
  async function reorder(next: string[]) {
    if (!selected) return;
    const response = await api.reorderProjectRecords(selected.id, next);
    if (!response.ok) return setStatus(response.error || copy.errors.saveOrder);
    setRecordIds(response.recordIds); setStatus(copy.feedback.orderSaved);
  }

  return <AppShell subtitle={t.pageTitles.workProjects} contentClassName="stack" tipsPage="projects">
    <PageToolbar title={copy.toolbar.title} description={copy.toolbar.description} meta={<span className="badge">{copy.toolbar.projectCount.replace("{count}", String(projects.length))}</span>} />
    {loadError ? <div className="state-banner state-banner-error" role="alert"><strong>{copy.errors.projectsLoad}</strong><span className="helper-text">{loadError}</span><div><button type="button" className="button button-secondary button-sm" onClick={() => void refresh()}>{t.shared.actions.retry}</button></div></div> : null}
    {canManage ? <form className="panel auth-form" onSubmit={create}><label>{copy.form.projectName}<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>{copy.form.projectNotes}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} /></label><button className="button button-primary">{copy.form.create}</button></form> : null}
    {status ? <p className="form-status" role="status">{status}</p> : null}
    {isLoading ? <Skeleton label={copy.loadingLabel} /> : projects.length === 0 ? <EmptyState title={copy.empty.title} description={copy.empty.description} /> : <div className="split-layout"><aside className="panel"><h2>{copy.content.projectsTitle}</h2><div className="stack">{projects.map((project) => <button type="button" className={`button ${project.id === selectedId ? "button-primary" : "button-secondary"}`} onClick={() => { setSelectedId(project.id); setNotes(project.notes || ""); }} key={project.id}>{project.name}</button>)}</div></aside>{selected ? <section className="stack"><article className="panel"><h2>{selected.name}</h2><label>{copy.form.projectNotes}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} disabled={!canManage} /></label>{canManage ? <button type="button" className="button button-secondary" onClick={() => void saveNotes()}>{copy.form.saveNotes}</button> : null}</article><article className="panel"><h2>{copy.content.materialsTitle}</h2>{canManage ? <form className="button-row" onSubmit={addRecord}><input value={recordId} onChange={(event) => setRecordId(event.target.value)} placeholder={copy.form.recordIdPlaceholder} /><button className="button button-secondary">{copy.form.linkRecord}</button></form> : null}{recordIds.length ? <ol className="record-note-list">{recordIds.map((id, index) => <li key={id}><a href={`/archive/${encodeURIComponent(id)}`}>{id}</a>{canManage ? <span className="button-row"><button className="button button-secondary button-sm" disabled={index === 0} onClick={() => void reorder([...recordIds.slice(0, index - 1), id, recordIds[index - 1], ...recordIds.slice(index + 1)])}>↑</button><button className="button button-secondary button-sm" disabled={index === recordIds.length - 1} onClick={() => void reorder([...recordIds.slice(0, index), recordIds[index + 1], id, ...recordIds.slice(index + 2)])}>↓</button></span> : null}</li>)}</ol> : <p className="helper-text">{copy.content.noMaterials}</p>}</article></section> : null}</div>}
  </AppShell>;
}
