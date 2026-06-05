export {
  useAuthStore,
  useSessionStore
} from "./appStore.js";

export const selectAuthSlice = (state) => ({
  currentUser: state.currentUser || null,
  isAuthenticated: !!state.isAuthenticated,
  isLocked: !!state.isLocked,
  sessionExpiresAt: state.sessionExpiresAt || null
});
