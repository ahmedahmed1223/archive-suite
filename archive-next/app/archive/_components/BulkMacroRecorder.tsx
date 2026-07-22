"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArchiveApiClient, BulkMacro, BulkMacroPreview, BulkMacroRun, BulkMacroStep, BulkMacroTarget } from "@/lib/archive-api";
import { bulkMacroStepLabel } from "./bulk-macro-helpers";

type Props = { api: ArchiveApiClient; targets: BulkMacroTarget[]; accessToken?: string };
const statuses = ["draft", "editing", "review", "approved", "published", "archived"] as const;

export function BulkMacroRecorder({ api, targets, accessToken }: Props) {
  const auth = accessToken ? { accessToken } : undefined;
  const [macros, setMacros] = useState<BulkMacro[]>([]);
  const [macroId, setMacroId] = useState("");
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<BulkMacroStep[]>([]);
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("draft");
  const [preview, setPreview] = useState<BulkMacroPreview | null>(null);
  const [run, setRun] = useState<BulkMacroRun | null>(null);
  const [message, setMessage] = useState("");
  const targetKey = useMemo(() => targets.map((target) => `${target.store}:${target.id}`).join("|"), [targets]);

  const loadMacros = async () => {
    const response = await api.bulkMacros(auth);
    if (response.ok) setMacros(response.macros);
    else setMessage(response.error);
  };
  useEffect(() => { void loadMacros(); }, []); // owned list is loaded once; changes are updated locally
  useEffect(() => { setPreview(null); setRun(null); }, [targetKey, macroId, steps]);

  const chooseMacro = (id: string) => {
    setMacroId(id);
    const selected = macros.find((macro) => macro.id === id);
    if (selected) { setName(selected.name); setSteps(selected.steps); }
  };
  const addStep = (step: BulkMacroStep) => setSteps((current) => current.length < 10 ? [...current, step] : current);
  const moveStep = (index: number, delta: -1 | 1) => setSteps((current) => {
    const next = [...current]; const target = index + delta;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const save = async () => {
    if (!name.trim() || !steps.length) { setMessage("أدخل اسمًا وأضف خطوة واحدة على الأقل."); return; }
    const response = macroId
      ? await api.updateBulkMacro(macroId, { name: name.trim(), steps }, auth)
      : await api.createBulkMacro({ name: name.trim(), steps }, auth);
    if (!response.ok) { setMessage(response.error); return; }
    setMacroId(response.macro.id); setMacros((current) => [...current.filter((item) => item.id !== response.macro.id), response.macro]);
    setMessage("تم حفظ الماكرو.");
  };
  const requestPreview = async () => {
    if (!macroId || !targets.length) { setMessage("اختر ماكرو وسجلات للمعاينة أولاً."); return; }
    const response = await api.previewBulkMacro(macroId, { targets }, auth);
    if (!response.ok) { setMessage(response.error); return; }
    setPreview(response); setMessage("المعاينة جاهزة. راجع النتائج قبل التنفيذ.");
  };
  const execute = async () => {
    if (!preview || !macroId) return;
    const response = await api.runBulkMacro(macroId, { targets, previewToken: preview.previewToken }, auth);
    if (!response.ok) { setMessage(response.error); setPreview(null); return; }
    setRun(response.run); setPreview(null); setMessage("تم تنفيذ الماكرو وحفظ النتيجة.");
  };

  return <section className="panel panel-compact" aria-label="مسجل الإجراءات الجماعية" dir="rtl">
    <h2>مسجل الإجراءات الجماعية</h2>
    <p className="helper-text">الأهداف الحالية: {targets.length}. يجب طلب معاينة موقعة قبل التنفيذ.</p>
    <div className="button-row"><select aria-label="الماكرو المحفوظ" value={macroId} onChange={(event) => chooseMacro(event.target.value)}><option value="">ماكرو جديد</option>{macros.map((macro) => <option key={macro.id} value={macro.id}>{macro.name}</option>)}</select><input aria-label="اسم الماكرو" value={name} onChange={(event) => setName(event.target.value)} placeholder="اسم الماكرو" /></div>
    <div className="button-row"><input aria-label="الوسم الجديد" value={tag} onChange={(event) => setTag(event.target.value)} placeholder="وسم" /><button type="button" className="button button-secondary" onClick={() => { if (tag.trim()) { addStep({ type: "add-tag", tag: tag.trim() }); setTag(""); } }}>إضافة وسم</button><select aria-label="حالة سير العمل" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{statuses.map((value) => <option key={value}>{value}</option>)}</select><button type="button" className="button button-secondary" onClick={() => addStep({ type: "set-workflow-status", status })}>إضافة حالة</button><button type="button" className="button button-danger" onClick={() => addStep({ type: "delete" })}>إضافة حذف</button></div>
    <ol aria-label="خطوات الماكرو">{steps.map((step, index) => <li key={`${step.type}-${index}`}>{bulkMacroStepLabel(step)} <button type="button" aria-label={`نقل الخطوة ${index + 1} للأعلى`} onClick={() => moveStep(index, -1)}>↑</button><button type="button" aria-label={`نقل الخطوة ${index + 1} للأسفل`} onClick={() => moveStep(index, 1)}>↓</button><button type="button" aria-label={`إزالة الخطوة ${index + 1}`} onClick={() => setSteps((current) => current.filter((_, position) => position !== index))}>إزالة</button></li>)}</ol>
    <div className="button-row"><button type="button" className="button button-secondary" onClick={() => void save()}>حفظ الماكرو</button><button type="button" className="button" disabled={!macroId || !targets.length} onClick={() => void requestPreview()}>معاينة التنفيذ</button><button type="button" className="button button-danger" disabled={!preview} onClick={() => void execute()}>تنفيذ الماكرو</button></div>
    {preview ? <div role="status" className="state-banner"><strong>معاينة موقعة</strong><span>يتأثر: {preview.summary.affectedCount}، مفقود: {preview.summary.missingCount}، تنتهي: {new Date(preview.expiresAt).toLocaleString("ar")}</span><ul>{preview.results.map((result) => <li key={`${result.store}:${result.id}`}>{result.store}/{result.id}: {result.status}</li>)}</ul></div> : null}
    {run ? <div role="status" className="state-banner state-banner-success">نتيجة التنفيذ: اكتمل {run.completedCount}، فشل {run.failedCount} من {run.targetCount}.</div> : null}
    {message ? <p role="status" aria-live="polite" className="helper-text">{message}</p> : null}
  </section>;
}
