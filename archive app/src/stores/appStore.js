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

export { pickStoreActions } from "./storeCore.js";
export { archiveActionKeys } from "./slices/archiveSlice.js";
export { settingsActionKeys } from "./slices/settingsSlice.js";
export { dataTransferActionKeys } from "./slices/dataTransferSlice.js";
export { uiActionKeys } from "./slices/uiSlice.js";
export { connectionStatusActionKeys } from "./slices/connectionStatusSlice.js";
export { relationsActionKeys } from "./slices/relationsSlice.js";

export const useAppStore = createStore((set, get) => ({
  ...archiveInitialState,
  ...settingsInitialState,
  ...uiInitialState,
  ...connectionStatusInitialState,
  ...relationsInitialState,
  ...createUiActions({ set, get }),
  ...createConnectionStatusActions({ set, get }),
  ...createRelationsActions({ set, get }),
  ...createArchiveActions({ set, get, getAuthStore: () => useAuthStore }),
  ...createSettingsActions({ set, get, getAuthStore: () => useAuthStore }),
  ...createDataTransferActions({ set, get })
}));

export const useAuthStore = createAuthStore({ createStore, useAppStore });
export const useSessionStore = createSessionStore({ createStore });

export function getAppStoreState() {
  return useAppStore.getState?.();
}

export function subscribeAppStore(listener) {
  return useAppStore.subscribe?.(listener);
}
