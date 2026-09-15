"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDisplaySettings } from "@/lib/display-settings-context";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import { useCapability } from "@/components/RoleGate";
import {
  createArchiveApiClient,
  type RightsRecord,
  type RightsEnforcementStatus,
  type RightsWindow,
  type RightsUsage
} from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate as formatDisplayDate } from "@/lib/display-settings";

type RightsState =
  | { status: "loading" }
  | { status: "ready"; records: RightsRecord[] }
  | { status: "error"; message: string };

type EnforcementState =
  | { status: "loading" }
  | { status: "ready"; enforcement: RightsEnforcementStatus }
  | { status: "error"; message: string };

type UpsertState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; itemId: string }
  | { status: "error"; message: string };

type LicenseType = RightsRecord["licenseType"];

const WARNING_WINDOW_DAYS = 30;
const DAY_MS = 86400000;

function formatDate(value: string | null | undefined, fallback: string, settings: import("@/lib/display-settings").DisplaySettings, locale: import("@/lib/i18n/types").AppLocale) {
  return formatDisplayDate(value, settings, locale, fallback);
}

function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / DAY_MS);
}

export default function RightsPage() {
  const { locale, t } = useLocale();
  const { settings: displaySettings } = useDisplaySettings();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<RightsState>({ status: "loading" });
  const [days, setDays] = useState("365");
  const [enforcementByItem, setEnforcementByItem] = useState<Record<string, EnforcementState>>({});
  const [upsertState, setUpsertState] = useState<UpsertState>({ status: "idle" });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formItemId, setFormItemId] = useState("");
  const [formHolder, setFormHolder] = useState("");
  const [formLicense, setFormLicense] = useState<LicenseType>("OWNED");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [windowsByItem, setWindowsByItem] = useState<Record<string, RightsWindow[]>>({});
  const [windowFormUsage, setWindowFormUsage] = useState<RightsUsage>("broadcast");
  const [windowFormStartsAt, setWindowFormStartsAt] = useState("");
  const [windowFormEndsAt, setWindowFormEndsAt] = useState("");
  const [windowFormTerritories, setWindowFormTerritories] = useState("");
  const [windowFormPlatforms, setWindowFormPlatforms] = useState("");
  const [windowFormGranted, setWindowFormGranted] = useState(true);
  const [windowUpsertState, setWindowUpsertState] = useState<UpsertState>({ status: "idle" });
  const canManageRights = useCapability("rights.manage");

  const daysOptions: Array<DataViewOption<string>> = useMemo(() => [
    { value: "30", label: t.pages.rights.days30 },
    { value: "90", label: t.pages.rights.days90 },
    { value: "365", label: t.pages.rights.days365 }
  ], [t]);

  const licenseLabels: Record<LicenseType, string> = useMemo(() => ({
    OWNED: t.pages.rights.licenseOwned,
    LICENSED: t.pages.rights.licenseLicensed,
    PUBLIC_DOMAIN: t.pages.rights.licensePublicDomain,
    FAIR_USE: t.pages.rights.licenseFairUse,
    UNKNOWN: t.pages.rights.licenseUnknown
  }), [t]);

  const usageLabels: Record<RightsUsage, string> = useMemo(() => ({
    broadcast: t.pages.rights.usageBroadcast,
    digital_public: t.pages.rights.usageDigitalPublic,
    internal_archive: t.pages.rights.usageInternalArchive,
    editorial_reuse: t.pages.rights.usageEditorialReuse
  }), [t]);

  const loadRights = useCallback(async (windowDays: string) => {
    setState({ status: "loading" });
    setEnforcementByItem({});
    try {
      const response = await api.expiringRights({ days: Number(windowDays) });
      if (response.ok) {
        setState({ status: "ready", records: response.records });
      } else {
        setState({ status: "error", message: response.error || t.pages.rights.loadErrorTitle });
      }
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : t.pages.rights.loadErrorTitle });
    }
  }, [api, t]);

  useEffect(() => {
    void loadRights(days);
  }, [loadRights, days]);

  const records = state.status === "ready" ? state.records : [];
  const expiringSoonCount = records.filter((record) => {
    const remaining = daysUntil(record.expiresAt);
    return remaining !== null && remaining <= WARNING_WINDOW_DAYS;
  }).length;
  const hasBlockedRights = Object.values(enforcementByItem).some(
    (item) => item.status === "ready" && item.enforcement.decisions.some((d) => !d.allowed)
  );

  const checkEnforcement = async (itemId: string) => {
    setEnforcementByItem((current) => ({ ...current, [itemId]: { status: "loading" } }));
    try {
      const response = await api.rightsEnforcement(itemId);
      if (response.ok) {
        setEnforcementByItem((current) => ({
          ...current,
          [itemId]: { status: "ready", enforcement: response }
        }));
      } else {
        setEnforcementByItem((current) => ({
          ...current,
          [itemId]: { status: "error", message: response.error || t.pages.rights.enforcementCheckErrorTitle }
        }));
      }
    } catch (error) {
      setEnforcementByItem((current) => ({
        ...current,
        [itemId]: { status: "error", message: error instanceof Error ? error.message : t.pages.rights.enforcementCheckErrorTitle }
      }));
    }
  };

  const handleUpsert = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const itemId = formItemId.trim();
    const rightsHolder = formHolder.trim();
    if (!itemId || !rightsHolder) {
      setUpsertState({ status: "error", message: t.pages.rights.requiredFieldsMessage });
      return;
    }

    setUpsertState({ status: "saving" });
    try {
      const response = await api.upsertRights({
        itemId,
        rightsHolder,
        licenseType: formLicense,
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
        notes: formNotes.trim() || null
      });
      if (response.ok) {
        setUpsertState({ status: "success", itemId });
        setFormItemId("");
        setFormHolder("");
        setFormExpiresAt("");
        setFormNotes("");
        await loadRights(days);
      } else {
        setUpsertState({ status: "error", message: response.error || t.pages.rights.saveErrorTitle });
      }
    } catch (error) {
      setUpsertState({ status: "error", message: error instanceof Error ? error.message : t.pages.rights.saveErrorTitle });
    }
  };

  // A window list that fails to load must say so: an operator reading an
  // empty table would otherwise conclude the item has no windows and grant a
  // duplicate one.
  const loadWindows = async (itemId: string) => {
    try {
      const response = await api.rightsWindows(itemId);
      if (response.ok) {
        setWindowsByItem((current) => ({ ...current, [itemId]: response.windows }));
        return;
      }
      setWindowUpsertState({ status: "error", message: response.error });
    } catch (error) {
      setWindowUpsertState({ status: "error", message: error instanceof Error ? error.message : t.pages.rights.enforcementCheckErrorTitle });
    }
  };

  const handleCreateWindow = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedItemId) return;

    const territories = windowFormTerritories
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const platforms = windowFormPlatforms
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setWindowUpsertState({ status: "saving" });
    try {
      const response = await api.createRightsWindow(selectedItemId, {
        usage: windowFormUsage,
        startsAt: windowFormStartsAt ? new Date(windowFormStartsAt).toISOString() : null,
        endsAt: windowFormEndsAt ? new Date(windowFormEndsAt).toISOString() : null,
        territories: territories.length > 0 ? territories : [],
        platforms: platforms.length > 0 ? platforms : [],
        granted: windowFormGranted
      });
      if (response.ok) {
        setWindowUpsertState({ status: "success", itemId: selectedItemId });
        setWindowFormUsage("broadcast");
        setWindowFormStartsAt("");
        setWindowFormEndsAt("");
        setWindowFormTerritories("");
        setWindowFormPlatforms("");
        setWindowFormGranted(true);
        await loadWindows(selectedItemId);
        await checkEnforcement(selectedItemId);
      } else {
        setWindowUpsertState({ status: "error", message: response.error || t.pages.rights.saveErrorTitle });
      }
    } catch (error) {
      setWindowUpsertState({ status: "error", message: error instanceof Error ? error.message : t.pages.rights.saveErrorTitle });
    }
  };

  /**
   * Both mutations report failure rather than leaving the old row on screen:
   * a checkbox that springs back with no message reads as a UI glitch, when
   * it actually means the item is still open (or still closed) to the world.
   */
  const applyWindowChange = async (change: () => Promise<{ ok: boolean; error?: string }>) => {
    if (!selectedItemId) return;
    setWindowUpsertState({ status: "saving" });
    try {
      const response = await change();
      if (!response.ok) {
        setWindowUpsertState({ status: "error", message: response.error ?? t.pages.rights.saveErrorTitle });
        return;
      }
      setWindowUpsertState({ status: "idle" });
      await loadWindows(selectedItemId);
      await checkEnforcement(selectedItemId);
    } catch (error) {
      setWindowUpsertState({ status: "error", message: error instanceof Error ? error.message : t.pages.rights.saveErrorTitle });
    }
  };

  const handleUpdateWindowGranted = (windowId: string, granted: boolean) =>
    applyWindowChange(() => api.updateRightsWindow(windowId, { granted }));

  const handleDeleteWindow = (windowId: string) =>
    applyWindowChange(() => api.deleteRightsWindow(windowId));

  const renderEnforcement = (itemId: string) => {
    const enforcementState = enforcementByItem[itemId];
    if (!enforcementState) {
      return (
        <button type="button" className="button button-secondary button-sm" onClick={() => void checkEnforcement(itemId)}>
          {t.pages.rights.checkEnforcement}
        </button>
      );
    }

    if (enforcementState.status === "loading") {
      return <span className="helper-text">{t.pages.rights.checking}</span>;
    }

    if (enforcementState.status === "error") {
      return <span className="helper-text">{enforcementState.message}</span>;
    }

    const { enforcement } = enforcementState;
    return (
      <div className="record-meta">
        {enforcement.decisions.map((decision) => (
          <div key={decision.usage} className="flex items-center gap-1">
            <span className={`badge ${decision.allowed ? "" : "badge-danger"}`}>
              {usageLabels[decision.usage]}: {decision.allowed ? t.pages.rights.allowed : t.pages.rights.blocked}
            </span>
            {decision.reason ? <span className="helper-text">{decision.reason}</span> : null}
          </div>
        ))}
        {(enforcement.warnings || []).map((warning) => (
          <span key={warning} className="badge badge-danger">{warning}</span>
        ))}
      </div>
    );
  };

  return (
    <AppShell subtitle={t.pageTitles.usageRights} navLabel={t.pageTitles.rights} contentClassName="observability-content" tipsPage="rights">
      <PageToolbar
        eyebrow={<span className="badge">{t.pages.rights.eyebrow}</span>}
        title={t.pages.rights.title}
        description={t.pages.rights.description}
        meta={(
          <>
            <span className="badge">{records.length} {t.pages.rights.countSuffix}</span>
            <span className={`badge ${expiringSoonCount > 0 ? "badge-danger" : ""}`}>
              {expiringSoonCount} {t.pages.rights.expiringWithinSuffix.replace("{days}", String(WARNING_WINDOW_DAYS))}
            </span>
          </>
        )}
        actions={(
          <>
            {canManageRights ? (
              <button type="button" className="button button-primary" onClick={() => setIsFormOpen((open) => !open)}>
                {isFormOpen ? t.pages.rights.closeForm : t.pages.rights.registerRights}
              </button>
            ) : (
              <p className="helper-text">{t.pages.rights.noPermission}</p>
            )}
            <button type="button" className="button button-secondary" onClick={() => void loadRights(days)} disabled={state.status === "loading"}>
              {t.pages.rights.refresh}
            </button>
          </>
        )}
      >
        <DataViewSwitcher value={days} options={daysOptions} onChange={setDays} label={t.pages.rights.windowLabel} />
      </PageToolbar>

      <OperationalSafetyPanel
        action={t.pages.rights.safetyAction}
        rights={hasBlockedRights ? "blocked" : "allowed"}
        auditHref="/activity"
      />

      {isFormOpen ? (
        <section className="panel" aria-label={t.pages.rights.formAriaLabel}>
          <div className="panel-title-row">
            <div>
              <h2>{t.pages.rights.formTitle}</h2>
              <p>{t.pages.rights.formDescription}</p>
            </div>
          </div>
          <form className="archive-toolbar-grid" onSubmit={handleUpsert}>
            <label>
              <span>{t.pages.rights.fieldItemId}</span>
              <input type="text" dir="ltr" value={formItemId} onChange={(e) => setFormItemId(e.target.value)} required />
            </label>
            <label>
              <span>{t.pages.rights.fieldRightsHolder}</span>
              <input type="text" value={formHolder} onChange={(e) => setFormHolder(e.target.value)} required />
            </label>
            <label>
              <span>{t.pages.rights.fieldLicenseType}</span>
              <select value={formLicense} onChange={(e) => setFormLicense(e.target.value as LicenseType)}>
                {(Object.keys(licenseLabels) as LicenseType[]).map((license) => (
                  <option key={license} value={license}>{licenseLabels[license]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t.pages.rights.fieldExpiresAt}</span>
              <input type="date" value={formExpiresAt} onChange={(e) => setFormExpiresAt(e.target.value)} />
            </label>
            <label>
              <span>{t.pages.rights.fieldNotes}</span>
              <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} maxLength={4000} />
            </label>
            <div className="archive-toolbar-actions">
              <button type="submit" className="button button-primary" disabled={upsertState.status === "saving"}>
                {upsertState.status === "saving" ? t.pages.rights.saving : t.pages.rights.saveRights}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {upsertState.status === "success" ? (
        <div className="state-banner state-banner-success" role="status">
          <strong>{t.pages.rights.saveSuccessTitle}</strong>
          <span className="helper-text">{t.pages.rights.itemLabel.replace("{itemId}", upsertState.itemId)}</span>
        </div>
      ) : null}

      {upsertState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.rights.saveErrorTitle}</strong>
          <span className="helper-text">{upsertState.message}</span>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <div className="panel panel-compact">
          <Skeleton label={t.pages.rights.loading} />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.rights.loadErrorTitle}</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {state.status === "ready" ? (
        records.length === 0 ? (
          <EmptyState
            title={t.pages.rights.emptyTitle}
            description={t.pages.rights.emptyDescription}
            actions={
              canManageRights ? (
                <button type="button" className="button button-secondary" onClick={() => setIsFormOpen(true)}>{t.pages.rights.registerRights}</button>
              ) : null
            }
          />
        ) : (
          <>
            <section className="panel" aria-label={t.pages.rights.recordsAriaLabel}>
              <div className="panel-title-row">
                <div>
                  <h2>{t.pages.rights.recordsTitle.replace("{count}", String(records.length))}</h2>
                  <p>
                    {t.pages.rights.recordsDescription
                      .replace("{window}", daysOptions.find((option) => option.value === days)?.label ?? "")
                      .replace("{days}", String(WARNING_WINDOW_DAYS))}
                  </p>
                </div>
              </div>
              <div className="scroll-x">
                <table className="data-table" aria-label={t.pages.rights.tableAriaLabel}>
                  <thead>
                    <tr>
                      <th>{t.pages.rights.colItem}</th>
                      <th>{t.pages.rights.colRightsHolder}</th>
                      <th>{t.pages.rights.colLicense}</th>
                      <th>{t.pages.rights.colExpiresAt}</th>
                      <th>{t.pages.rights.colRemaining}</th>
                      <th className="data-table-sticky-end">{t.pages.rights.colEnforcement}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const remaining = daysUntil(record.expiresAt);
                      const isExpiringSoon = remaining !== null && remaining <= WARNING_WINDOW_DAYS;
                      const isSelected = selectedItemId === record.itemId;
                      return (
                        <tr key={record.id} className={isSelected ? "active" : ""}>
                          <td>
                            {/* The id keeps linking to the record; opening the
                                windows is its own action, not a hijacked link. */}
                            <a className="text-accent" href={`/archive/${encodeURIComponent(record.itemId)}`}>
                              {record.itemId}
                            </a>
                            <button
                              type="button"
                              className="button button-secondary button-sm"
                              aria-expanded={isSelected}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedItemId(null);
                                  return;
                                }
                                setWindowUpsertState({ status: "idle" });
                                setSelectedItemId(record.itemId);
                                void loadWindows(record.itemId);
                              }}
                            >
                              {t.pages.rights.manageWindows}
                            </button>
                          </td>
                          <td>{record.rightsHolder}</td>
                          <td><span className="badge">{licenseLabels[record.licenseType]}</span></td>
                          <td className="text-sm">{formatDate(record.expiresAt, t.pages.rights.notSet, displaySettings, locale)}</td>
                          <td>
                            {remaining === null ? (
                              <span className="helper-text">-</span>
                            ) : (
                              <span className={`badge ${isExpiringSoon ? "badge-danger" : ""}`}>
                                {remaining <= 0 ? t.pages.rights.expired : t.pages.rights.daysRemaining.replace("{days}", String(remaining))}
                              </span>
                            )}
                          </td>
                          <td className="data-table-sticky-end">{renderEnforcement(record.itemId)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedItemId && canManageRights ? (
              <section className="panel" aria-label={t.pages.rights.windowsAriaLabel}>
                <div className="panel-title-row">
                  <div>
                    <h2>{t.pages.rights.windowsTitle.replace("{itemId}", selectedItemId)}</h2>
                    <p>{t.pages.rights.windowsDescription}</p>
                  </div>
                  <button type="button" className="button button-secondary button-sm" onClick={() => setSelectedItemId(null)}>
                    {t.pages.rights.closeWindows}
                  </button>
                </div>

                <div className="scroll-x">
                  <table className="data-table" aria-label={t.pages.rights.windowsTableAriaLabel}>
                    <thead>
                      <tr>
                        <th>{t.pages.rights.colWindowUsage}</th>
                        <th>{t.pages.rights.colWindowPeriod}</th>
                        <th>{t.pages.rights.colWindowTerritories}</th>
                        <th>{t.pages.rights.colWindowPlatforms}</th>
                        <th>{t.pages.rights.colWindowGranted}</th>
                        <th className="data-table-sticky-end">{t.pages.rights.colWindowActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(windowsByItem[selectedItemId] || []).map((window) => (
                        <tr key={window.id}>
                          <td><span className="badge">{usageLabels[window.usage]}</span></td>
                          <td className="text-sm">
                            {window.startsAt || window.endsAt ? (
                              <>
                                {window.startsAt ? formatDate(window.startsAt, "", displaySettings, locale) : t.pages.rights.notSet}
                                {" - "}
                                {window.endsAt ? formatDate(window.endsAt, "", displaySettings, locale) : t.pages.rights.notSet}
                              </>
                            ) : (
                              <span className="helper-text">{t.pages.rights.unrestricted}</span>
                            )}
                          </td>
                          <td className="text-sm">
                            {window.territories.length > 0 ? (
                              window.territories.join(", ")
                            ) : (
                              <span className="helper-text">{t.pages.rights.unrestricted}</span>
                            )}
                          </td>
                          <td className="text-sm">
                            {window.platforms.length > 0 ? (
                              window.platforms.join(", ")
                            ) : (
                              <span className="helper-text">{t.pages.rights.unrestricted}</span>
                            )}
                          </td>
                          <td>
                            <label>
                              <input
                                type="checkbox"
                                checked={window.granted}
                                onChange={(e) => handleUpdateWindowGranted(window.id, e.target.checked)}
                              />
                              {window.granted ? t.pages.rights.granted : t.pages.rights.denied}
                            </label>
                          </td>
                          <td className="data-table-sticky-end">
                            <button
                              type="button"
                              className="button button-danger button-sm"
                              onClick={() => void handleDeleteWindow(window.id)}
                            >
                              {t.pages.rights.delete}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {windowUpsertState.status === "error" ? (
                  <div className="state-banner state-banner-error" role="alert">
                    <strong>{t.pages.rights.windowSaveErrorTitle}</strong>
                    <span className="helper-text">{windowUpsertState.message}</span>
                  </div>
                ) : null}

                <form className="archive-toolbar-grid" onSubmit={handleCreateWindow}>
                  <label>
                    <span>{t.pages.rights.fieldWindowUsage}</span>
                    <select value={windowFormUsage} onChange={(e) => setWindowFormUsage(e.target.value as RightsUsage)}>
                      <option value="broadcast">{t.pages.rights.usageBroadcast}</option>
                      <option value="digital_public">{t.pages.rights.usageDigitalPublic}</option>
                      <option value="internal_archive">{t.pages.rights.usageInternalArchive}</option>
                      <option value="editorial_reuse">{t.pages.rights.usageEditorialReuse}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t.pages.rights.fieldWindowStartsAt}</span>
                    <input type="date" value={windowFormStartsAt} onChange={(e) => setWindowFormStartsAt(e.target.value)} />
                  </label>
                  <label>
                    <span>{t.pages.rights.fieldWindowEndsAt}</span>
                    <input type="date" value={windowFormEndsAt} onChange={(e) => setWindowFormEndsAt(e.target.value)} />
                  </label>
                  <label>
                    <span>{t.pages.rights.fieldWindowTerritories}</span>
                    <input type="text" value={windowFormTerritories} onChange={(e) => setWindowFormTerritories(e.target.value)} placeholder={t.pages.rights.fieldWindowPlaceholder} />
                  </label>
                  <label>
                    <span>{t.pages.rights.fieldWindowPlatforms}</span>
                    <input type="text" value={windowFormPlatforms} onChange={(e) => setWindowFormPlatforms(e.target.value)} placeholder={t.pages.rights.fieldWindowPlaceholder} />
                  </label>
                  <label>
                    <input type="checkbox" checked={windowFormGranted} onChange={(e) => setWindowFormGranted(e.target.checked)} />
                    {t.pages.rights.fieldWindowGranted}
                  </label>
                  <div className="archive-toolbar-actions">
                    <button type="submit" className="button button-primary" disabled={windowUpsertState.status === "saving"}>
                      {windowUpsertState.status === "saving" ? t.pages.rights.saving : t.pages.rights.createWindow}
                    </button>
                  </div>
                </form>
              </section>
            ) : null}
          </>
        )
      ) : null}
    </AppShell>
  );
}
