"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveApiClient, BulkMacro, BulkMacroPreview, BulkMacroRun, BulkMacroStep, BulkMacroTarget } from "@/lib/archive-api";
import { bulkMacroDefinitionKey, bulkMacroReasonLabel, bulkMacroStatusLabel, bulkMacroStepLabel, bulkMacroStepTypeLabel, bulkMacroValueLabel } from "./bulk-macro-helpers";

type Props = { api: ArchiveApiClient; targets: BulkMacroTarget[]; accessToken?: string };
const statuses = ["draft", "editing", "review", "approved", "published", "archived"] as const;

function ResultDetails({ results }: { results: BulkMacroRun["results"] | BulkMacroPreview["results"] }) {
  return <ul>{results.map((result) => <li key={`${result.store}:${result.id}`}>
    <strong>{result.store}/{result.id}: {bulkMacroStatusLabel(result.status)}</strong>
    {result.reason ? <p>سبب نتيجة السجل: {bulkMacroReasonLabel(result.reason)}</p> : null}
    <ol>{result.steps.map((outcome) => <li key={outcome.index}>
      {outcome.index + 1}. {bulkMacroStepTypeLabel(outcome.type)}: {bulkMacroStatusLabel(outcome.status)}
      {" — "}{outcome.reversible ? "قابل للتراجع" : "غير قابل للتراجع"}
      {outcome.reason ? ` — السبب: ${bulkMacroReasonLabel(outcome.reason)}` : ""}
      <dl><dt>قبل</dt><dd>{bulkMacroValueLabel(outcome.before)}</dd><dt>بعد</dt><dd>{bulkMacroValueLabel(outcome.after)}</dd></dl>
    </li>)}</ol>
  </li>)}</ul>;
}

function RunDetails({ entry, heading }: { entry: BulkMacroRun; heading: string }) {
  return <article aria-label={heading}><strong>{heading}</strong><p>اكتمل {entry.completedCount}، فشل {entry.failedCount} من {entry.targetCount}.</p><ResultDetails results={entry.results} /></article>;
}

export function BulkMacroRecorder({ api, targets, accessToken }: Props) {
  const auth = accessToken ? { accessToken } : undefined;
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

  useEffect(() => { void (async () => { const response = await api.bulkMacros(auth); if (response.ok) setMacros(response.macros); else setMessage(response.error); })(); }, []);
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
    if (!name.trim() || !steps.length) { setMessage("أدخل اسمًا وأضف خطوة واحدة على الأقل."); return; }
    pending.current.save = true; setSaving(true); setPreview(null);
    try {
      const response = macroId ? await api.updateBulkMacro(macroId, { name: name.trim(), steps }, auth) : await api.createBulkMacro({ name: name.trim(), steps }, auth);
      if (!response.ok) { setMessage(response.error); return; }
      const saved = response.macro;
      setMacroId(saved.id); setName(saved.name); setSteps(saved.steps); setPersistedDefinition(bulkMacroDefinitionKey(saved.name, saved.steps));
      setMacros((current) => [...current.filter((item) => item.id !== saved.id), saved]);
      void loadHistory(saved.id); setMessage("تم حفظ الماكرو.");
    } finally { pending.current.save = false; setSaving(false); }
  };
  const requestPreview = async () => {
    if (!canPreview || pending.current.save || pending.current.preview || pending.current.run) return;
    pending.current.preview = true; setPreviewing(true);
    try {
      const response = await api.previewBulkMacro(macroId, { targets }, auth);
      if (!response.ok) { setMessage(response.error); return; }
      setClock(Date.now()); setPreview(response); setMessage("المعاينة جاهزة. راجع النتائج قبل التنفيذ.");
    } finally { pending.current.preview = false; setPreviewing(false); }
  };
  const execute = async () => {
    if (!canRun || !preview || pending.current.save || pending.current.preview || pending.current.run) return;
    pending.current.run = true; setRunning(true);
    try {
      const response = await api.runBulkMacro(macroId, { targets, previewToken: preview.previewToken }, auth);
      if (!response.ok) { setMessage(response.error); setPreview(null); return; }
      setRun(response.run); setHistory((current) => [response.run, ...current.filter((item) => item.id !== response.run.id)]); setPreview(null); setMessage("تم تنفيذ الماكرو وحفظ النتيجة.");
    } finally { pending.current.run = false; setRunning(false); }
  };
  const removeMacro = async () => {
    if (!macroId) return;
    const response = await api.deleteBulkMacro(macroId, auth);
    if (!response.ok) { setMessage(response.error); return; }
    setMacros((current) => current.filter((item) => item.id !== macroId)); chooseMacro(""); setMessage("تم حذف الماكرو المحفوظ.");
  };

  return <section className="panel panel-compact" aria-label="مسجل الإجراءات الجماعية" dir="rtl">
    <h2>مسجل الإجراءات الجماعية</h2>
    <p className="helper-text">الأهداف الحالية: {targets.length}. يجب طلب معاينة موقعة قبل التنفيذ.</p>
    <div className="button-row"><select aria-label="الماكرو المحفوظ" value={macroId} onChange={(event) => chooseMacro(event.target.value)}><option value="">ماكرو جديد</option>{macros.map((macro) => <option key={macro.id} value={macro.id}>{macro.name}</option>)}</select><input aria-label="اسم الماكرو" value={name} onChange={(event) => setName(event.target.value)} placeholder="اسم الماكرو" />{macroId ? <button type="button" className="button button-secondary" onClick={() => void removeMacro()}>حذف الماكرو</button> : null}</div>
    <div className="button-row"><input aria-label="الوسم الجديد" value={tag} onChange={(event) => setTag(event.target.value)} placeholder="وسم" /><button type="button" className="button button-secondary" onClick={() => { if (tag.trim()) { addStep({ type: "add-tag", tag: tag.trim() }); setTag(""); } }}>إضافة وسم</button><select aria-label="حالة سير العمل" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{statuses.map((value) => <option key={value} value={value}>{bulkMacroStatusLabel(value)}</option>)}</select><button type="button" className="button button-secondary" onClick={() => addStep({ type: "set-workflow-status", status })}>إضافة حالة</button><button type="button" className="button button-danger" onClick={() => addStep({ type: "delete" })}>إضافة حذف</button></div>
    <ol aria-label="خطوات الماكرو">{steps.map((step, index) => <li key={`${step.type}-${index}`}>{bulkMacroStepLabel(step)} <button type="button" aria-label={`نقل الخطوة ${index + 1} للأعلى`} onClick={() => moveStep(index, -1)}>↑</button><button type="button" aria-label={`نقل الخطوة ${index + 1} للأسفل`} onClick={() => moveStep(index, 1)}>↓</button><button type="button" aria-label={`إزالة الخطوة ${index + 1}`} onClick={() => setSteps((current) => current.filter((_, position) => position !== index))}>إزالة</button></li>)}</ol>
    {dirty && macroId ? <p role="status" className="helper-text">لديك تغييرات غير محفوظة؛ احفظها قبل المعاينة.</p> : null}
    <div className="button-row"><button type="button" className="button button-secondary" disabled={saving} onClick={() => void save()}>{saving ? "جارٍ الحفظ…" : "حفظ الماكرو"}</button><button type="button" className="button" disabled={!canPreview} onClick={() => void requestPreview()}>{previewing ? "جارٍ إعداد المعاينة…" : "معاينة التنفيذ"}</button><button type="button" className="button button-danger" disabled={!canRun} onClick={() => void execute()}>{running ? "جارٍ التنفيذ…" : "تنفيذ الماكرو"}</button></div>
    {preview ? <div role="status" className="state-banner"><strong>معاينة موقعة</strong><span>يتأثر: {preview.summary.affectedCount}، مفقود: {preview.summary.missingCount}، تنتهي: {new Date(preview.expiresAt).toLocaleString("ar")}</span>{previewExpired ? <p role="alert">انتهت صلاحية المعاينة. اطلب معاينة جديدة.</p> : null}<p className="helper-text">الحذف ينقل السجل إلى سلة المحذوفات القابلة للاستعادة؛ راجع قابلية التراجع لكل خطوة أدناه.</p><ResultDetails results={preview.results} /></div> : null}
    {run ? <div role="status" className="state-banner state-banner-success"><RunDetails entry={run} heading="نتيجة التنفيذ" /></div> : null}
    {macroId ? <section aria-label="سجل تشغيل الماكرو"><h3>سجل تشغيل الماكرو</h3>{history.length ? history.map((entry, index) => <RunDetails key={entry.id} entry={entry} heading={`تشغيل محفوظ ${index + 1}`} />) : <p className="helper-text">لا توجد عمليات محفوظة بعد.</p>}</section> : null}
    {message ? <p role="status" aria-live="polite" className="helper-text">{message}</p> : null}
  </section>;
}
