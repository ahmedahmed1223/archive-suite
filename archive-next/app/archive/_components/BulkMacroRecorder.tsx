"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveApiClient, BulkMacro, BulkMacroPreview, BulkMacroRun, BulkMacroStep, BulkMacroTarget } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { bulkMacroDefinitionKey, bulkMacroReasonLabel, bulkMacroStatusLabel, bulkMacroStepLabel, bulkMacroStepTypeLabel, bulkMacroValueLabel, type BulkMacroRecorderCopy } from "./bulk-macro-helpers";

type Props = { api: ArchiveApiClient; targets: BulkMacroTarget[]; accessToken?: string };
const statuses = ["draft", "editing", "review", "approved", "published", "archived"] as const;

function ResultDetails({ results, copy, locale }: { results: BulkMacroRun["results"] | BulkMacroPreview["results"]; copy: BulkMacroRecorderCopy; locale: "ar" | "en" }) {
  return <ul>{results.map((result) => <li key={`${result.store}:${result.id}`}>
    <strong>{result.store}/{result.id}: {bulkMacroStatusLabel(result.status, copy)}</strong>
    {result.reason ? <p>{copy.recordReasonLabel}: {bulkMacroReasonLabel(result.reason, copy)}</p> : null}
    <ol>{result.steps.map((outcome) => <li key={outcome.index}>
      {outcome.index + 1}. {bulkMacroStepTypeLabel(outcome.type, copy)}: {bulkMacroStatusLabel(outcome.status, copy)}
      {" — "}{outcome.reversible ? copy.reversible : copy.irreversible}
      {outcome.reason ? ` — ${copy.reasonLabel}: ${bulkMacroReasonLabel(outcome.reason, copy)}` : ""}
      <dl><dt>{copy.beforeLabel}</dt><dd>{bulkMacroValueLabel(outcome.before, copy, locale)}</dd><dt>{copy.afterLabel}</dt><dd>{bulkMacroValueLabel(outcome.after, copy, locale)}</dd></dl>
    </li>)}</ol>
  </li>)}</ul>;
}

function RunDetails({ entry, heading, copy, locale }: { entry: BulkMacroRun; heading: string; copy: BulkMacroRecorderCopy; locale: "ar" | "en" }) {
  return <article aria-label={heading}><strong>{heading}</strong><p>{copy.runSummary.replace("{completed}", String(entry.completedCount)).replace("{failed}", String(entry.failedCount)).replace("{total}", String(entry.targetCount))}</p><ResultDetails results={entry.results} copy={copy} locale={locale} /></article>;
}

export function BulkMacroRecorder({ api, targets, accessToken }: Props) {
  const { locale, t } = useLocale();
  const auth = useMemo(() => (accessToken ? { accessToken } : undefined), [accessToken]);
  const [macros, setMacros] = useState<BulkMacro[]>([]);
  const [macroId, setMacroId] = useState("");
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<BulkMacroStep[]>([]);
  const [persistedDefinition, setPersistedDefinition] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("draft");
  const [preview, setPreview] = useState<BulkMacroPreview | null>(null);
  const [run, setRun] = useState<BulkMacroRun | null>(null);
  const [history, setHistory] = useState<BulkMacroRun[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const pending = useRef({ save: false, preview: false, run: false });
  const targetKey = useMemo(() => targets.map((target) => `${target.store}:${target.id}`).join("|"), [targets]);
  const definition = useMemo(() => bulkMacroDefinitionKey(name, steps), [name, steps]);
  const dirty = !macroId || definition !== persistedDefinition;
  const previewExpired = preview ? new Date(preview.expiresAt).getTime() <= clock : false;
  const canPreview = Boolean(macroId && targets.length && !dirty && !saving && !previewing && !running);
  const canRun = Boolean(preview && !previewExpired && !dirty && !saving && !previewing && !running);

  useEffect(() => { void (async () => { const response = await api.bulkMacros(auth); if (response.ok) setMacros(response.macros); else setMessage(response.error); })(); }, [api, auth]);
  useEffect(() => { setPreview(null); setRun(null); }, [targetKey, macroId, definition]);
  useEffect(() => {
    if (!preview) return;
    const expiresAt = new Date(preview.expiresAt).getTime();
    const delay = expiresAt - Date.now();
    if (delay <= 0) return;
    const timer = window.setTimeout(() => setClock(Date.now()), Math.min(delay, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [preview, clock]);

  const loadHistory = async (id: string) => {
    const response = await api.bulkMacroRuns(id, auth);
    if (response.ok) setHistory(response.runs); else setMessage(response.error);
  };
  const chooseMacro = (id: string) => {
    setMacroId(id); setPreview(null); setRun(null);
    const selected = macros.find((macro) => macro.id === id);
    if (selected) { setName(selected.name); setSteps(selected.steps); setPersistedDefinition(bulkMacroDefinitionKey(selected.name, selected.steps)); void loadHistory(id); }
    else { setName(""); setSteps([]); setPersistedDefinition(""); setHistory([]); }
  };
  const addStep = (step: BulkMacroStep) => setSteps((current) => current.length < 10 ? [...current, step] : current);
  const moveStep = (index: number, delta: -1 | 1) => setSteps((current) => {
    const next = [...current]; const target = index + delta;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const save = async () => {
    if (pending.current.save || pending.current.preview || pending.current.run) return;
    if (!name.trim() || !steps.length) { setMessage(t.pages.bulkMacroRecorder.validationError); return; }
    pending.current.save = true; setSaving(true); setPreview(null);
    try {
      const response = macroId ? await api.updateBulkMacro(macroId, { name: name.trim(), steps }, auth) : await api.createBulkMacro({ name: name.trim(), steps }, auth);
      if (!response.ok) { setMessage(response.error); return; }
      const saved = response.macro;
      setMacroId(saved.id); setName(saved.name); setSteps(saved.steps); setPersistedDefinition(bulkMacroDefinitionKey(saved.name, saved.steps));
      setMacros((current) => [...current.filter((item) => item.id !== saved.id), saved]);
      void loadHistory(saved.id); setMessage(t.pages.bulkMacroRecorder.macroSaved);
    } finally { pending.current.save = false; setSaving(false); }
  };
  const requestPreview = async () => {
    if (!canPreview || pending.current.save || pending.current.preview || pending.current.run) return;
    pending.current.preview = true; setPreviewing(true);
    try {
      const response = await api.previewBulkMacro(macroId, { targets }, auth);
      if (!response.ok) { setMessage(response.error); return; }
      setClock(Date.now()); setPreview(response); setMessage(t.pages.bulkMacroRecorder.previewReady);
    } finally { pending.current.preview = false; setPreviewing(false); }
  };
  const execute = async () => {
    if (!canRun || !preview || pending.current.save || pending.current.preview || pending.current.run) return;
    pending.current.run = true; setRunning(true);
    try {
      const response = await api.runBulkMacro(macroId, { targets, previewToken: preview.previewToken }, auth);
      if (!response.ok) { setMessage(response.error); setPreview(null); return; }
      setRun(response.run); setHistory((current) => [response.run, ...current.filter((item) => item.id !== response.run.id)]); setPreview(null); setMessage(t.pages.bulkMacroRecorder.runComplete);
    } finally { pending.current.run = false; setRunning(false); }
  };
  const removeMacro = async () => {
    if (!macroId) return;
    const response = await api.deleteBulkMacro(macroId, auth);
    if (!response.ok) { setMessage(response.error); return; }
    setMacros((current) => current.filter((item) => item.id !== macroId)); chooseMacro(""); setMessage(t.pages.bulkMacroRecorder.macroDeleted);
  };

  const rt = t.pages.bulkMacroRecorder;
  return <section className="panel panel-compact" aria-label={rt.title}>
    <h2>{rt.title}</h2>
    <p className="helper-text">{rt.targetsSummary.replace("{count}", String(targets.length))}</p>
    <div className="button-row"><select aria-label={rt.savedMacroLabel} value={macroId} onChange={(event) => chooseMacro(event.target.value)}><option value="">{rt.newMacroOption}</option>{macros.map((macro) => <option key={macro.id} value={macro.id}>{macro.name}</option>)}</select><input aria-label={rt.macroNameLabel} value={name} onChange={(event) => setName(event.target.value)} placeholder={rt.macroNameLabel} />{macroId ? <button type="button" className="button button-secondary" onClick={() => void removeMacro()}>{rt.deleteMacroButton}</button> : null}</div>
    <div className="button-row"><input aria-label={rt.newTagLabel} value={tag} onChange={(event) => setTag(event.target.value)} placeholder={rt.tagPlaceholder} /><button type="button" className="button button-secondary" onClick={() => { if (tag.trim()) { addStep({ type: "add-tag", tag: tag.trim() }); setTag(""); } }}>{rt.addTagButton}</button><select aria-label={rt.workflowStatusLabel} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{statuses.map((value) => <option key={value} value={value}>{bulkMacroStatusLabel(value, rt)}</option>)}</select><button type="button" className="button button-secondary" onClick={() => addStep({ type: "set-workflow-status", status })}>{rt.addStatusButton}</button><button type="button" className="button button-danger" onClick={() => addStep({ type: "delete" })}>{rt.addDeleteButton}</button></div>
    <ol aria-label={rt.stepsListLabel}>{steps.map((step, index) => <li key={`${step.type}-${index}`}>{bulkMacroStepLabel(step, rt)} <button type="button" aria-label={rt.moveStepUp.replace("{index}", String(index + 1))} onClick={() => moveStep(index, -1)}>↑</button><button type="button" aria-label={rt.moveStepDown.replace("{index}", String(index + 1))} onClick={() => moveStep(index, 1)}>↓</button><button type="button" aria-label={rt.removeStepAria.replace("{index}", String(index + 1))} onClick={() => setSteps((current) => current.filter((_, position) => position !== index))}>{rt.removeStepButton}</button></li>)}</ol>
    {dirty && macroId ? <p role="status" className="helper-text">{rt.unsavedChanges}</p> : null}
    <div className="button-row"><button type="button" className="button button-secondary" disabled={saving} onClick={() => void save()}>{saving ? rt.savingMacroButton : rt.saveMacroButton}</button><button type="button" className="button" disabled={!canPreview} onClick={() => void requestPreview()}>{previewing ? rt.previewingMacroButton : rt.previewMacroButton}</button><button type="button" className="button button-danger" disabled={!canRun} onClick={() => void execute()}>{running ? rt.runningMacroButton : rt.runMacroButton}</button></div>
    {preview ? <div role="status" className="state-banner"><strong>{rt.signedPreviewBadge}</strong><span>{rt.previewSummary.replace("{affected}", String(preview.summary.affectedCount)).replace("{missing}", String(preview.summary.missingCount)).replace("{expires}", new Date(preview.expiresAt).toLocaleString(locale))}</span>{previewExpired ? <p role="alert">{rt.previewExpired}</p> : null}<p className="helper-text">{rt.deleteReversibilityNote}</p><ResultDetails results={preview.results} copy={rt} locale={locale} /></div> : null}
    {run ? <div role="status" className="state-banner state-banner-success"><RunDetails entry={run} heading={rt.runResultHeading} copy={rt} locale={locale} /></div> : null}
    {macroId ? <section aria-label={rt.runHistoryLabel}><h3>{rt.runHistoryLabel}</h3>{history.length ? history.map((entry, index) => <RunDetails key={entry.id} entry={entry} heading={rt.savedRunHeading.replace("{index}", String(index + 1))} copy={rt} locale={locale} />) : <p className="helper-text">{rt.noSavedRuns}</p>}</section> : null}
    {message ? <p role="status" aria-live="polite" className="helper-text">{message}</p> : null}
  </section>;
}
