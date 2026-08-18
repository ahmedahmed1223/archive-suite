import type { OdbcProbe } from "@/lib/archive-api";
import type { AppDictionary } from "@/lib/i18n/dictionaries";
import type { StatusBadgeTone } from "./StatusBadgeControl";

type SettingsCopy = AppDictionary["pages"]["settings"];

export const odbcCoreTables = ["items", "users", "settings", "audit"] as const;
export type OdbcCoreTable = (typeof odbcCoreTables)[number];
export const disabledOdbcProbe: OdbcProbe = { enabled: false, driverLoaded: false, dsn: "", status: "disabled", tables: [] };

export const getDefaultOdbcKeyColumn = (table: OdbcCoreTable) => (table === "settings" ? "key" : "id");

export function odbcStatusLabel(status: OdbcProbe["status"], copy: SettingsCopy["odbc"]) {
  const labels: Record<OdbcProbe["status"], string> = {
    connected: copy.statusMap.connected,
    disabled: copy.statusMap.disabled,
    "missing-dsn": copy.statusMap.missingDsn,
    "driver-unavailable": copy.statusMap.driverUnavailable,
    failed: copy.statusMap.failed
  };

  return labels[status];
}

export function odbcStatusTone(status: OdbcProbe["status"]): StatusBadgeTone {
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
export function odbcStatusMessage(odbc: OdbcProbe, copy: SettingsCopy["odbc"]) {
  const messages: Partial<Record<OdbcProbe["status"], string>> = {
    disabled: copy.statusMessages.disabled,
    "missing-dsn": copy.statusMessages.missingDsn,
    "driver-unavailable": copy.statusMessages.driverUnavailable
  };

  return messages[odbc.status] || odbc.error || odbc.message;
}

export function formatPreviewValue(value: unknown, notAvailableText: string) {
  if (value === null || value === undefined || value === "") {
    return notAvailableText;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
