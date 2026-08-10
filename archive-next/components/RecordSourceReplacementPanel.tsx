"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createArchiveApiClient } from "@/lib/archive-api";

export default function RecordSourceReplacementPanel({ recordId, canEdit }: Readonly<{ recordId: string; canEdit: boolean }>) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [versions, setVersions] = useState<{ id: string; createdAt: string; fileName: string }[]>([]);
  const api = useMemo(() => createArchiveApiClient(), []);
  useEffect(() => { void api.recordSourceVersions(recordId).then((result) => { if (result.ok) setVersions(result.versions); }); }, [api, recordId]);
  const replace = async () => {
    const file = input.current?.files?.[0];
    if (!file) return setMessage("اختر ملف المصدر البديل أولاً.");
    setState("saving");
    const result = await api.replaceRecordSource(recordId, file);
    if (!result.ok) { setState("error"); return setMessage(result.error || "تعذر استبدال المصدر."); }
    setState("success"); setMessage("تم استبدال المصدر مع حفظ نسخة قابلة للاستعادة؛ هوية المادة وعلاقاتها لم تتغير.");
  };
  const restore = async (versionId: string) => { setState("saving"); const result = await api.restoreRecordSource(recordId, versionId); if (!result.ok) { setState("error"); return setMessage(result.error || "تعذرت الاستعادة."); } setState("success"); setMessage("استعيد المصدر السابق بنجاح."); };
  return <section className="panel" aria-label="استبدال ملف المصدر">
    <div className="panel-title-row"><div><h2>استبدال ملف المصدر</h2><p>يحفظ المصدر السابق ويُبقي هوية المادة وتعليقاتها وحقوقها وروابطها كما هي.</p></div><RefreshCw size={20} aria-hidden="true" /></div>
    {canEdit ? <div className="button-row"><input ref={input} type="file" aria-label="ملف المصدر البديل" /><button type="button" className="button button-secondary" onClick={() => void replace()} disabled={state === "saving"}>{state === "saving" ? "جار الاستبدال..." : "استبدال المصدر"}</button></div> : <p className="helper-text">تحتاج صلاحية التحرير لاستبدال المصدر.</p>}
    {message && <p className="helper-text" role={state === "error" ? "alert" : "status"}>{message}</p>}
    {versions.length > 0 && <div className="table-wrap"><table><thead><tr><th>المصدر السابق</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody>{versions.map((version) => <tr key={version.id}><td>{version.fileName}</td><td>{new Date(version.createdAt).toLocaleString("ar-SA")}</td><td>{canEdit && <button type="button" className="button button-secondary button-sm" onClick={() => void restore(version.id)} disabled={state === "saving"}>استعادة</button>}</td></tr>)}</tbody></table></div>}
  </section>;
}
