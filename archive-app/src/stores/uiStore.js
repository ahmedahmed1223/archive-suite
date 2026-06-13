export { useAppStore as useUiStore } from "./appStore.js";
import {
  pickStoreActions,
  uiActionKeys
} from "./appStore.js";
export { selectArchiveFilters, selectSystemReadiness } from "./selectors.js";

export const selectUiActions = (state) => pickStoreActions(state, uiActionKeys);

export const selectUiSlice = (state) => ({
  currentPage: state.currentPage || "dashboard",
  selectedItemId: state.selectedItemId || null,
  isLoading: !!state.isLoading,
  isLocked: !!state.isLocked,
  notifications: state.notifications || [],
  settings: state.settings || {}
});
