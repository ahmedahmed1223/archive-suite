"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type DepartmentFieldOwner, type DepartmentTemplateMetrics, type MetadataTemplate, type MetadataTemplateVersion } from "@/lib/archive-api";
import { previewTemplateApplication } from "@/lib/metadata-template-apply";
import DepartmentQualityPanel from "@/components/DepartmentQualityPanel";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Skeleton } from "@/components/ui/Skeleton";

const roles = ["viewer", "editor", "admin"] as const;
type Role = (typeof roles)[number];

function fieldsText(template?: MetadataTemplate): string {
  return JSON.stringify(template?.fields ?? {}, null, 2);
}

export default function MetadataTemplatesPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.metadataTemplates;
  const api = useMemo(() => createArchiveApiClient(), []);
  const canManageTemplates = useCapability("templates.manage");
  const canPublishTemplates = useCapability("users.manage");
  const [templates, setTemplates] = useState<MetadataTemplate[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [tags, setTags] = useState("");
  const [fields, setFields] = useState("{}");
  const [usageRoles, setUsageRoles] = useState<Role[]>(["editor"]);
  const [enabled, setEnabled] = useState(true);
  const [editing, setEditing] = useState<MetadataTemplate | null>(null);
  const [versions, setVersions] = useState<MetadataTemplateVersion[]>([]);
  const [error, setError] = useState("");
  const [fieldOwners, setFieldOwners] = useState<DepartmentFieldOwner[]>([]);
  const [ownerField, setOwnerField] = useState("");
  const [ownerAssignee, setOwnerAssignee] = useState("");
  const [metrics, setMetrics] = useState<DepartmentTemplateMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true); // V14-AUDIT-013

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await api.metadataTemplates({ departmentId: departmentId || undefined, includeDisabled: canManageTemplates });
    if (response.ok) { setTemplates(response.templates); setError(""); }
    else setError(response.error || copy.errors.loadTemplates);
    setIsLoading(false);
  }, [api, canManageTemplates, copy.errors.loadTemplates, departmentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!departmentId) { setFieldOwners([]); return; } void api.departmentFieldOwners(departmentId).then((response) => { if (response.ok) setFieldOwners(response.owners); }); }, [api, departmentId]);
  useEffect(() => { if (!departmentId) { setMetrics(null); return; } void api.departmentTemplateMetrics(departmentId).then((response) => { if (response.ok) setMetrics(response.metrics); }); }, [api, departmentId]);

  async function addFieldOwner() {
    if (!departmentId.trim() || !ownerField.trim() || !ownerAssignee.trim()) return;
    const owners = [...fieldOwners.filter((item) => item.field !== ownerField.trim()), { field: ownerField.trim(), owner: ownerAssignee.trim() }];
    const response = await api.replaceDepartmentFieldOwners(departmentId.trim(), owners);
    if (!response.ok) { setError(response.error || copy.errors.saveFieldOwners); return; }
    setFieldOwners(response.owners); setOwnerField(""); setOwnerAssignee("");
  }

  function resetForm() {
    setEditing(null); setName(""); setTypeId(""); setTags(""); setFields("{}"); setUsageRoles(["editor"]); setEnabled(true);
  }

  function beginEdit(template: MetadataTemplate) {
    setEditing(template); setName(template.name); setTypeId(template.typeId || ""); setDepartmentId(template.departmentId || "");
    setTags(template.tags.join(", ")); setFields(fieldsText(template)); setUsageRoles(template.usageRoles); setEnabled(template.enabled); setVersions([]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let parsedFields: Record<string, unknown>;
    try {
      const parsed = JSON.parse(fields);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
      parsedFields = parsed;
    } catch {
      setError(copy.errors.invalidFields);
      return;
    }
    const payload = { name: name.trim(), typeId: typeId.trim() || null, departmentId: departmentId.trim(), fields: parsedFields, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), usageRoles, enabled };
    const response = editing ? await api.updateMetadataTemplate(editing.id, payload) : await api.createMetadataTemplate(payload);
    if (!response.ok) { setError(response.error || copy.errors.saveTemplate); return; }
    resetForm(); await load();
  }

  async function showVersions(template: MetadataTemplate) {
    const response = await api.metadataTemplateVersions(template.id);
    if (response.ok) { setVersions(response.versions); setError(""); }
    else setError(response.error || copy.errors.loadVersions);
  }

  async function toggle(template: MetadataTemplate) {
    const response = await api.updateMetadataTemplate(template.id, { enabled: !template.enabled });
    if (!response.ok) { setError(response.error || copy.errors.toggleTemplate); return; }
    await load();
  }

  async function publish(template: MetadataTemplate) {
    const response = await api.publishMetadataTemplate(template.id);
    if (!response.ok) { setError(response.error || copy.errors.publishTemplate); return; }
    await load();
  }

  async function restorePublished(version: MetadataTemplateVersion) {
    if (!editing) return;
    const response = await api.restorePublishedMetadataTemplate(editing.id, version.version);
    if (!response.ok) { setError(response.error || copy.errors.restorePublished); return; }
    await load();
  }

  const preview = editing ? previewTemplateApplication({ description: "", type: "", tags: [], metadata: {} }, editing) : null;

  return (
    <AppShell subtitle={t.pageTitles.departmentTemplates} contentClassName="local-list-content" tipsPage="settings">
      <PageToolbar eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>} title={copy.toolbar.title} description={copy.toolbar.description} actions={<a className="button button-secondary" href="/settings">{copy.toolbar.settings}</a>}>
        <label><span>{copy.toolbar.departmentFilter}</span><input className="search-input" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} placeholder={copy.toolbar.departmentPlaceholder} /></label>
      </PageToolbar>

      {error ? <div className="state-banner state-banner-error" role="alert">{error}</div> : null}

      {canManageTemplates ? (
        <form className="panel archive-toolbar-grid" onSubmit={save}>
          <div className="panel-title-row"><div><h2>{editing ? copy.form.editTitle : copy.form.newTitle}</h2><p>{copy.form.description}</p></div>{editing ? <button className="button button-secondary button-sm" type="button" onClick={resetForm}>{copy.form.newTemplate}</button> : null}</div>
          <label><span>{copy.form.name}</span><input className="search-input" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label><span>{copy.form.owningDepartment}</span><input className="search-input" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required /></label>
          <label><span>{copy.form.itemType}</span><input className="search-input" value={typeId} onChange={(event) => setTypeId(event.target.value)} /></label>
          <label><span>{copy.form.defaultTags}</span><input className="search-input" value={tags} onChange={(event) => setTags(event.target.value)} placeholder={copy.form.tagsPlaceholder} /></label>
          <label><span>{copy.form.usageRoles}</span><select multiple value={usageRoles} onChange={(event) => setUsageRoles(Array.from(event.target.selectedOptions, (option) => option.value as Role))}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <label className="full-span"><span>{copy.form.defaultFields}</span><textarea className="search-input" value={fields} onChange={(event) => setFields(event.target.value)} rows={5} dir="ltr" /></label>
          <label><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> {copy.form.enabled}</label>
          <div className="archive-toolbar-actions"><button className="button button-primary" type="submit" disabled={!name.trim() || !departmentId.trim()}>{editing ? copy.form.saveVersion : copy.form.createTemplate}</button></div>
        </form>
      ) : null}

      <section className="split-layout">
        <article className="panel">
          <div className="panel-title-row"><div><h2>{copy.available.title}</h2><p>{copy.available.description}</p></div><span className="badge">{templates.length}</span></div>
          {isLoading ? <Skeleton label={copy.loadingLabel} /> : templates.length === 0 ? <EmptyState title={copy.available.emptyTitle} description={copy.available.emptyDescription} /> : <div className="analytics-tag-list">{templates.map((template) => (
            <div className="analytics-tag-row" key={template.id}><span><strong>{template.name}</strong><small className="helper-text"> · {copy.available.department.replace("{department}", template.departmentId || copy.available.general)} · {copy.available.draft.replace("{version}", String(template.currentVersion))} · {copy.available.published.replace("{version}", String(template.publishedVersion ?? "—"))}</small><small className="helper-text"> · {template.tags.join(copy.available.tagSeparator) || copy.available.noTags}</small></span><div className="button-row"><span className={`badge ${template.enabled ? "badge-success" : "badge-warning"}`}>{template.enabled ? copy.available.enabled : copy.available.disabled}</span><button className="button button-secondary button-sm" type="button" onClick={() => void showVersions(template)}>{copy.available.versions}</button>{canPublishTemplates ? <button className="button button-primary button-sm" type="button" onClick={() => void publish(template)}>{copy.available.publishDraft}</button> : null}{canManageTemplates ? <><button className="button button-secondary button-sm" type="button" onClick={() => beginEdit(template)}>{copy.available.edit}</button><button className="button button-secondary button-sm" type="button" onClick={() => void toggle(template)}>{template.enabled ? copy.available.disable : copy.available.enable}</button></> : null}</div></div>
          ))}</div>}
        </article>
        <article className="panel"><div className="panel-title-row"><div><h2>{copy.preview.title}</h2><p>{copy.preview.description}</p></div></div>
          {preview ? <pre className="code-block">{JSON.stringify(preview, null, 2)}</pre> : <p className="helper-text">{copy.preview.empty}</p>}
          {versions.length ? <ol className="helper-text">{versions.map((version) => <li key={version.id}>{copy.preview.version.replace("{version}", String(version.version))} — {new Date(version.createdAt).toLocaleString(locale === "ar" ? "ar" : "en")} — {version.snapshot.name} {canPublishTemplates ? <button className="button button-secondary button-sm" type="button" onClick={() => void restorePublished(version)}>{copy.preview.restore}</button> : null}</li>)}</ol> : null}
        </article>
      </section>
      <DepartmentQualityPanel departmentId={departmentId} />
      {metrics ? <article className="panel"><h2>{copy.metrics.title}</h2><div className="button-row"><span className="badge">{copy.metrics.templates.replace("{count}", String(metrics.templateCount))}</span><span className="badge">{copy.metrics.published.replace("{count}", String(metrics.publishedTemplateCount))}</span><span className="badge">{copy.metrics.qualityRules.replace("{count}", String(metrics.qualityRuleCount))}</span><span className="badge">{copy.metrics.records.replace("{count}", String(metrics.recordCount))}</span></div><p className="helper-text">{copy.metrics.missingFields.replace("{fields}", Object.entries(metrics.missingFieldCounts).map(([field, count]) => `${field}: ${count}`).join(" · ") || copy.metrics.noEnabledRules)}</p></article> : null}
      {canManageTemplates && departmentId ? <article className="panel"><div className="panel-title-row"><div><h2>{copy.owners.title}</h2><p>{copy.owners.description}</p></div></div><div className="button-row"><input className="search-input" value={ownerField} onChange={(event) => setOwnerField(event.target.value)} placeholder={copy.owners.fieldPlaceholder} /><input className="search-input" value={ownerAssignee} onChange={(event) => setOwnerAssignee(event.target.value)} placeholder={copy.owners.assigneePlaceholder} /><button className="button button-primary button-sm" type="button" onClick={() => void addFieldOwner()}>{copy.owners.save}</button></div>{fieldOwners.map((owner) => <div className="analytics-tag-row" key={owner.id}><span>{owner.field} · {owner.owner}</span><button className="button button-secondary button-sm" type="button" onClick={() => void api.replaceDepartmentFieldOwners(departmentId, fieldOwners.filter((item) => item.id !== owner.id)).then((response) => response.ok && setFieldOwners(response.owners))}>{copy.owners.remove}</button></div>)}</article> : null}
    </AppShell>
  );
}
