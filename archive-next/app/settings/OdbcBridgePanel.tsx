"use client";

import { useState } from "react";
import { Eye, RefreshCw } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createArchiveApiClient, type OdbcProbe, type OdbcTablePreview, type OdbcWriteOperation } from "@/lib/archive-api";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "./StatusBadgeControl";
import { formatPreviewValue, getDefaultOdbcKeyColumn, odbcCoreTables, odbcStatusLabel, odbcStatusMessage, odbcStatusTone, type OdbcCoreTable } from "./settings-helpers";

type OdbcWriteState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function OdbcBridgePanel({
  odbc,
  isOdbcLoading,
  odbcError,
  selectedOdbcTable,
  onSelectedOdbcTableChange
}: Readonly<{
  odbc: OdbcProbe | null;
  isOdbcLoading: boolean;
  odbcError: string | null;
  selectedOdbcTable: OdbcCoreTable;
  onSelectedOdbcTableChange: (table: OdbcCoreTable) => void;
}>) {
  const { t } = useLocale();
  const settingsCopy = t.pages.settings;
  const dialog = useConfirmDialog();

  const [odbcPreview, setOdbcPreview] = useState<OdbcTablePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [odbcWriteOperation, setOdbcWriteOperation] = useState<OdbcWriteOperation>("insert");
  const [odbcKeyColumn, setOdbcKeyColumn] = useState("id");
  const [odbcKeyValue, setOdbcKeyValue] = useState("");
  const [odbcValuesText, setOdbcValuesText] = useState('{\n  "name": "New item"\n}');
  const [odbcWriteState, setOdbcWriteState] = useState<OdbcWriteState>({ status: "idle" });

  const canPreviewOdbc = odbc?.status === "connected";
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

    // V14-AUDIT-002: deletes are irreversible — confirm before executing.
    // Updates overwrite a row's data via free-form JSON with the same
    // no-undo risk, so they get the same confirmation gate.
    if (odbcWriteOperation === "delete" || odbcWriteOperation === "update") {
      const isDelete = odbcWriteOperation === "delete";
      const confirmed = await dialog.confirm({
        title: isDelete ? settingsCopy.odbc.deleteConfirmTitle : settingsCopy.odbc.updateConfirmTitle,
        message: (isDelete ? settingsCopy.odbc.deleteConfirmMessage : settingsCopy.odbc.updateConfirmMessage)
          .replace("{table}", selectedOdbcTable)
          .replace("{key}", odbcKeyValue.trim()),
        confirmLabel: settingsCopy.odbc.executeButton,
        destructive: isDelete,
      });
      if (!confirmed) return;
    }

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

  return (
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
                    onSelectedOdbcTableChange(table);
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
  );
}
