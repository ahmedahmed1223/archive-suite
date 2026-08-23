"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import MetricStrip from "@/components/MetricStrip";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import PageToolbar from "@/components/PageToolbar";
import { useAuthSession } from "@/lib/auth-session";
import { createArchiveApiClient, type SafetyPreviewOperation, type SafetyPreviewRun, type SafetyPreviewScenario, type SafetyPreviewScenarioDescriptor } from "@/lib/archive-api";

const defaultIds: Record<SafetyPreviewScenario, string> = {
  "bulk-delete-basic": "alpha, bravo, charlie",
  "restore-conflict": "conflict, recoverable, missing"
};

type ScenarioState = { status: "loading" } | { status: "ready"; scenarios: SafetyPreviewScenarioDescriptor[] } | { status: "error"; message: string };
type RunState = { status: "idle" } | { status: "running" } | { status: "ready"; preview: SafetyPreviewRun } | { status: "error"; message: string };

function formatExpiry(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale === "ar" ? "ar-SA" : "en-US");
}

function resultLabel(result: SafetyPreviewRun["results"][number], copy: ReturnType<typeof getSafetyPreviewCopy>) {
  if (result.reason === "conflict") return copy.results.conflict;
  if (result.reason === "not_found") return copy.results.notFound;
  const completed = "restored" in result ? result.restored : result.deleted;
  return completed ? copy.results.simulated : copy.results.unchanged;
}

function getSafetyPreviewCopy(t: ReturnType<typeof useLocale>["t"]) {
  return t.pages.safetyPreview;
}

function resultDetail(result: SafetyPreviewRun["results"][number], copy: ReturnType<typeof getSafetyPreviewCopy>) {
  if (result.reason === "conflict") return copy.results.conflictDetail;
  if (result.reason === "not_found") return copy.results.notFoundDetail;
  return copy.results.simulatedDetail;
}

export default function SafetyPreviewPage() {
  const { locale, t } = useLocale();
  const copy = getSafetyPreviewCopy(t);
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
        setScenarioState({ status: "error", message: ("error" in response ? response.error : undefined) || copy.errors.loadScenarios });
        return;
      }
      setScenarioState({ status: "ready", scenarios: response.scenarios });
      if (response.scenarios[0]) setScenario(response.scenarios[0].id);
    } catch (error) {
      setScenarioState({ status: "error", message: error instanceof Error ? error.message : copy.errors.loadScenarios });
    }
  }, [accessToken, api, copy.errors.loadScenarios]);

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
      setRunState({ status: "error", message: copy.errors.noIdentifiers });
      return;
    }
    setRunState({ status: "running" });
    try {
      const response = await api.runSafetyPreview({ scenario, operation, ids }, { accessToken });
      if (!response.ok || !response.synthetic) {
        setRunState({ status: "error", message: ("error" in response ? response.error : undefined) || copy.errors.runPreview });
        return;
      }
      setRunState({ status: "ready", preview: response });
    } catch (error) {
      setRunState({ status: "error", message: error instanceof Error ? error.message : copy.errors.runPreview });
    }
  }

  const preview = runState.status === "ready" ? runState.preview : null;
  const disabled = !canRun || scenarioState.status !== "ready" || runState.status === "running";

  return (
    <AppShell subtitle={t.pageTitles.safetyPreview} navLabel={t.pageTitles.safetyPreview} contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={<span className="badge">{copy.syntheticBadge}</span>}
        actions={<button type="button" className="button button-secondary" onClick={() => void loadScenarios()} disabled={scenarioState.status === "loading"}>{copy.toolbar.refresh}</button>}
      />

      <OperationalSafetyPanel action={copy.toolbar.safetyAction} dryRun confidence={100} simulationOnly />

      <section className="panel" aria-label={copy.controls.ariaLabel}>
        <div className="panel-title-row"><div><h2>{copy.controls.title}</h2><p>{copy.controls.description}</p></div></div>
        {!canRun ? <div className="state-banner state-banner-error" role="alert"><strong>{copy.controls.unauthorizedTitle}</strong><span className="helper-text">{copy.controls.unauthorizedDescription}</span></div> : null}
        {scenarioState.status === "error" ? <div className="state-banner state-banner-error" role="alert">{scenarioState.message}</div> : null}
        <div className="archive-toolbar-grid">
          <label><span>{copy.controls.scenario}</span><select aria-label={copy.controls.scenario} value={scenario} onChange={(event) => changeScenario(event.target.value as SafetyPreviewScenario)} disabled={scenarioState.status !== "ready" || !canRun}>
            {scenarioState.status === "ready" ? scenarioState.scenarios.map((item) => <option key={item.id} value={item.id}>{item.description}</option>) : <option>{copy.controls.loading}</option>}
          </select></label>
          <label><span>{copy.controls.operation}</span><select aria-label={copy.controls.operation} value={operation} onChange={(event) => setOperation(event.target.value as SafetyPreviewOperation)} disabled={!canRun}>
            <option value="delete">{copy.operationLabels.delete}</option><option value="restore">{copy.operationLabels.restore}</option>
          </select></label>
          <label><span>{copy.controls.identifiers}</span><input aria-label={copy.controls.identifiers} dir="ltr" value={idsText} onChange={(event) => setIdsText(event.target.value)} disabled={!canRun} /></label>
          <div className="archive-toolbar-actions"><button type="button" className="button button-primary" onClick={() => void runPreview()} disabled={disabled}>{runState.status === "running" ? copy.controls.running : copy.controls.run}</button></div>
        </div>
      </section>

      <div aria-live="polite" aria-atomic="true">
        {runState.status === "error" ? <div className="state-banner state-banner-error" role="alert">{runState.message}</div> : null}
        {preview ? <>
          <MetricStrip ariaLabel={copy.metrics.ariaLabel} items={[
            { label: copy.metrics.liveBefore, value: preview.before.live }, { label: copy.metrics.liveAfter, value: preview.after.live, tone: "info" },
            { label: copy.metrics.trashBefore, value: preview.before.trash }, { label: copy.metrics.trashAfter, value: preview.after.trash, tone: "warning" }
          ]} />
          <section className="panel" aria-label={copy.table.sectionAriaLabel}>
            <div className="panel-title-row"><div><h2>{copy.table.title}</h2><p>{copy.syntheticBadge} · {copy.operationLabels[preview.operation]} · {copy.table.expiresAt.replace("{time}", formatExpiry(preview.expiresAt, locale))}</p></div></div>
            <div className="scroll-x"><table className="data-table" aria-label={copy.table.tableAriaLabel}><thead><tr><th>{copy.table.identifier}</th><th>{copy.table.result}</th><th>{copy.table.details}</th></tr></thead><tbody>
              {preview.results.map((result) => <tr key={result.id}><td dir="ltr">{result.id}</td><td><span className={`badge ${result.reason ? "badge-danger" : ""}`}>{resultLabel(result, copy)}</span></td><td>{resultDetail(result, copy)}</td></tr>)}
            </tbody></table></div>
          </section>
        </> : null}
      </div>
    </AppShell>
  );
}
