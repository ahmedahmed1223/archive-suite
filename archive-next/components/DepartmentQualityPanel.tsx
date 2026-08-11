"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type DepartmentQualityPreview, type DepartmentQualityRule } from "@/lib/archive-api";
import { useCapability } from "@/components/RoleGate";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function DepartmentQualityPanel({ departmentId }: Readonly<{ departmentId: string }>) {
  const { t } = useLocale(); const copy = t.pages.metadataTemplates.quality;
  const api = useMemo(() => createArchiveApiClient(), []); const canManage = useCapability("templates.manage");
  const [rules, setRules] = useState<DepartmentQualityRule[]>([]); const [typeId, setTypeId] = useState(""); const [fields, setFields] = useState(""); const [preview, setPreview] = useState<DepartmentQualityPreview | null>(null); const [message, setMessage] = useState("");
  const load = useCallback(async () => { if (!departmentId) { setRules([]); return; } const r = await api.departmentQualityRules(departmentId); if (r.ok) setRules(r.rules); else setMessage(r.error || copy.loadError); }, [api, departmentId, copy.loadError]);
  useEffect(() => { void load(); }, [load]);
  async function save() { const requiredFields = fields.split(",").map((v) => v.trim()).filter(Boolean); const r = await api.upsertDepartmentQualityRule({ departmentId, typeId: typeId || null, requiredFields, enabled: true }); if (r.ok) { setMessage(copy.saveSuccess); await load(); } else setMessage(r.error || copy.saveError); }
  async function check() { const metadata = Object.fromEntries(fields.split(",").map((v) => v.trim()).filter(Boolean).map((v) => [v, ""])); const r = await api.previewDepartmentQuality({ departmentId, typeId: typeId || null, metadata }); if (r.ok) setPreview(r); else setMessage(r.error || copy.previewError); }
  if (!departmentId) return <p className="helper-text">{copy.selectDepartment}</p>;
  return <article className="panel"><div className="panel-title-row"><div><h2>{copy.title}</h2><p>{copy.description}</p></div><span className="badge">{copy.rules.replace("{count}", String(rules.length))}</span></div>{canManage ? <div className="archive-toolbar-grid"><label><span>{copy.itemType}</span><input className="search-input" value={typeId} onChange={(e) => setTypeId(e.target.value)} /></label><label><span>{copy.requiredFields}</span><input className="search-input" value={fields} onChange={(e) => setFields(e.target.value)} placeholder={copy.requiredFieldsPlaceholder} /></label><div className="archive-toolbar-actions"><button className="button button-secondary" type="button" onClick={() => void check()}>{copy.previewMissing}</button><button className="button button-primary" type="button" onClick={() => void save()}>{copy.saveRule}</button></div></div> : null}{preview ? <p className={preview.ready ? "state-banner state-banner-success" : "state-banner state-banner-warning"}>{preview.ready ? copy.ready : copy.notReady.replace("{fields}", preview.missingFields.join(copy.fieldSeparator))}</p> : null}{message ? <p className="helper-text">{message}</p> : null}</article>;
}
