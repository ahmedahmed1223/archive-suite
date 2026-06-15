import { createStore, pickStoreActions } from "./storeCore.js";
import {
  archiveActionKeys,
  archiveInitialState,
  createArchiveActions
} from "./slices/archiveSlice.js";
import {
  createSettingsActions,
  settingsActionKeys,
  settingsInitialState
} from "./slices/settingsSlice.js";
import {
  createDataTransferActions,
  dataTransferActionKeys
} from "./slices/dataTransferSlice.js";
import {
  createUiActions,
  uiActionKeys,
  uiInitialState
} from "./slices/uiSlice.js";
import {
  connectionStatusActionKeys,
  connectionStatusInitialState,
  createConnectionStatusActions
} from "./slices/connectionStatusSlice.js";
import {
  createRelationsActions,
  relationsActionKeys,
  relationsInitialState
} from "./slices/relationsSlice.js";
import {
  createAuthStore,
  createSessionStore
} from "./slices/authSlice.js";
import {
  createTemplatesActions,
  templatesActionKeys,
  templatesInitialState
} from "./slices/templatesSlice.js";
import {
  autosaveActionKeys,
  autosaveInitialState,
  createAutosaveActions
} from "./slices/autosaveSlice.js";
import {
  activityLogActionKeys,
  activityLogInitialState,
  createActivityLogActions
} from "./slices/activityLogSlice.js";
import {
  createFoldersActions,
  foldersActionKeys,
  foldersInitialState
} from "./slices/foldersSlice.js";
import {
  createFavoritesActions,
  favoritesActionKeys,
  favoritesInitialState
} from "./slices/favoritesSlice.js";
import {
  createReadingListsActions,
  readingListsActionKeys,
  readingListsInitialState
} from "./slices/readingListsSlice.js";
import {
  createSavedSearchesActions,
  savedSearchesActionKeys,
  savedSearchesInitialState
} from "./slices/savedSearchesSlice.js";
import {
  createUploadActions,
  uploadActionKeys,
  uploadInitialState
} from "./slices/uploadSlice.js";
import {
  createInboxActions,
  inboxActionKeys,
  inboxInitialState
} from "./slices/inboxSlice.js";
import {
  createItemNotesActions,
  itemNotesActionKeys,
  itemNotesInitialState
} from "./slices/itemNotesSlice.js";
import {
  copilotActionKeys,
  copilotInitialState,
  createCopilotActions
} from "./slices/copilotSlice.js";

export { pickStoreActions } from "./storeCore.js";
export { archiveActionKeys } from "./slices/archiveSlice.js";
export { settingsActionKeys } from "./slices/settingsSlice.js";
export { dataTransferActionKeys } from "./slices/dataTransferSlice.js";
export { uiActionKeys } from "./slices/uiSlice.js";
export { connectionStatusActionKeys } from "./slices/connectionStatusSlice.js";
export { templatesActionKeys } from "./slices/templatesSlice.js";
export { autosaveActionKeys } from "./slices/autosaveSlice.js";
export { relationsActionKeys } from "./slices/relationsSlice.js";
export { activityLogActionKeys } from "./slices/activityLogSlice.js";
export { foldersActionKeys } from "./slices/foldersSlice.js";
export { favoritesActionKeys } from "./slices/favoritesSlice.js";
export { readingListsActionKeys } from "./slices/readingListsSlice.js";
export { savedSearchesActionKeys } from "./slices/savedSearchesSlice.js";
export { uploadActionKeys } from "./slices/uploadSlice.js";
export { inboxActionKeys } from "./slices/inboxSlice.js";
export { itemNotesActionKeys } from "./slices/itemNotesSlice.js";
export { copilotActionKeys } from "./slices/copilotSlice.js";

export const useAppStore = createStore((set, get) => ({
  ...archiveInitialState,
  ...settingsInitialState,
  ...uiInitialState,
  ...connectionStatusInitialState,
  ...templatesInitialState,
  ...autosaveInitialState,
  ...relationsInitialState,
  ...activityLogInitialState,
  ...foldersInitialState,
  ...favoritesInitialState,
  ...readingListsInitialState,
  ...savedSearchesInitialState,
  ...uploadInitialState,
  ...inboxInitialState,
  ...itemNotesInitialState,
  ...copilotInitialState,
  ...createUiActions({ set, get }),
  ...createConnectionStatusActions({ set, get }),
  ...createRelationsActions({ set, get }),
  ...createArchiveActions({ set, get, getAuthStore: () => useAuthStore }),
  ...createSettingsActions({ set, get, getAuthStore: () => useAuthStore }),
  ...createDataTransferActions({ set, get }),
  ...createTemplatesActions({ set, get }),
  ...createAutosaveActions({ set, get }),
  ...createActivityLogActions({ set, get }),
  ...createFoldersActions({ set, get }),
  ...createFavoritesActions({ set, get }),
  ...createReadingListsActions({ set, get }),
  ...createSavedSearchesActions({ set, get }),
  ...createUploadActions({ set, get }),
  ...createInboxActions({ set, get }),
  ...createItemNotesActions({ set, get }),
  ...createCopilotActions({ set, get })
}));

export const useAuthStore = createAuthStore({ createStore, useAppStore });
export const useSessionStore = createSessionStore({ createStore });

export function getAppStoreState() {
  return useAppStore.getState?.();
}

export function subscribeAppStore(listener) {
  return useAppStore.subscribe?.(listener);
}
