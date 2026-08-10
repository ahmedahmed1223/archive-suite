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

const roles = ["viewer", "editor", "admin"] as const;
type Role = (typeof roles)[number];

function fieldsText(template?: MetadataTemplate): string {
  return JSON.stringify(template?.fields ?? {}, null, 2);
}

export default function MetadataTemplatesPage() {
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

  const load = useCallback(async () => {
    const response = await api.metadataTemplates({ departmentId: departmentId || undefined, includeDisabled: canManageTemplates });
    if (response.ok) { setTemplates(response.templates); setError(""); }
    else setError(response.error || "تعذر تحميل مكتبة القوالب.");
  }, [api, canManageTemplates, departmentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!departmentId) { setFieldOwners([]); return; } void api.departmentFieldOwners(departmentId).then((response) => { if (response.ok) setFieldOwners(response.owners); }); }, [api, departmentId]);
  useEffect(() => { if (!departmentId) { setMetrics(null); return; } void api.departmentTemplateMetrics(departmentId).then((response) => { if (response.ok) setMetrics(response.metrics); }); }, [api, departmentId]);

  async function addFieldOwner() {
    if (!departmentId.trim() || !ownerField.trim() || !ownerAssignee.trim()) return;
    const owners = [...fieldOwners.filter((item) => item.field !== ownerField.trim()), { field: ownerField.trim(), owner: ownerAssignee.trim() }];
    const response = await api.replaceDepartmentFieldOwners(departmentId.trim(), owners);
    if (!response.ok) { setError(response.error || "تعذر حفظ مالكية الحقول."); return; }
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
      setError("حقول القالب يجب أن تكون كائن JSON صالحًا.");
      return;
    }
    const payload = { name: name.trim(), typeId: typeId.trim() || null, departmentId: departmentId.trim(), fields: parsedFields, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), usageRoles, enabled };
    const response = editing ? await api.updateMetadataTemplate(editing.id, payload) : await api.createMetadataTemplate(payload);
    if (!response.ok) { setError(response.error || "تعذر حفظ القالب."); return; }
    resetForm(); await load();
  }

  async function showVersions(template: MetadataTemplate) {
    const response = await api.metadataTemplateVersions(template.id);
    if (response.ok) { setVersions(response.versions); setError(""); }
    else setError(response.error || "تعذر تحميل إصدارات القالب.");
  }

  async function toggle(template: MetadataTemplate) {
    const response = await api.updateMetadataTemplate(template.id, { enabled: !template.enabled });
    if (!response.ok) { setError(response.error || "تعذر تغيير حالة القالب."); return; }
    await load();
  }

  async function publish(template: MetadataTemplate) {
    const response = await api.publishMetadataTemplate(template.id);
    if (!response.ok) { setError(response.error || "تعذر نشر القالب."); return; }
    await load();
  }

  async function restorePublished(version: MetadataTemplateVersion) {
    if (!editing) return;
    const response = await api.restorePublishedMetadataTemplate(editing.id, version.version);
    if (!response.ok) { setError(response.error || "تعذر استعادة الإصدار المنشور."); return; }
    await load();
  }

  const preview = editing ? previewTemplateApplication({ description: "", type: "", tags: [], metadata: {} }, editing) : null;

  return (
    <AppShell subtitle="قوالب الأقسام" contentClassName="local-list-content" tipsPage="settings">
      <PageToolbar eyebrow={<span className="badge">إدارة مركزية</span>} title="مكتبة قوالب الأقسام" description="قوالب قابلة لإعادة الاستخدام حسب القسم، مع أدوار استخدام وإصدارات محفوظة. تعديل قالب لا يغيّر أي مادة محفوظة سابقًا." actions={<a className="button button-secondary" href="/settings">الإعدادات</a>}>
        <label><span>تصفية القسم</span><input className="search-input" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} placeholder="مثال: news" /></label>
      </PageToolbar>

      {error ? <div className="state-banner state-banner-error" role="alert">{error}</div> : null}

      {canManageTemplates ? (
        <form className="panel archive-toolbar-grid" onSubmit={save}>
          <div className="panel-title-row"><div><h2>{editing ? "تعديل القالب" : "قالب قسم جديد"}</h2><p>اختر القسم قبل الحفظ وحدد من يستطيع استعماله.</p></div>{editing ? <button className="button button-secondary button-sm" type="button" onClick={resetForm}>قالب جديد</button> : null}</div>
          <label><span>الاسم</span><input className="search-input" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label><span>القسم المالك</span><input className="search-input" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required /></label>
          <label><span>نوع المادة (اختياري)</span><input className="search-input" value={typeId} onChange={(event) => setTypeId(event.target.value)} /></label>
          <label><span>الوسوم الافتراضية</span><input className="search-input" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="خبر، عاجل" /></label>
          <label><span>أدوار الاستخدام</span><select multiple value={usageRoles} onChange={(event) => setUsageRoles(Array.from(event.target.selectedOptions, (option) => option.value as Role))}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <label className="full-span"><span>الحقول الافتراضية (JSON)</span><textarea className="search-input" value={fields} onChange={(event) => setFields(event.target.value)} rows={5} dir="ltr" /></label>
          <label><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> متاح للاستخدام</label>
          <div className="archive-toolbar-actions"><button className="button button-primary" type="submit" disabled={!name.trim() || !departmentId.trim()}>{editing ? "حفظ إصدار جديد" : "إنشاء القالب"}</button></div>
        </form>
      ) : null}

      <section className="split-layout">
        <article className="panel">
          <div className="panel-title-row"><div><h2>القوالب المتاحة</h2><p>يعرض المستخدم فقط القوالب التي يسمح بها دوره؛ يرى المحرر أيضًا المعطّلة لإدارتها.</p></div><span className="badge">{templates.length}</span></div>
          {templates.length === 0 ? <EmptyState title="لا توجد قوالب لهذا القسم." description="غيّر التصفية أو أضف أول قالب للقسم." /> : <div className="analytics-tag-list">{templates.map((template) => (
            <div className="analytics-tag-row" key={template.id}><span><strong>{template.name}</strong><small className="helper-text"> · القسم: {template.departmentId || "عام"} · المسودة {template.currentVersion} · المنشور {template.publishedVersion ?? "—"}</small><small className="helper-text"> · {template.tags.join("، ") || "بلا وسوم"}</small></span><div className="button-row"><span className={`badge ${template.enabled ? "badge-success" : "badge-warning"}`}>{template.enabled ? "مفعل" : "معطل"}</span><button className="button button-secondary button-sm" type="button" onClick={() => void showVersions(template)}>الإصدارات</button>{canPublishTemplates ? <button className="button button-primary button-sm" type="button" onClick={() => void publish(template)}>نشر المسودة</button> : null}{canManageTemplates ? <><button className="button button-secondary button-sm" type="button" onClick={() => beginEdit(template)}>تعديل</button><button className="button button-secondary button-sm" type="button" onClick={() => void toggle(template)}>{template.enabled ? "تعطيل" : "تفعيل"}</button></> : null}</div></div>
          ))}</div>}
        </article>
        <article className="panel"><div className="panel-title-row"><div><h2>معاينة القيم والإصدارات</h2><p>المعاينة للقراءة فقط؛ لا تكتب أي بيانات في مادة قبل قرار المستخدم.</p></div></div>
          {preview ? <pre className="code-block">{JSON.stringify(preview, null, 2)}</pre> : <p className="helper-text">اختر «تعديل» لمعاينة قيم القالب الحالية.</p>}
          {versions.length ? <ol className="helper-text">{versions.map((version) => <li key={version.id}>الإصدار {version.version} — {new Date(version.createdAt).toLocaleString("ar")} — {version.snapshot.name} {canPublishTemplates ? <button className="button button-secondary button-sm" type="button" onClick={() => void restorePublished(version)}>استعادة كنشر</button> : null}</li>)}</ol> : null}
        </article>
      </section>
      <DepartmentQualityPanel departmentId={departmentId} />
      {metrics ? <article className="panel"><h2>مؤشرات القسم</h2><div className="button-row"><span className="badge">{metrics.templateCount} قالب</span><span className="badge">{metrics.publishedTemplateCount} منشور</span><span className="badge">{metrics.qualityRuleCount} قاعدة جودة</span><span className="badge">{metrics.recordCount} مادة</span></div><p className="helper-text">الحقول الناقصة: {Object.entries(metrics.missingFieldCounts).map(([field, count]) => `${field}: ${count}`).join(" · ") || "لا توجد قواعد مفعلة"}</p></article> : null}
      {canManageTemplates && departmentId ? <article className="panel"><div className="panel-title-row"><div><h2>مالكية الحقول</h2><p>يُقترح المسؤول في طلبات المعلومات؛ لا يمنع ذلك المحرر المخوّل من التصحيح أو الإسناد الصريح.</p></div></div><div className="button-row"><input className="search-input" value={ownerField} onChange={(event) => setOwnerField(event.target.value)} placeholder="اسم الحقل أو * لكل الحقول" /><input className="search-input" value={ownerAssignee} onChange={(event) => setOwnerAssignee(event.target.value)} placeholder="المسؤول" /><button className="button button-primary button-sm" type="button" onClick={() => void addFieldOwner()}>حفظ المسؤول</button></div>{fieldOwners.map((owner) => <div className="analytics-tag-row" key={owner.id}><span>{owner.field} · {owner.owner}</span><button className="button button-secondary button-sm" type="button" onClick={() => void api.replaceDepartmentFieldOwners(departmentId, fieldOwners.filter((item) => item.id !== owner.id)).then((response) => response.ok && setFieldOwners(response.owners))}>إزالة</button></div>)}</article> : null}
    </AppShell>
  );
}
