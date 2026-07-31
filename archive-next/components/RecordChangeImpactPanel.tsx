"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createArchiveApiClient } from "@/lib/archive-api";
export default function RecordChangeImpactPanel({ recordId, canEdit }: Readonly<{ recordId: string; canEdit: boolean }>) {
  const [result, setResult] = useState<{ blocked: boolean; reason: string | null; relations: { id: string; type: string }[]; shares: number; segments: number; reports: number } | null>(null);
  const preview = async () => { const response = await createArchiveApiClient().previewRecordChangeImpact(recordId, "delete"); if (response.ok) setResult(response); };
  return <section className="panel" aria-label="معاينة أثر الحذف"><div className="panel-title-row"><div><h2>معاينة أثر الحذف</h2><p>لا تنفذ هذه المعاينة أي تغيير.</p></div><AlertTriangle size={20} aria-hidden="true" /></div>{canEdit && <button type="button" className="button button-secondary" onClick={() => void preview()}>فحص الأثر</button>}{result && <p className="helper-text" role={result.blocked ? "alert" : "status"}>{result.blocked ? "الحذف محظور: توجد علاقات غير محلولة." : "لا يوجد تعارض مانع."} روابط: {result.relations.length}، مشاركات: {result.shares}، مقاطع: {result.segments}، تقارير: {result.reports}</p>}</section>;
}
