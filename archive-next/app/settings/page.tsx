"use client";

import "./settings.css";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, DatabaseZap, Eye, Fingerprint, Info, KeyRound, LifeBuoy, MinusCircle, RefreshCw, Settings, ShieldCheck, Users, XCircle } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useAuthSession } from "@/lib/auth-session";
import { useDisplaySettings } from "@/lib/display-settings-context";
import { DEFAULT_DISPLAY_SETTINGS, formatDateTime, type DisplaySettings } from "@/lib/display-settings";
import DropboxFolderPicker from "@/components/DropboxFolderPicker";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import ShortcutsSettings from "@/components/ShortcutsSettings";
import AppearanceSettings from "@/components/AppearanceSettings";
import LanguageSettings from "@/components/LanguageSettings";
import { BRAND } from "@/lib/brand";
import { isTipsEnabledGlobally, setTipsEnabledGlobally } from "@/lib/contextual-tips";
import {
  createArchiveApiClient,
  type DatabaseConnectionResult,
  type DropboxConnection,
  type OdbcProbe,
  type OdbcTablePreview,
  type OdbcWriteOperation,
  type SecuritySettings,
  type StorageConnectionResult
} from "@/lib/archive-api";
import type { AppDictionary } from "@/lib/i18n/dictionaries";

type SettingsCopy = AppDictionary["pages"]["settings"];

const odbcCoreTables = ["items", "users", "settings", "audit"] as const;
const disabledOdbcProbe: OdbcProbe = { enabled: false, driverLoaded: false, dsn: "", status: "disabled", tables: [] };

type OdbcCoreTable = (typeof odbcCoreTables)[number];

type OdbcWriteState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ConnectionTestState<TConnection> =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success"; connection: TConnection }
  | { status: "error"; message: string };

type DatabaseTestForm = {
  driver: "mysql" | "pgsql" | "sqlite";
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
};

const getDefaultOdbcKeyColumn = (table: OdbcCoreTable) => (table === "settings" ? "key" : "id");

export type StatusBadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

// ponytail: icons chosen for distinct outline shape (circle+check, triangle,
// circle+x, circle+i, circle+dash) so tone never relies on color alone.
const STATUS_BADGE_ICONS: Record<StatusBadgeTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  neutral: MinusCircle
};

const STATUS_BADGE_CLASS: Record<StatusBadgeTone, string> = {
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  neutral: ""
};

export function StatusBadge({ children, tone = "neutral" }: Readonly<{ children: string; tone?: StatusBadgeTone }>) {
  const Icon = STATUS_BADGE_ICONS[tone];
  return (
    <span className={`badge status-badge ${STATUS_BADGE_CLASS[tone]}`.trim()} data-tone={tone}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  );
}

function odbcStatusLabel(status: OdbcProbe["status"], copy: SettingsCopy["odbc"]) {
  const labels: Record<OdbcProbe["status"], string> = {
    connected: copy.statusMap.connected,
    disabled: copy.statusMap.disabled,
    "missing-dsn": copy.statusMap.missingDsn,
    "driver-unavailable": copy.statusMap.driverUnavailable,
    failed: copy.statusMap.failed
  };

  return labels[status];
}

function odbcStatusTone(status: OdbcProbe["status"]): StatusBadgeTone {
  const tones: Record<OdbcProbe["status"], StatusBadgeTone> = {
    connected: "success",
    disabled: "neutral",
    "missing-dsn": "warning",
    "driver-unavailable": "warning",
    failed: "danger"
  };

  return tones[status];
}

// ponytail: fixed API messages map 1:1 to status; dynamic driver errors stay raw
function odbcStatusMessage(odbc: OdbcProbe, copy: SettingsCopy["odbc"]) {
  const messages: Partial<Record<OdbcProbe["status"], string>> = {
    disabled: copy.statusMessages.disabled,
    "missing-dsn": copy.statusMessages.missingDsn,
    "driver-unavailable": copy.statusMessages.driverUnavailable
  };

  return messages[odbc.status] || odbc.error || odbc.message;
}

function formatPreviewValue(value: unknown, notAvailableText: string) {
  if (value === null || value === undefined || value === "") {
    return notAvailableText;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export default function SettingsPage() {
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
  const [odbcPreview, setOdbcPreview] = useState<OdbcTablePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [tipsEnabled, setTipsEnabled] = useState(true);
  const [odbcWriteOperation, setOdbcWriteOperation] = useState<OdbcWriteOperation>("insert");
  const [odbcKeyColumn, setOdbcKeyColumn] = useState("id");
  const [odbcKeyValue, setOdbcKeyValue] = useState("");
  const [odbcValuesText, setOdbcValuesText] = useState('{\n  "name": "New item"\n}');
  const [odbcWriteState, setOdbcWriteState] = useState<OdbcWriteState>({ status: "idle" });
  const [storageTestState, setStorageTestState] = useState<ConnectionTestState<StorageConnectionResult>>({ status: "idle" });
  const [dropbox, setDropbox] = useState<DropboxConnection | null>(null);
  const [databaseTestState, setDatabaseTestState] = useState<ConnectionTestState<DatabaseConnectionResult>>({ status: "idle" });
  const [databaseTestForm, setDatabaseTestForm] = useState<DatabaseTestForm>({
    driver: "sqlite",
    host: "",
    port: "",
    database: ":memory:",
    username: "",
    password: ""
  });

  useEffect(() => {
    setTipsEnabled(isTipsEnabledGlobally());
  }, []);

  useEffect(() => {
    setDisplaySettingsDraft(activeDisplaySettings);
  }, [activeDisplaySettings]);

  useEffect(() => {
    const fetchDropboxStatus = async () => {
      try {
        const response = await createArchiveApiClient().dropboxConnection();
        if (response.ok) setDropbox(response.dropbox);
      } catch {
        // Integration availability is supplementary to the settings page.
      }
    };
    void fetchDropboxStatus();
  }, []);

  useEffect(() => {
    const fetchSecuritySettings = async () => {
      try {
        const client = createArchiveApiClient();
        const response = await client.getSecuritySettings();

        if (response.ok) {
          setSettings(response.settings);
        } else {
          setError(response.error || t.pages.settings.security.loadError);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t.pages.settings.security.loadConnectionError);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSecuritySettings();
  }, []);

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

  const loadOdbcPreview = async (table: OdbcCoreTable = selectedOdbcTable) => {
    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      const client = createArchiveApiClient();
      const response = await client.odbcTable(table, { limit: 10 });

      if (response.ok) {
        setOdbcPreview(response);
      } else {
        setOdbcPreview(null);
        setPreviewError(response.error || t.pages.settings.odbc.loadPreviewError);
      }
    } catch (err) {
      setOdbcPreview(null);
      setPreviewError(err instanceof Error ? err.message : t.pages.settings.odbc.loadPreviewConnectionError);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleOdbcWrite = async () => {
    if (!canPreviewOdbc) return;

    setOdbcWriteState({ status: "saving" });

    try {
      const client = createArchiveApiClient();
      const keyValue = odbcKeyValue.trim();
      let response;

      if (odbcWriteOperation === "delete") {
        response = await client.odbcDeleteRow(selectedOdbcTable, {
          keyColumn: odbcKeyColumn.trim(),
          keyValue
        });
      } else {
        const parsedValues = JSON.parse(odbcValuesText) as unknown;
        if (!parsedValues || typeof parsedValues !== "object" || Array.isArray(parsedValues)) {
          setOdbcWriteState({ status: "error", message: t.pages.settings.odbc.invalidJson });
          return;
        }

        const values = parsedValues as Record<string, unknown>;
        response = odbcWriteOperation === "insert"
          ? await client.odbcCreateRow(selectedOdbcTable, { values })
          : await client.odbcUpdateRow(selectedOdbcTable, {
              keyColumn: odbcKeyColumn.trim(),
              keyValue,
              values
            });
      }

      if (!response.ok) {
        setOdbcWriteState({ status: "error", message: response.error });
        return;
      }

      setOdbcWriteState({
        status: "success",
        message: t.pages.settings.odbc.writeSuccess
          .replace("{operation}", response.operation)
          .replace("{affected}", String(response.affected))
      });
      await loadOdbcPreview(selectedOdbcTable);
    } catch (err) {
      setOdbcWriteState({
        status: "error",
        message: err instanceof Error ? err.message : t.pages.settings.odbc.writeError
      });
    }
  };

  const runStorageConnectionTest = async () => {
    setStorageTestState({ status: "pending" });

    try {
      const response = await createArchiveApiClient().testStorageConnection({
        driver: "local",
        name: "archive-local-storage",
        config: {}
      });

      if (!response.ok) {
        setStorageTestState({ status: "error", message: response.error || t.pages.settings.connectionTest.storageError });
        return;
      }

      setStorageTestState({ status: "success", connection: response.connection });
    } catch (err) {
      setStorageTestState({
        status: "error",
        message: err instanceof Error ? err.message : t.pages.settings.connectionTest.storageConnectionError
      });
    }
  };

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

  const runDatabaseConnectionTest = async () => {
    const database = databaseTestForm.database.trim();
    if (!database) {
      setDatabaseTestState({ status: "error", message: t.pages.settings.connectionTest.databaseNameRequired });
      return;
    }

    const port = Number(databaseTestForm.port);
    if (databaseTestForm.port.trim() && (!Number.isInteger(port) || port < 1 || port > 65535)) {
      setDatabaseTestState({ status: "error", message: t.pages.settings.connectionTest.databasePortInvalid });
      return;
    }

    setDatabaseTestState({ status: "pending" });

    try {
      const response = await createArchiveApiClient().testDatabaseConnection({
        driver: databaseTestForm.driver,
        database,
        ...(databaseTestForm.driver === "sqlite"
          ? {}
          : {
              host: databaseTestForm.host.trim() || undefined,
              port: databaseTestForm.port.trim() ? port : undefined,
              username: databaseTestForm.username.trim() || undefined,
              password: databaseTestForm.password || undefined
            })
      });

      if (!response.ok) {
        const detailsText = response.details !== undefined ? ` — ${formatPreviewValue(response.details, t.pages.settings.metrics.notAvailable)}` : "";
        setDatabaseTestState({
          status: "error",
          message: `${response.error || t.pages.settings.connectionTest.databaseError}${detailsText}`
        });
        return;
      }

      setDatabaseTestState({ status: "success", connection: response.connection });
    } catch (err) {
      setDatabaseTestState({
        status: "error",
        message: err instanceof Error ? err.message : t.pages.settings.connectionTest.databaseConnectionError
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
  const odbcRows = odbc
    ? [
        { label: settingsCopy.odbc.statusLabel, value: odbcStatusLabel(odbc.status, settingsCopy.odbc) },
        { label: settingsCopy.odbc.driverLabel, value: odbc.driverLoaded ? settingsCopy.odbc.driverAvailable : settingsCopy.odbc.driverUnavailable },
        { label: settingsCopy.odbc.dsnLabel, value: odbc.dsn || settingsCopy.odbc.dsnNotConfigured },
        { label: settingsCopy.odbc.visibleTablesLabel, value: `${odbc.tables.length}` }
      ]
    : [];
  const previewColumns = odbcPreview
    ? Array.from(new Set(odbcPreview.rows.flatMap((row) => Object.keys(row)))).slice(0, 8)
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

      <section className="state-banner state-banner-info" aria-label={settingsCopy.setupBanner.ariaLabel}>
        <strong>{settingsCopy.setupBanner.stepTitle}</strong>
        <p>{settingsCopy.setupBanner.description}</p>
        <div className="button-row">
          <a className="button button-secondary button-small" href="/status">{settingsCopy.setupBanner.continueReadiness}</a>
          <a className="button button-secondary button-small" href="/first-run">{settingsCopy.setupBanner.viewTour}</a>
        </div>
      </section>

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
            {isLoading ? (
              <p className="helper-text">{settingsCopy.security.loading}</p>
            ) : error ? (
              <p className="helper-text status-error">{settingsCopy.security.errorPrefix.replace("{error}", error)}</p>
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
              <p className="helper-text">{settingsCopy.whisper.gpuHelperBefore} <code>laravel-worker-gpu</code> {settingsCopy.whisper.gpuHelperAfter}</p>
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

        <article className="workspace-panel" aria-label="ODBC bridge">
          <div className="workspace-panel__header">
            <div>
              <h2>{settingsCopy.odbc.heading}</h2>
              <p>{settingsCopy.odbc.description}</p>
            </div>
            {odbc && <StatusBadge tone={odbcStatusTone(odbc.status)}>{odbcStatusLabel(odbc.status, settingsCopy.odbc)}</StatusBadge>}
          </div>

          <div className="stack">
            {isOdbcLoading ? (
              <p className="helper-text">{settingsCopy.odbc.loading}</p>
            ) : odbcError ? (
              <p className="helper-text status-error">{settingsCopy.odbc.errorPrefix.replace("{error}", odbcError)}</p>
            ) : odbc ? (
              <>
                <div className="kv-grid" aria-label="ODBC connection posture">
                  {odbcRows.map((row) => (
                    <div className="kv-item" key={row.label}>
                      <strong>{row.label}</strong>
                      <span>{row.value}</span>
                    </div>
                  ))}
                </div>

                {(odbc.message || odbc.error) && (
                  <div className={`state-banner ${odbc.status === "connected" ? "state-banner-success" : "state-banner-error"}`}>
                    <strong>{odbc.status === "connected" ? settingsCopy.odbc.connectedTitle : settingsCopy.odbc.needsSetupTitle}</strong>
                    <p className="helper-text">{odbcStatusMessage(odbc, settingsCopy.odbc)}</p>
                  </div>
                )}

                <div className="field-row" aria-label="ODBC table preview controls">
                  <label>
                    <span className="field-note">{settingsCopy.odbc.tableFieldLabel}</span>
                    <select
                      className="search-input"
                      value={selectedOdbcTable}
                      onChange={(event) => {
                        const table = event.target.value as OdbcCoreTable;
                        setSelectedOdbcTable(table);
                        setOdbcKeyColumn(getDefaultOdbcKeyColumn(table));
                        setOdbcWriteState({ status: "idle" });
                        if (canPreviewOdbc) {
                          void loadOdbcPreview(table);
                        }
                      }}
                    >
                      {odbcCoreTables.map((table) => (
                        <option key={table} value={table}>
                          {settingsCopy.odbc.tableLabels[table]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={!canPreviewOdbc || isPreviewLoading}
                    onClick={() => void loadOdbcPreview()}
                  >
                    {isPreviewLoading ? <RefreshCw size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    {isPreviewLoading ? settingsCopy.odbc.previewButtonLoading : settingsCopy.odbc.previewButton}
                  </button>
                </div>

                {!canPreviewOdbc && (
                  <p className="helper-text">
                    {settingsCopy.odbc.previewDisabledHelper}
                  </p>
                )}

                {canPreviewOdbc && (
                  <div className="stack section-divider" aria-label="ODBC row write controls">
                    <div>
                      <strong>{settingsCopy.odbc.writeSectionTitle}</strong>
                      <p className="helper-text">
                        {settingsCopy.odbc.writeSectionHelper}
                      </p>
                    </div>

                    <div className="field-row">
                      <label>
                        <span className="field-note">{settingsCopy.odbc.operationLabel}</span>
                        <select
                          className="search-input"
                          value={odbcWriteOperation}
                          onChange={(event) => setOdbcWriteOperation(event.target.value as OdbcWriteOperation)}
                        >
                          <option value="insert">{settingsCopy.odbc.operationInsert}</option>
                          <option value="update">{settingsCopy.odbc.operationUpdate}</option>
                          <option value="delete">{settingsCopy.odbc.operationDelete}</option>
                        </select>
                      </label>

                      {odbcWriteOperation !== "insert" && (
                        <>
                          <label>
                            <span className="field-note">{settingsCopy.odbc.keyColumnLabel}</span>
                            <input
                              className="search-input"
                              value={odbcKeyColumn}
                              onChange={(event) => setOdbcKeyColumn(event.target.value)}
                              placeholder={selectedOdbcTable === "settings" ? "key" : "id"}
                            />
                          </label>
                          <label>
                            <span className="field-note">{settingsCopy.odbc.keyValueLabel}</span>
                            <input
                              className="search-input"
                              value={odbcKeyValue}
                              onChange={(event) => setOdbcKeyValue(event.target.value)}
                              placeholder={settingsCopy.odbc.keyValuePlaceholder}
                            />
                          </label>
                        </>
                      )}
                    </div>

                    {odbcWriteOperation !== "delete" && (
                      <label>
                        <span className="field-note">{settingsCopy.odbc.valuesJsonLabel}</span>
                        <textarea
                          className="search-input"
                          value={odbcValuesText}
                          onChange={(event) => setOdbcValuesText(event.target.value)}
                          rows={5}
                          dir="ltr"
                        />
                      </label>
                    )}

                    <div className="helper-row">
                      <button
                        className={odbcWriteOperation === "delete" ? "button button-danger" : "button button-primary"}
                        type="button"
                        disabled={odbcWriteState.status === "saving"}
                        onClick={() => void handleOdbcWrite()}
                      >
                        {odbcWriteState.status === "saving" ? settingsCopy.odbc.executeButtonSaving : settingsCopy.odbc.executeButton}
                      </button>
                      <span className={`form-status ${
                        odbcWriteState.status === "error"
                          ? "status-error"
                          : odbcWriteState.status === "success"
                            ? "status-success"
                            : ""
                      }`}>
                        {odbcWriteState.status === "idle" || odbcWriteState.status === "saving" ? "" : odbcWriteState.message}
                      </span>
                    </div>
                  </div>
                )}

                {previewError && (
                  <p className="helper-text status-error">{settingsCopy.odbc.previewErrorPrefix.replace("{error}", previewError)}</p>
                )}

                {odbcPreview && (
                  <div className="stack section-divider">
                    <div className="helper-row">
                      <strong>{settingsCopy.odbc.tableLabels[odbcPreview.table as OdbcCoreTable] || odbcPreview.table}</strong>
                      <StatusBadge tone="neutral">{settingsCopy.odbc.previewRowCount.replace("{count}", String(odbcPreview.count))}</StatusBadge>
                    </div>

                    {odbcPreview.rows.length === 0 ? (
                      <div className="empty-state">{settingsCopy.odbc.previewEmpty}</div>
                    ) : (
                      <div className="scroll-x">
                        <table className="data-table">
                          <thead>
                            <tr>
                              {previewColumns.map((column) => (
                                <th key={column} scope="col">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {odbcPreview.rows.map((row, rowIndex) => (
                              <tr key={`${odbcPreview.table}-${rowIndex}`}>
                                {previewColumns.map((column) => (
                                  <td key={column}>
                                    {formatPreviewValue(row[column], settingsCopy.metrics.notAvailable)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </article>

        <article className="workspace-panel" aria-label="Connection testing">
          <div className="workspace-panel__header">
            <div>
              <h2>{settingsCopy.connectionTest.heading}</h2>
              <p>{settingsCopy.connectionTest.description}</p>
            </div>
          </div>
          <div className="stack">
            <section className="section-divider stack" aria-labelledby="dropbox-connection-title">
              <div className="helper-row">
                <div>
                  <strong id="dropbox-connection-title">{settingsCopy.connectionTest.dropboxTitle}</strong>
                  <p className="helper-text mt-tight">
                    {dropbox?.status === "connected"
                      ? settingsCopy.connectionTest.dropboxConnectedTemplate.replace("{folder}", dropbox.folderPath || "/")
                      : dropbox?.status === "disabled"
                        ? settingsCopy.connectionTest.dropboxDisabled
                        : settingsCopy.connectionTest.dropboxNotConnected}
                  </p>
                </div>
                <StatusBadge tone={dropbox?.status === "connected" ? "success" : dropbox?.status === "disabled" ? "warning" : "neutral"}>
                  {dropbox?.status === "connected" ? settingsCopy.connectionTest.dropboxStatusConnected : dropbox?.status === "disabled" ? settingsCopy.connectionTest.dropboxStatusDisabled : settingsCopy.connectionTest.dropboxStatusNotConnected}
                </StatusBadge>
              </div>
              {dropbox?.status === "connected" ? (
                <DropboxFolderPicker
                  currentFolderPath={dropbox.folderPath}
                  onSelected={(folderPath) => setDropbox((current) => (current ? { ...current, folderPath } : current))}
                />
              ) : null}
              <p className="helper-text">{settingsCopy.connectionTest.dropboxSecurityHelper}</p>
            </section>
            <section className="section-divider stack" aria-labelledby="storage-connection-test-title">
              <div className="helper-row">
                <div>
                  <strong id="storage-connection-test-title">{settingsCopy.connectionTest.storageTitle}</strong>
                  <p className="helper-text mt-tight">{settingsCopy.connectionTest.storageDescription}</p>
                </div>
                <button
                  className="button button-secondary button-small"
                  type="button"
                  disabled={storageTestState.status === "pending"}
                  aria-describedby="storage-connection-test-status"
                  onClick={() => void runStorageConnectionTest()}
                >
                  {storageTestState.status === "pending"
                    ? settingsCopy.connectionTest.checking
                    : storageTestState.status === "error"
                      ? settingsCopy.connectionTest.retry
                      : settingsCopy.connectionTest.storageTestButton}
                </button>
              </div>
              <div id="storage-connection-test-status" aria-live="polite">
                {storageTestState.status === "success" && (
                  <div className="state-banner state-banner-success">
                    <strong>{settingsCopy.connectionTest.storageSuccessTitle}</strong>
                    <p className="helper-text">{storageTestState.connection.message}</p>
                  </div>
                )}
                {storageTestState.status === "error" && (
                  <div className="state-banner state-banner-error" role="alert">
                    <strong>{settingsCopy.connectionTest.storageErrorTitle}</strong>
                    <p className="helper-text">{storageTestState.message}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="section-divider stack" aria-labelledby="database-connection-test-title">
              <div>
                <strong id="database-connection-test-title">{settingsCopy.connectionTest.databaseTitle}</strong>
                <p className="helper-text mt-tight">{settingsCopy.connectionTest.databaseDescription}</p>
              </div>
              <div className="field-row" aria-label={settingsCopy.connectionTest.databaseFieldsAriaLabel}>
                <label>
                  <span className="field-note">{settingsCopy.connectionTest.driverLabel}</span>
                  <select
                    className="search-input"
                    value={databaseTestForm.driver}
                    onChange={(event) => {
                      const driver = event.target.value as DatabaseTestForm["driver"];
                      setDatabaseTestForm((current) => ({
                        ...current,
                        driver,
                        database: current.database === ":memory:" && driver !== "sqlite" ? "" : current.database
                      }));
                      setDatabaseTestState({ status: "idle" });
                    }}
                  >
                    <option value="sqlite">SQLite</option>
                    <option value="mysql">MySQL</option>
                    <option value="pgsql">PostgreSQL</option>
                  </select>
                </label>
                <label>
                  <span className="field-note">{databaseTestForm.driver === "sqlite" ? settingsCopy.connectionTest.databasePathLabel : settingsCopy.connectionTest.databaseNameLabel}</span>
                  <input
                    className="search-input"
                    value={databaseTestForm.database}
                    onChange={(event) => {
                      setDatabaseTestForm((current) => ({ ...current, database: event.target.value }));
                      setDatabaseTestState({ status: "idle" });
                    }}
                    placeholder={databaseTestForm.driver === "sqlite" ? settingsCopy.connectionTest.databasePathPlaceholder : "archive"}
                    dir="ltr"
                  />
                </label>
                {databaseTestForm.driver !== "sqlite" && (
                  <>
                    <label>
                      <span className="field-note">{settingsCopy.connectionTest.hostLabel}</span>
                      <input
                        className="search-input"
                        value={databaseTestForm.host}
                        onChange={(event) => {
                          setDatabaseTestForm((current) => ({ ...current, host: event.target.value }));
                          setDatabaseTestState({ status: "idle" });
                        }}
                        placeholder="127.0.0.1"
                        dir="ltr"
                      />
                    </label>
                    <label>
                      <span className="field-note">{settingsCopy.connectionTest.portLabel}</span>
                      <input
                        className="search-input"
                        inputMode="numeric"
                        value={databaseTestForm.port}
                        onChange={(event) => {
                          setDatabaseTestForm((current) => ({ ...current, port: event.target.value }));
                          setDatabaseTestState({ status: "idle" });
                        }}
                        placeholder={databaseTestForm.driver === "mysql" ? "3306" : "5432"}
                        dir="ltr"
                      />
                    </label>
                    <label>
                      <span className="field-note">{settingsCopy.connectionTest.usernameLabel}</span>
                      <input
                        className="search-input"
                        autoComplete="username"
                        value={databaseTestForm.username}
                        onChange={(event) => {
                          setDatabaseTestForm((current) => ({ ...current, username: event.target.value }));
                          setDatabaseTestState({ status: "idle" });
                        }}
                        dir="ltr"
                      />
                    </label>
                    <label>
                      <span className="field-note">{settingsCopy.connectionTest.passwordLabel}</span>
                      <input
                        className="search-input"
                        type="password"
                        autoComplete="current-password"
                        value={databaseTestForm.password}
                        onChange={(event) => {
                          setDatabaseTestForm((current) => ({ ...current, password: event.target.value }));
                          setDatabaseTestState({ status: "idle" });
                        }}
                        dir="ltr"
                      />
                    </label>
                  </>
                )}
              </div>
              <div className="helper-row">
                <button
                  className="button button-secondary button-small"
                  type="button"
                  disabled={databaseTestState.status === "pending"}
                  aria-describedby="database-connection-test-status"
                  onClick={() => void runDatabaseConnectionTest()}
                >
                  {databaseTestState.status === "pending"
                    ? settingsCopy.connectionTest.checking
                    : databaseTestState.status === "error"
                      ? settingsCopy.connectionTest.retry
                      : settingsCopy.connectionTest.databaseTestButton}
                </button>
              </div>
              <div id="database-connection-test-status" aria-live="polite">
                {databaseTestState.status === "success" && (
                  <div className="state-banner state-banner-success">
                    <strong>{settingsCopy.connectionTest.databaseSuccessTitle}</strong>
                    <p className="helper-text">{databaseTestState.connection.message}</p>
                  </div>
                )}
                {databaseTestState.status === "error" && (
                  <div className="state-banner state-banner-error" role="alert">
                    <strong>{settingsCopy.connectionTest.databaseErrorTitle}</strong>
                    <p className="helper-text">{databaseTestState.message}</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </article>

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
