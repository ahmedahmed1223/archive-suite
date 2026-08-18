"use client";

import { useEffect, useState } from "react";
import DropboxFolderPicker from "@/components/DropboxFolderPicker";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  createArchiveApiClient,
  type DatabaseConnectionResult,
  type DropboxConnection,
  type StorageConnectionResult
} from "@/lib/archive-api";
import { StatusBadge } from "./StatusBadgeControl";
import { formatPreviewValue } from "./settings-helpers";

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

export function ConnectionTestingPanel() {
  const { t } = useLocale();
  const settingsCopy = t.pages.settings;

  const [dropbox, setDropbox] = useState<DropboxConnection | null>(null);
  const [storageTestState, setStorageTestState] = useState<ConnectionTestState<StorageConnectionResult>>({ status: "idle" });
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

  return (
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
  );
}
