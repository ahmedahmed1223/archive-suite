"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createArchiveApiClient } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
export default function RecordChangeImpactPanel({ recordId, canEdit }: Readonly<{ recordId: string; canEdit: boolean }>) {
  const { t } = useLocale();
  const copy = t.pages.archiveDetail.recordChangeImpact;
  const [result, setResult] = useState<{ blocked: boolean; reason: string | null; relations: { id: string; type: string }[]; shares: number; segments: number; reports: number } | null>(null);
  const preview = async () => { const response = await createArchiveApiClient().previewRecordChangeImpact(recordId, "delete"); if (response.ok) setResult(response); };
  return <section className="panel" aria-label={copy.ariaLabel}><div className="panel-title-row"><div><h2>{copy.title}</h2><p>{copy.description}</p></div><AlertTriangle size={20} aria-hidden="true" /></div>{canEdit && <button type="button" className="button button-secondary" onClick={() => void preview()}>{copy.inspect}</button>}{result && <p className="helper-text" role={result.blocked ? "alert" : "status"}>{copy.summary.replace("{status}", result.blocked ? copy.blocked : copy.clear).replace("{relations}", String(result.relations.length)).replace("{shares}", String(result.shares)).replace("{segments}", String(result.segments)).replace("{reports}", String(result.reports))}</p>}</section>;
}
