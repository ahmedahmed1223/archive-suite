export { useAppStore as useDataTransferStore } from "./appStore.js";
import { dataTransferActionKeys, pickStoreActions } from "./appStore.js";
import { selectDataTransferSummary } from "./selectors.js";
export { selectDataTransferSummary, selectSystemReadiness } from "./selectors.js";

export const selectDataTransferActions = (state: Record<string, any>) =>
  pickStoreActions(state, dataTransferActionKeys);

export const selectDataTransferSlice = (state: Record<string, any>) => ({
  summary: selectDataTransferSummary(state),
  backups: state.backups || [],
  settings: state.settings || {},
  sqliteReady: !!state.sqliteReady,
  sqliteError: state.sqliteError || null
});
