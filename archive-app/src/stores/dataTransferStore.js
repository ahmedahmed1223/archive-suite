export { useAppStore as useDataTransferStore } from "./appStore.js";
import {
  dataTransferActionKeys,
  pickStoreActions
} from "./appStore.js";
import { selectDataTransferSummary } from "./selectors.js";
export { selectDataTransferSummary, selectSystemReadiness } from "./selectors.js";

export const selectDataTransferActions = (state) => pickStoreActions(state, dataTransferActionKeys);

export const selectDataTransferSlice = (state) => ({
  summary: selectDataTransferSummary(state),
  backups: state.backups || [],
  settings: state.settings || {},
  sqliteReady: !!state.sqliteReady,
  sqliteError: state.sqliteError || null
});
