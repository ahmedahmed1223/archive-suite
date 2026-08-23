"use client";

import "./settings.css";
import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, DatabaseZap, Fingerprint, KeyRound, LifeBuoy, Settings, ShieldCheck, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import AsyncStateSurface from "@/components/AsyncStateSurface";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useAuthSession } from "@/lib/auth-session";
import { useDisplaySettings } from "@/lib/display-settings-context";
import { DEFAULT_DISPLAY_SETTINGS, formatDateTime, type DisplaySettings } from "@/lib/display-settings";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import ShortcutsSettings from "@/components/ShortcutsSettings";
import AppearanceSettings from "@/components/AppearanceSettings";
import LanguageSettings from "@/components/LanguageSettings";
import { BRAND } from "@/lib/brand";
import { isTipsEnabledGlobally, setTipsEnabledGlobally } from "@/lib/contextual-tips";
import { ONBOARDING_STORAGE_KEY } from "@/lib/onboarding";
import { createArchiveApiClient, type OdbcProbe, type SecuritySettings } from "@/lib/archive-api";
import { StatusBadge, type StatusBadgeTone } from "./StatusBadgeControl";
import SettingsHub from "./SettingsHub";
import { ConnectionTestingPanel } from "./ConnectionTestingPanel";
import { OdbcBridgePanel } from "./OdbcBridgePanel";
import { disabledOdbcProbe, odbcStatusLabel, type OdbcCoreTable } from "./settings-helpers";

export { StatusBadge, type StatusBadgeTone };

export default function SettingsPage() {
  // V14-UX-REVIEW-3: the "first run" banner belongs to the first run only.
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  useEffect(() => {
    setIsOnboardingComplete(window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "complete");
  }, []);
  const { locale, t } = useLocale();
  const { user } = useAuthSession();
  const { settings: activeDisplaySettings, status: displaySettingsStatus, error: displaySettingsError, replaceSettings } = useDisplaySettings();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [displaySettingsDraft, setDisplaySettingsDraft] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [displaySaveState, setDisplaySaveState] = useState<{ status: "idle" | "saving" | "success" | "error"; message?: string }>({ status: "idle" });
  const [whisperSaveState, setWhisperSaveState] = useState<{ status: "idle" | "saving" | "success" | "error"; message?: string }>({ status: "idle" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [odbc, setOdbc] = useState<OdbcProbe | null>(null);
  const [isOdbcLoading, setIsOdbcLoading] = useState(true);
  const [odbcError, setOdbcError] = useState<string | null>(null);
  const [selectedOdbcTable, setSelectedOdbcTable] = useState<OdbcCoreTable>("items");
  const [tipsEnabled, setTipsEnabled] = useState(true);

  useEffect(() => {
    setTipsEnabled(isTipsEnabledGlobally());
  }, []);

  useEffect(() => {
    setDisplaySettingsDraft(activeDisplaySettings);
  }, [activeDisplaySettings]);

  // V14-UX-006 (Task 6): extracted so the security panel's error state can
  // retry through AsyncStateSurface.
  const fetchSecuritySettings = useCallback(async () => {
    try {
      const client = createArchiveApiClient();
      const response = await client.getSecuritySettings();

      if (response.ok) {
        setSettings(response.settings);
        setError(null);
      } else {
        setError(response.error || t.pages.settings.security.loadError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.pages.settings.security.loadConnectionError);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchSecuritySettings();
  }, [fetchSecuritySettings]);

  useEffect(() => {
    const fetchOdbcStatus = async () => {
      try {
        const client = createArchiveApiClient();
        const response = await client.odbcStatus();

        if (response.ok) {
          setOdbc(response.odbc);
        } else if (response.code === "NOT_FOUND" || response.code === "not_found") {
          setOdbc(disabledOdbcProbe);
        } else {
          setOdbcError(response.error || t.pages.settings.odbc.loadStatusError);
        }
      } catch (err) {
        setOdbcError(err instanceof Error ? err.message : t.pages.settings.odbc.loadStatusConnectionError);
      } finally {
        setIsOdbcLoading(false);
      }
    };

    fetchOdbcStatus();
  }, []);

  const updateWhisperDevice = async (whisperDevice: "cpu" | "cuda") => {
    if (!settings) return;

    setWhisperSaveState({ status: "saving" });

    try {
      const response = await createArchiveApiClient().updateSecuritySettings({ whisperDevice });
      if (!response.ok) {
        setWhisperSaveState({ status: "error", message: response.error || t.pages.settings.whisper.saveError });
        return;
      }

      setSettings(response.settings);
      setWhisperSaveState({ status: "success", message: t.pages.settings.whisper.saveSuccess });
    } catch (err) {
      setWhisperSaveState({
        status: "error",
        message: err instanceof Error ? err.message : t.pages.settings.whisper.saveConnectionError
      });
    }
  };

  const saveDisplaySettings = async () => {
    if (user?.role !== "admin") return;

    setDisplaySaveState({ status: "saving" });
    try {
      const response = await createArchiveApiClient().updateDisplaySettings(displaySettingsDraft);
      if (!response.ok) {
        setDisplaySaveState({ status: "error", message: response.error || t.pages.settings.display.saveError });
        return;
      }

      replaceSettings(response.settings);
      setDisplaySaveState({ status: "success", message: t.pages.settings.display.saveSuccess });
    } catch (saveError) {
      setDisplaySaveState({
        status: "error",
        message: saveError instanceof Error ? saveError.message : t.pages.settings.display.saveConnectionError
      });
    }
  };

  const settingsCopy = t.pages.settings;
  const postureRows = settings
    ? [
        { label: settingsCopy.security.accessTokenTtl, value: settingsCopy.security.accessTokenTtlValue.replace("{minutes}", String(settings.accessTokenTtlMinutes)) },
        { label: settingsCopy.security.rateLimit, value: settingsCopy.security.rateLimitValue.replace("{limit}", String(settings.perUserRateLimit)) },
        { label: settingsCopy.security.legacyPasswordUpgrade, value: settings.legacyPasswordUpgrade ? settingsCopy.security.enabled : settingsCopy.security.disabled },
        { label: settingsCopy.security.webhookAllowlist, value: settings.webhookUrlAllowlist.length > 0 ? settingsCopy.security.webhookAllowlistValue.replace("{count}", String(settings.webhookUrlAllowlist.length)) : settingsCopy.security.webhookAllowlistEmpty },
        { label: settingsCopy.security.whisperProcessorLabel, value: settings.whisperDevice === "cuda" ? settingsCopy.security.whisperGpu : settingsCopy.security.whisperCpu },
      ]
    : [];
  const canPreviewOdbc = odbc?.status === "connected";
  const canManageDisplaySettings = user?.role === "admin";
  const displayPreview = formatDateTime("2026-07-21T06:05:09.000Z", displaySettingsDraft, locale);
  const categoryCards = [
    { ...settingsCopy.categories.system },
    { ...settingsCopy.categories.storage },
    { ...settingsCopy.categories.api },
    {
      title: settingsCopy.categories.appearance.title,
      summary: settingsCopy.categories.appearance.summary,
      items: [...settingsCopy.categories.appearance.items, settingsCopy.categories.appearance.identityItemTemplate.replace("{brand}", BRAND.lockupName)]
    }
  ];

  return (
    <AppShell subtitle={t.pageTitles.settingsCenter} contentClassName="settings-content" tipsPage="settings">
      <PageToolbar
        icon={<Settings size={24} />}
        eyebrow={<span className="badge">{settingsCopy.toolbar.eyebrow}</span>}
        title={settingsCopy.toolbar.title.replace("{brand}", BRAND.arabicName)}
        description={settingsCopy.toolbar.description}
        meta={(
          <>
            <span className="badge">{settingsCopy.toolbar.metaIdentity}</span>
            <span className="badge">{settingsCopy.toolbar.metaSecurity}</span>
            <span className="badge">ODBC</span>
            <span className="badge">{settingsCopy.toolbar.metaMonitoring}</span>
          </>
        )}
        actions={(
          <>
            <a className="button button-secondary" href="/settings/users">
              <Users size={16} aria-hidden="true" />
              {settingsCopy.toolbar.usersAndRoles}
            </a>
            <a className="button button-secondary" href="/first-run">
              <LifeBuoy size={16} aria-hidden="true" />
              {settingsCopy.toolbar.reopenTour}
            </a>
            <a className="button button-secondary" href="/status">
              <Activity size={16} aria-hidden="true" />
              {settingsCopy.toolbar.systemStatus}
            </a>
            <a className="button button-secondary" href="/errors">
              <AlertTriangle size={16} aria-hidden="true" />
              {settingsCopy.toolbar.errorLog}
            </a>
          </>
        )}
      />

      {isOnboardingComplete === false ? (
        <section className="state-banner state-banner-info" aria-label={settingsCopy.setupBanner.ariaLabel}>
          <strong>{settingsCopy.setupBanner.stepTitle}</strong>
          <p>{settingsCopy.setupBanner.description}</p>
          <div className="button-row">
            <a className="button button-secondary button-small" href="/status">{settingsCopy.setupBanner.continueReadiness}</a>
            <a className="button button-secondary button-small" href="/first-run">{settingsCopy.setupBanner.viewTour}</a>
          </div>
        </section>
      ) : null}

      <SettingsHub />

      <div className="settings-legacy-divider" role="separator" aria-label={settingsCopy.legacyTools.ariaLabel}>
        <h2>{settingsCopy.legacyTools.heading}</h2>
        <p className="helper-text">{settingsCopy.legacyTools.description}</p>
      </div>

      <MetricStrip
        ariaLabel={settingsCopy.metrics.ariaLabel}
        items={[
          {
            label: settingsCopy.metrics.identityLabel,
            value: BRAND.arabicName,
            description: `${BRAND.latinName} v${BRAND.version}`,
            icon: <Fingerprint size={20} />,
            tone: "accent"
          },
          {
            label: settingsCopy.metrics.securityLabel,
            value: isLoading ? settingsCopy.metrics.checking : error ? settingsCopy.metrics.needsReview : settingsCopy.metrics.loaded,
            description: settings ? settingsCopy.metrics.securityDescriptionRate.replace("{rate}", String(settings.perUserRateLimit)) : settingsCopy.metrics.securityDescriptionReadOnly,
            icon: <ShieldCheck size={20} />,
            tone: error ? "danger" : "success"
          },
          {
            label: "ODBC",
            value: isOdbcLoading ? settingsCopy.metrics.checking : odbc ? odbcStatusLabel(odbc.status, settingsCopy.odbc) : settingsCopy.metrics.notAvailable,
            description: odbc ? settingsCopy.metrics.odbcDescriptionTablesVisible.replace("{count}", String(odbc.tables.length)) : settingsCopy.metrics.odbcDescriptionLegacy,
            icon: <DatabaseZap size={20} />,
            tone: odbc?.status === "connected" ? "success" : "warning"
          },
          {
            label: settingsCopy.metrics.writeLabel,
            value: canPreviewOdbc ? settingsCopy.metrics.writeRestricted : settingsCopy.metrics.writeClosed,
            description: settingsCopy.metrics.writeDescriptionTable.replace("{table}", settingsCopy.odbc.tableLabels[selectedOdbcTable]),
            icon: <KeyRound size={20} />,
            tone: canPreviewOdbc ? "info" : "default"
          }
        ]}
      />

        <article className="workspace-panel identity-panel" aria-label={settingsCopy.identity.ariaLabel}>
          <div className="identity-lockup">
            <img src={BRAND.lockupPath} alt={BRAND.lockupName} width={360} height={96} />
            <div>
              <h2>{settingsCopy.identity.heading}</h2>
              <p>{settingsCopy.identity.descriptionTemplate.replace("{descriptor}", BRAND.descriptor)}</p>
            </div>
            <div className="record-meta">
              <span className="badge">{BRAND.arabicName}</span>
              <span className="badge">{BRAND.latinName}</span>
              <span className="badge">v{BRAND.version}</span>
            </div>
          </div>
          <div className="identity-mark-preview" aria-hidden="true">
            <img src={BRAND.markPath} alt="" width={60} height={60} />
          </div>
        </article>

        <div className="dense-grid" aria-label={settingsCopy.categories.ariaLabel}>
          {categoryCards.map((card) => (
            <article className="workspace-panel panel-compact" key={card.title}>
              <h2>{card.title}</h2>
              <p>{card.summary}</p>
              <ul>
                {card.items.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <article className="workspace-panel" aria-label={settingsCopy.security.ariaLabel}>
          <div className="workspace-panel__header">
            <div>
              <h2>{settingsCopy.security.heading}</h2>
              <p>{settingsCopy.security.description}</p>
            </div>
            <StatusBadge tone={error ? "danger" : "neutral"}>{error ? settingsCopy.security.needsReview : settingsCopy.security.readOnly}</StatusBadge>
          </div>

          <div className="stack">
            {isLoading || error ? (
              /* V14-UX-006: shared state surface inside the security panel. */
              <AsyncStateSurface
                status={isLoading ? "loading" : "error"}
                loadingLabel={settingsCopy.security.loading}
                description={error ? settingsCopy.security.errorPrefix.replace("{error}", error) : undefined}
                onRetry={error ? () => void fetchSecuritySettings() : undefined}
              />
            ) : (
              <>
                <div className="kv-grid" role="group" aria-label={settingsCopy.security.postureAriaLabel}>
                  {postureRows.map((row) => (
                    <div className="kv-item" key={row.label}>
                      <strong>{row.label}</strong>
                      <span>{row.value}</span>
                    </div>
                  ))}
                </div>

                {settings && settings.cspPolicy && (
                  <div className="section-divider">
                    <strong>{settingsCopy.security.cspHeading}</strong>
                    <p className="helper-text mt-tight mono-text">
                      {settings.cspPolicy}
                    </p>
                  </div>
                )}

                {settings && settings.corsOrigins && settings.corsOrigins.length > 0 && (
                  <div className="section-divider">
                    <strong>{settingsCopy.security.corsHeading}</strong>
                    <ul className="compact-list mt-tight">
                      {settings.corsOrigins.map((origin) => (
                        <li key={origin}>{origin}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

          </div>
        </article>

        <article className="workspace-panel" aria-label={settingsCopy.display.ariaLabel}>
          <div className="workspace-panel__header">
            <div>
              <h2>{settingsCopy.display.heading}</h2>
              <p>{settingsCopy.display.description}</p>
            </div>
            <StatusBadge tone={displaySettingsStatus === "fallback" ? "warning" : "neutral"}>
              {displaySettingsStatus === "loading" ? settingsCopy.display.loading : displayPreview}
            </StatusBadge>
          </div>

          {displaySettingsStatus === "fallback" ? (
            <p className="helper-text status-error" role="status">
              {displaySettingsError ? `${settingsCopy.display.fallback} ${displaySettingsError}` : settingsCopy.display.fallback}
            </p>
          ) : null}

          <div className="stack section-divider">
            <div className="field-row">
              <label>
                <span className="field-note">{settingsCopy.display.timeZoneLabel}</span>
                <input
                  className="search-input"
                  value={displaySettingsDraft.timeZone}
                  dir="ltr"
                  disabled={!canManageDisplaySettings}
                  onChange={(event) => setDisplaySettingsDraft((current) => ({ ...current, timeZone: event.target.value }))}
                />
                <span className="helper-text">{settingsCopy.display.timeZoneHint}</span>
              </label>
              <label>
                <span className="field-note">{settingsCopy.display.dateFormatLabel}</span>
                <select
                  className="search-input"
                  value={displaySettingsDraft.dateFormat}
                  disabled={!canManageDisplaySettings}
                  onChange={(event) => setDisplaySettingsDraft((current) => ({ ...current, dateFormat: event.target.value as DisplaySettings["dateFormat"] }))}
                >
                  <option value="DD/MM/YYYY">{settingsCopy.display.dateFormatDayFirst}</option>
                  <option value="MM/DD/YYYY">{settingsCopy.display.dateFormatMonthFirst}</option>
                  <option value="YYYY-MM-DD">{settingsCopy.display.dateFormatYearFirst}</option>
                </select>
              </label>
              <label>
                <span className="field-note">{settingsCopy.display.timeFormatLabel}</span>
                <select
                  className="search-input"
                  value={displaySettingsDraft.timeFormat}
                  disabled={!canManageDisplaySettings}
                  onChange={(event) => setDisplaySettingsDraft((current) => ({ ...current, timeFormat: event.target.value as DisplaySettings["timeFormat"] }))}
                >
                  <option value="24h">{settingsCopy.display.timeFormat24}</option>
                  <option value="12h">{settingsCopy.display.timeFormat12}</option>
                </select>
              </label>
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={displaySettingsDraft.showSeconds}
                disabled={!canManageDisplaySettings}
                onChange={(event) => setDisplaySettingsDraft((current) => ({ ...current, showSeconds: event.target.checked }))}
              />
              {settingsCopy.display.showSecondsLabel}
            </label>

            <div className="helper-row">
              <strong>{settingsCopy.display.previewLabel}: {displayPreview}</strong>
              {canManageDisplaySettings ? (
                <button className="button button-primary button-small" type="button" disabled={displaySaveState.status === "saving"} onClick={() => void saveDisplaySettings()}>
                  {displaySaveState.status === "saving" ? settingsCopy.display.saving : settingsCopy.display.save}
                </button>
              ) : (
                <span className="helper-text">{settingsCopy.display.readOnly}</span>
              )}
            </div>
            {displaySaveState.status !== "idle" && displaySaveState.status !== "saving" ? (
              <p className={`form-status ${displaySaveState.status === "error" ? "status-error" : "status-success"}`} role={displaySaveState.status === "error" ? "alert" : "status"}>
                {displaySaveState.message}
              </p>
            ) : null}
          </div>
        </article>

        <article className="workspace-panel" aria-label={settingsCopy.whisper.ariaLabel}>
          <div className="workspace-panel__header">
            <div>
              <h2>{settingsCopy.whisper.heading}</h2>
              <p>{settingsCopy.whisper.description}</p>
            </div>
          </div>

          {isLoading ? (
            <p className="helper-text">{settingsCopy.whisper.loading}</p>
          ) : settings ? (
            <div className="stack">
              <label>
                <span className="field-note">{settingsCopy.whisper.processorLabel}</span>
                <select
                  className="search-input"
                  value={settings.whisperDevice}
                  disabled={whisperSaveState.status === "saving"}
                  onChange={(event) => void updateWhisperDevice(event.target.value as "cpu" | "cuda")}
                >
                  <option value="cpu">{settingsCopy.whisper.cpuOption}</option>
                  <option value="cuda">{settingsCopy.whisper.cudaOption}</option>
                </select>
              </label>
              <p className="helper-text">{settingsCopy.whisper.gpuHelperBefore} <code dir="ltr">laravel-worker-gpu</code> {settingsCopy.whisper.gpuHelperAfter}</p>
              {whisperSaveState.status !== "idle" && whisperSaveState.status !== "saving" && (
                <p className={`form-status ${whisperSaveState.status === "error" ? "status-error" : "status-success"}`} role={whisperSaveState.status === "error" ? "alert" : undefined}>
                  {whisperSaveState.message}
                </p>
              )}
            </div>
          ) : (
            <p className="helper-text status-error">{settingsCopy.whisper.loadError}</p>
          )}
        </article>

        <LanguageSettings />
        <ShortcutsSettings />
        <AppearanceSettings />

        <article className="workspace-panel" aria-label={settingsCopy.tips.ariaLabel}>
          <div className="workspace-panel__header">
            <div>
              <h2>{settingsCopy.tips.heading}</h2>
              <p>{settingsCopy.tips.description}</p>
            </div>
          </div>
          <label>
            <input
              type="checkbox"
              checked={tipsEnabled}
              onChange={(event) => {
                const enabled = event.target.checked;
                setTipsEnabledGlobally(enabled);
                setTipsEnabled(enabled);
              }}
            />
            {" "}{settingsCopy.tips.toggleLabel}
          </label>
          <p className="helper-text mt-tight">
            {settingsCopy.tips.helper}
          </p>
        </article>

        <OdbcBridgePanel
          odbc={odbc}
          isOdbcLoading={isOdbcLoading}
          odbcError={odbcError}
          selectedOdbcTable={selectedOdbcTable}
          onSelectedOdbcTableChange={setSelectedOdbcTable}
        />

        <ConnectionTestingPanel />

        <article className="workspace-panel" aria-label={settingsCopy.related.ariaLabel}>
          <div className="workspace-panel__header">
            <div>
              <h2>{settingsCopy.related.heading}</h2>
              <p>{settingsCopy.related.description}</p>
            </div>
          </div>

          <div className="dense-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="panel-compact">
              <h3>{settingsCopy.related.dataCenterTitle}</h3>
              <p className="helper-text">{settingsCopy.related.dataCenterDescription}</p>
              <a className="button button-secondary button-small" href="/data-center">{settingsCopy.related.dataCenterLink}</a>
            </div>
            <div className="panel-compact">
              <h3>{settingsCopy.related.templatesTitle}</h3>
              <p className="helper-text">{settingsCopy.related.templatesDescription}</p>
              <a className="button button-secondary button-small" href="/metadata-templates">{settingsCopy.related.templatesLink}</a>
            </div>
            <div className="panel-compact">
              <h3>{settingsCopy.related.usersTitle}</h3>
              <p className="helper-text">{settingsCopy.related.usersDescription}</p>
              <a className="button button-secondary button-small" href="/settings/users">{settingsCopy.related.usersLink}</a>
            </div>
            <div className="panel-compact">
              <h3>{settingsCopy.related.firstRunTitle}</h3>
              <p className="helper-text">{settingsCopy.related.firstRunDescription}</p>
              <a className="button button-secondary button-small" href="/first-run">{settingsCopy.related.firstRunLink}</a>
            </div>
            <div className="panel-compact">
              <h3>{settingsCopy.related.statusTitle}</h3>
              <p className="helper-text">{settingsCopy.related.statusDescription}</p>
              <a className="button button-secondary button-small" href="/status">{settingsCopy.related.statusLink}</a>
            </div>
          </div>
        </article>
    </AppShell>
  );
}
