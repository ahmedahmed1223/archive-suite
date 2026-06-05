/**
 * Role tags help group tabs by who typically owns them:
 *   personal — every operator can change these (theme, density, smart recall)
 *   admin    — workspace-wide settings that affect everyone (data, security, shortcuts)
 *   owner    — irreversible/destructive system tools (maintenance, integrations)
 *
 * The visual separation comes from a small "role badge" rendered next to each
 * tab in SettingsTabs. Permissions enforcement is handled separately by the
 * auth slice; this metadata is presentational and informative.
 */
export const SETTINGS_TABS = [
  { id: "security", label: "الأمان", role: "admin", roleLabel: "مسؤول" },
  { id: "appearance", label: "المظهر", role: "personal", roleLabel: "شخصي" },
  { id: "general", label: "عام", role: "personal", roleLabel: "شخصي" },
  { id: "data", label: "البيانات", role: "admin", roleLabel: "مسؤول" },
  { id: "ai", label: "مزود الذكاء", role: "admin", roleLabel: "مسؤول" },
  { id: "shortcuts", label: "الاختصارات", role: "admin", roleLabel: "مسؤول" },
  { id: "maintenance", label: "الصيانة", role: "owner", roleLabel: "مالك" }
];

export const SETTINGS_TAB_ROLE_ORDER = ["personal", "admin", "owner"];
export const SETTINGS_TAB_ROLE_LABELS = {
  personal: "شخصي",
  admin: "مسؤول",
  owner: "مالك"
};

export const SETTINGS_TAB_IDS = SETTINGS_TABS.map((tab) => tab.id);

export const SETTINGS_TAB_LABELS = Object.fromEntries(
  SETTINGS_TABS.map((tab) => [tab.id, tab.label])
);
