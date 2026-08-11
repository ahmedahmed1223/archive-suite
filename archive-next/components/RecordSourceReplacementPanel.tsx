"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createArchiveApiClient } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function RecordSourceReplacementPanel({ recordId, canEdit }: Readonly<{ recordId: string; canEdit: boolean }>) {
  const { locale, t } = useLocale();
  const copy = t.pages.archiveDetail.sourceReplacement;
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [versions, setVersions] = useState<{ id: string; createdAt: string; fileName: string }[]>([]);
  const api = useMemo(() => createArchiveApiClient(), []);
  useEffect(() => { void api.recordSourceVersions(recordId).then((result) => { if (result.ok) setVersions(result.versions); }); }, [api, recordId]);
  const replace = async () => {
    const file = input.current?.files?.[0];
    if (!file) return setMessage(copy.fileRequired);
    setState("saving");
    const result = await api.replaceRecordSource(recordId, file);
    if (!result.ok) { setState("error"); return setMessage(result.error || copy.replaceError); }
    setState("success"); setMessage(copy.replaceSuccess);
  };
  const restore = async (versionId: string) => { setState("saving"); const result = await api.restoreRecordSource(recordId, versionId); if (!result.ok) { setState("error"); return setMessage(result.error || copy.restoreError); } setState("success"); setMessage(copy.restoreSuccess); };
  return <section className="panel" aria-label={copy.ariaLabel}>
    <div className="panel-title-row"><div><h2>{copy.title}</h2><p>{copy.description}</p></div><RefreshCw size={20} aria-hidden="true" /></div>
    {canEdit ? <div className="button-row"><input ref={input} type="file" aria-label={copy.inputAriaLabel} /><button type="button" className="button button-secondary" onClick={() => void replace()} disabled={state === "saving"}>{state === "saving" ? copy.replacing : copy.replace}</button></div> : <p className="helper-text">{copy.permissionHint}</p>}
    {message && <p className="helper-text" role={state === "error" ? "alert" : "status"}>{message}</p>}
    {versions.length > 0 && <div className="table-wrap"><table><thead><tr><th>{copy.previousSource}</th><th>{copy.date}</th><th>{copy.action}</th></tr></thead><tbody>{versions.map((version) => <tr key={version.id}><td>{version.fileName}</td><td>{new Date(version.createdAt).toLocaleString(locale === "en" ? "en-US" : "ar-SA")}</td><td>{canEdit && <button type="button" className="button button-secondary button-sm" onClick={() => void restore(version.id)} disabled={state === "saving"}>{copy.restore}</button>}</td></tr>)}</tbody></table></div>}
  </section>;
}
