"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import MetricStrip from "@/components/MetricStrip";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import PageToolbar from "@/components/PageToolbar";
import { useAuthSession } from "@/lib/auth-session";
import { createArchiveApiClient, type SafetyPreviewOperation, type SafetyPreviewRun, type SafetyPreviewScenario, type SafetyPreviewScenarioDescriptor } from "@/lib/archive-api";

const operationLabels: Record<SafetyPreviewOperation, string> = { delete: "حذف تجريبي", restore: "استعادة تجريبية" };
const defaultIds: Record<SafetyPreviewScenario, string> = {
  "bulk-delete-basic": "alpha, bravo, charlie",
  "restore-conflict": "conflict, recoverable, missing"
};

type ScenarioState = { status: "loading" } | { status: "ready"; scenarios: SafetyPreviewScenarioDescriptor[] } | { status: "error"; message: string };
type RunState = { status: "idle" } | { status: "running" } | { status: "ready"; preview: SafetyPreviewRun } | { status: "error"; message: string };

function formatExpiry(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-SA");
}

function resultLabel(result: SafetyPreviewRun["results"][number]) {
  if (result.reason === "conflict") return "تعارض";
  if (result.reason === "not_found") return "غير موجود";
  const completed = "restored" in result ? result.restored : result.deleted;
  return completed ? "تمت المحاكاة" : "دون تغيير";
}

function resultDetail(result: SafetyPreviewRun["results"][number]) {
  if (result.reason === "conflict") return "لا يمكن استعادة المعرف لأن نسخة حية منه موجودة في البيئة الاصطناعية.";
  if (result.reason === "not_found") return "المعرف غير موجود في بيانات المحاكاة الاصطناعية.";
  return "تمت المحاكاة دون أي أثر على الإنتاج.";
}

export default function SafetyPreviewPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const { user, accessToken } = useAuthSession();
  const [scenarioState, setScenarioState] = useState<ScenarioState>({ status: "loading" });
  const [scenario, setScenario] = useState<SafetyPreviewScenario>("bulk-delete-basic");
  const [operation, setOperation] = useState<SafetyPreviewOperation>("delete");
  const [idsText, setIdsText] = useState(defaultIds["bulk-delete-basic"]);
  const [runState, setRunState] = useState<RunState>({ status: "idle" });
  const canRun = user?.role === "admin" || user?.role === "editor";

  const loadScenarios = useCallback(async () => {
    setScenarioState({ status: "loading" });
    try {
      const response = await api.safetyPreviewScenarios({ accessToken });
      if (!response.ok || !response.synthetic) {
        setScenarioState({ status: "error", message: ("error" in response ? response.error : undefined) || "تعذر تحميل سيناريوهات المحاكاة." });
        return;
      }
      setScenarioState({ status: "ready", scenarios: response.scenarios });
      if (response.scenarios[0]) setScenario(response.scenarios[0].id);
    } catch (error) {
      setScenarioState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل سيناريوهات المحاكاة." });
    }
  }, [accessToken, api]);

  useEffect(() => { void loadScenarios(); }, [loadScenarios]);

  function changeScenario(next: SafetyPreviewScenario) {
    setScenario(next);
    setOperation(next === "restore-conflict" ? "restore" : "delete");
    setIdsText(defaultIds[next]);
    setRunState({ status: "idle" });
  }

  async function runPreview() {
    if (!canRun) return;
    const ids = idsText.split(",").map((id) => id.trim()).filter(Boolean);
    if (!ids.length) {
      setRunState({ status: "error", message: "أدخل معرفًا تجريبيًا واحدًا على الأقل." });
      return;
    }
    setRunState({ status: "running" });
    try {
      const response = await api.runSafetyPreview({ scenario, operation, ids }, { accessToken });
      if (!response.ok || !response.synthetic) {
        setRunState({ status: "error", message: ("error" in response ? response.error : undefined) || "تعذر تشغيل المحاكاة." });
        return;
      }
      setRunState({ status: "ready", preview: response });
    } catch (error) {
      setRunState({ status: "error", message: error instanceof Error ? error.message : "تعذر تشغيل المحاكاة." });
    }
  }

  const preview = runState.status === "ready" ? runState.preview : null;
  const disabled = !canRun || scenarioState.status !== "ready" || runState.status === "running";

  return (
    <AppShell subtitle="معاينة السلامة" navLabel="معاينة السلامة" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">Synthetic simulation</span>}
        title="مساحة معاينة السلامة"
        description="محاكاة محمية تستخدم بيانات اصطناعية فقط؛ لا تُحذف أو تُستعاد أي بيانات إنتاجية."
        meta={<span className="badge">synthetic: true</span>}
        actions={<button type="button" className="button button-secondary" onClick={() => void loadScenarios()} disabled={scenarioState.status === "loading"}>تحديث السيناريوهات</button>}
      />

      <OperationalSafetyPanel action="تشغيل محاكاة حذف أو استعادة" dryRun confidence={100} simulationOnly />

      <section className="panel" aria-label="ضوابط محاكاة السلامة">
        <div className="panel-title-row"><div><h2>ضوابط المحاكاة</h2><p>كل المعرفات والنتائج داخل بيئة اصطناعية مؤقتة.</p></div></div>
        {!canRun ? <div className="state-banner state-banner-error" role="alert"><strong>لا تملك صلاحية تشغيل المحاكاة</strong><span className="helper-text">يمكن للمشاهد مراجعة السياسة فقط، بينما التشغيل متاح للمحرر أو المدير.</span></div> : null}
        {scenarioState.status === "error" ? <div className="state-banner state-banner-error" role="alert">{scenarioState.message}</div> : null}
        <div className="archive-toolbar-grid">
          <label><span>السيناريو</span><select aria-label="السيناريو" value={scenario} onChange={(event) => changeScenario(event.target.value as SafetyPreviewScenario)} disabled={scenarioState.status !== "ready" || !canRun}>
            {scenarioState.status === "ready" ? scenarioState.scenarios.map((item) => <option key={item.id} value={item.id}>{item.description}</option>) : <option>جار التحميل...</option>}
          </select></label>
          <label><span>العملية</span><select aria-label="العملية" value={operation} onChange={(event) => setOperation(event.target.value as SafetyPreviewOperation)} disabled={!canRun}>
            <option value="delete">{operationLabels.delete}</option><option value="restore">{operationLabels.restore}</option>
          </select></label>
          <label><span>المعرفات التجريبية</span><input aria-label="المعرفات التجريبية" dir="ltr" value={idsText} onChange={(event) => setIdsText(event.target.value)} disabled={!canRun} /></label>
          <div className="archive-toolbar-actions"><button type="button" className="button button-primary" onClick={() => void runPreview()} disabled={disabled}>{runState.status === "running" ? "جار تشغيل المحاكاة..." : "تشغيل المحاكاة"}</button></div>
        </div>
      </section>

      <div aria-live="polite" aria-atomic="true">
        {runState.status === "error" ? <div className="state-banner state-banner-error" role="alert">{runState.message}</div> : null}
        {preview ? <>
          <MetricStrip ariaLabel="مقارنة العدادات الاصطناعية" items={[
            { label: "الحي قبل", value: preview.before.live }, { label: "الحي بعد", value: preview.after.live, tone: "info" },
            { label: "السلة قبل", value: preview.before.trash }, { label: "السلة بعد", value: preview.after.trash, tone: "warning" }
          ]} />
          <section className="panel" aria-label="نتائج المحاكاة الاصطناعية">
            <div className="panel-title-row"><div><h2>نتائج المحاكاة</h2><p>synthetic: true · {operationLabels[preview.operation]} · تنتهي المعاينة في {formatExpiry(preview.expiresAt)}</p></div></div>
            <div className="scroll-x"><table className="data-table" aria-label="نتائج عناصر المحاكاة"><thead><tr><th>المعرف</th><th>النتيجة</th><th>التفاصيل</th></tr></thead><tbody>
              {preview.results.map((result) => <tr key={result.id}><td dir="ltr">{result.id}</td><td><span className={`badge ${result.reason ? "badge-danger" : ""}`}>{resultLabel(result)}</span></td><td>{resultDetail(result)}</td></tr>)}
            </tbody></table></div>
          </section>
        </> : null}
      </div>
    </AppShell>
  );
}
