export { useAppStore as useSettingsStore } from "./appStore.js";
import { pickStoreActions, settingsActionKeys } from "./appStore.js";
export { selectSettings, selectSystemReadiness } from "./selectors.js";

export const selectSettingsActions = (state: Record<string, any>) => pickStoreActions(state, settingsActionKeys);

export const selectSettingsSlice = (state: Record<string, any>) => ({
  settings: state.settings || {},
  isPasswordSet: !!state.isPasswordSet,
  sqliteReady: !!state.sqliteReady,
  sqliteError: state.sqliteError || null
});
