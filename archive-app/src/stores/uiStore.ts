export { useAppStore as useUiStore } from "./appStore.js";
import { pickStoreActions, uiActionKeys } from "./appStore.js";
export { selectArchiveFilters, selectSystemReadiness } from "./selectors.js";

export const selectUiActions = (state: Record<string, any>) => pickStoreActions(state, uiActionKeys);

export const selectUiSlice = (state: Record<string, any>) => ({
  currentPage: state.currentPage || "dashboard",
  selectedItemId: state.selectedItemId || null,
  isLoading: !!state.isLoading,
  isLocked: !!state.isLocked,
  notifications: state.notifications || [],
  settings: state.settings || {}
});
