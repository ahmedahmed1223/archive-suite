"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type DepartmentQualityPreview, type DepartmentQualityRule } from "@/lib/archive-api";
import { useCapability } from "@/components/RoleGate";

export default function DepartmentQualityPanel({ departmentId }: Readonly<{ departmentId: string }>) {
  const api = useMemo(() => createArchiveApiClient(), []); const canManage = useCapability("templates.manage");
  const [rules, setRules] = useState<DepartmentQualityRule[]>([]); const [typeId, setTypeId] = useState(""); const [fields, setFields] = useState(""); const [preview, setPreview] = useState<DepartmentQualityPreview | null>(null); const [message, setMessage] = useState("");
  const load = useCallback(async () => { if (!departmentId) { setRules([]); return; } const r = await api.departmentQualityRules(departmentId); if (r.ok) setRules(r.rules); else setMessage(r.error || "تعذر تحميل قواعد الجودة."); }, [api, departmentId]);
  useEffect(() => { void load(); }, [load]);
  async function save() { const requiredFields = fields.split(",").map((v) => v.trim()).filter(Boolean); const r = await api.upsertDepartmentQualityRule({ departmentId, typeId: typeId || null, requiredFields, enabled: true }); if (r.ok) { setMessage("حُفظت قاعدة الجودة."); await load(); } else setMessage(r.error || "تعذر حفظ القاعدة."); }
  async function check() { const metadata = Object.fromEntries(fields.split(",").map((v) => v.trim()).filter(Boolean).map((v) => [v, ""])); const r = await api.previewDepartmentQuality({ departmentId, typeId: typeId || null, metadata }); if (r.ok) setPreview(r); else setMessage(r.error || "تعذرت المعاينة."); }
  if (!departmentId) return <p className="helper-text">اختر القسم لعرض قواعد الجودة الخاصة به.</p>;
  return <article className="panel"><div className="panel-title-row"><div><h2>جودة القسم</h2><p>المعاينة تشرح سبب عدم الجاهزية ولا تمنع تعديل السجل.</p></div><span className="badge">{rules.length} قاعدة</span></div>{canManage ? <div className="archive-toolbar-grid"><label><span>نوع المادة</span><input className="search-input" value={typeId} onChange={(e) => setTypeId(e.target.value)} /></label><label><span>الحقول المطلوبة</span><input className="search-input" value={fields} onChange={(e) => setFields(e.target.value)} placeholder="summary, date" /></label><div className="archive-toolbar-actions"><button className="button button-secondary" type="button" onClick={() => void check()}>معاينة النقص</button><button className="button button-primary" type="button" onClick={() => void save()}>حفظ القاعدة</button></div></div> : null}{preview ? <p className={preview.ready ? "state-banner state-banner-success" : "state-banner state-banner-warning"}>{preview.ready ? "جاهز وفق القاعدة." : `غير جاهز: ${preview.missingFields.join("، ")}`}</p> : null}{message ? <p className="helper-text">{message}</p> : null}</article>;
}
