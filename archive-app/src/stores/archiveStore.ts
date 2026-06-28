export { useAppStore as useArchiveStore } from "./appStore.js";
import { archiveActionKeys, pickStoreActions } from "./appStore.js";
import { selectArchiveFilters } from "./selectors.js";
export {
  selectActiveItems,
  selectArchiveFilters,
  selectContentTypes,
  selectDeletedItems,
  selectFavoriteItems,
  selectVideoItems
} from "./selectors.js";

export const selectArchiveActions = (state: Record<string, any>) => pickStoreActions(state, archiveActionKeys);

export const selectArchiveSlice = (state: Record<string, any>) => ({
  videoItems: state.videoItems || [],
  contentTypes: state.contentTypes || [],
  filters: selectArchiveFilters(state),
  selectedItemId: state.selectedItemId || null,
  selectedItems: state.selectedItems || []
});
