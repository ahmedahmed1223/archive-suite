export { useAuthStore, useSessionStore } from "./appStore.js";

export const selectAuthSlice = (state: Record<string, any>) => ({
  currentUser: state.currentUser || null,
  isAuthenticated: !!state.isAuthenticated,
  isLocked: !!state.isLocked,
  sessionExpiresAt: state.sessionExpiresAt || null
});
