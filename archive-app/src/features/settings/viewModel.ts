// @ts-nocheck
import {
  SETTINGS_TAB_IDS,
  SETTINGS_TAB_LABELS,
  SETTINGS_TABS
} from "./settingsTabs.js";
import { getComparableSettingsForDraft } from "./draftState.js";

export function normalizeSettingsTab(tabId = "general") {
  const legacyMap = {
    interface: "appearance",
    icons: "appearance",
    smart: "appearance"
  };
  const normalized = legacyMap[tabId] || tabId;
  return SETTINGS_TAB_IDS.includes(normalized) ? normalized : "general";
}

export function getSettingsTabLabel(tabId = "general") {
  return SETTINGS_TAB_LABELS[normalizeSettingsTab(tabId)];
}

export function getSettingsTabIndex(tabId = "general") {
  return SETTINGS_TAB_IDS.indexOf(normalizeSettingsTab(tabId));
}

export function getSettingsTabState(tabId = "general") {
  const normalized = normalizeSettingsTab(tabId);
  return {
    activeTab: normalized,
    activeIndex: getSettingsTabIndex(normalized),
    activeLabel: getSettingsTabLabel(normalized),
    tabs: SETTINGS_TABS
  };
}

export function hasMeaningfulSettingsDraftChanges(currentSettings = {}, draftSettings = {}, themeValue = "dark") {
  return JSON.stringify(getComparableSettingsForDraft(currentSettings, themeValue))
    !== JSON.stringify(getComparableSettingsForDraft(draftSettings, themeValue));
}

export function createSettingsTabUiPatch(settings = {}, tabId = "general") {
  return {
    ui: {
      ...(settings.ui || {}),
      lastSettingsTab: normalizeSettingsTab(tabId)
    }
  };
}

