import { generateId, nowIso } from "../storeCore.js";
import { normalizeNotification, shouldShowNotificationToast } from "../../features/notifications/viewModel.js";
import { normalizeNavIds } from "../../features/navigation/navigationContext.js";

export const uiInitialState = {
  currentPage: "dashboard",
  selectedItemId: null,
  // Ordered ids of the current filtered archive list (§1408). Persisted when an
  // item is opened so the detail page can step next/previous without returning
  // to the archive.
  navItemIds: [],
  selectedTypeId: null,
  sidebarOpen: false,
  isLoading: true,
  isLocked: false,
  toast: null,
  notifications: [],
  notificationHistory: [],
  notificationCenterOpen: false,
  backgroundOperation: null,
  recentSearches: [],
  focusMode: false,
  focusDoNotDisturb: false
};

export const uiActionKeys = [
  "goToPage",
  "showNotification",
  "showToast",
  "updateNotificationProgress",
  "finalizeNotification",
  "dismissNotification",
  "clearNotifications",
  "clearNotificationHistory",
  "archiveNotification",
  "toggleNotificationCenter",
  "markNotificationsRead",
  "markAllNotificationsRead",
  "setSidebarOpen",
  "toggleSidebar",
  "openDataTab",
  "openHelpSection",
  "setCurrentPage",
  "setSelectedItemId",
  "setNavItemIds",
  "addRecentSearch",
  "clearRecentSearches",
  "setFocusMode",
  "toggleFocusMode",
  "setFocusDoNotDisturb"
];

function scheduleNotificationDismiss(callback, timeout) {
  const timer = globalThis.window?.setTimeout || globalThis.setTimeout;
  if (typeof timer === "function") timer(callback, timeout);
}

function pruneNotificationHistory(history = [], retentionDays = 30) {
  const days = Math.max(1, Math.min(365, Number(retentionDays) || 30));
  const floor = Date.now() - days * 86400000;
  return (history || []).filter((item) => {
    const timestamp = new Date(item.createdAt || 0).getTime();
    return Number.isNaN(timestamp) || timestamp >= floor;
  });
}

export function createUiActions({ set, get }) {
  return {
    showNotification: (message, options = {}) => {
      const type = options.type || "info";
      const isError = type === "error";
      const isPersistent = options.persistent !== undefined ? !!options.persistent : isError;
      const groupKey = options.groupKey || null;

      // Grouping: if same groupKey exists in active notifications, update count instead of adding
      if (groupKey) {
        const state = get();
        const existing = (state.notifications || []).find((n) => n.groupKey === groupKey);
        if (existing) {
          const newCount = (existing.count || 1) + 1;
          const groupedMessage = options.groupTemplate
            ? String(options.groupTemplate).replace("{count}", newCount)
            : `${newCount} ${String(message || "").replace(/^(\d+\s*)/, "")}`.trim();
          set((st) => ({
            notifications: (st.notifications || []).map((n) =>
              n.groupKey === groupKey ? { ...n, count: newCount, message: groupedMessage, updatedAt: nowIso() } : n
            )
          }));
          return existing.id;
        }
      }

      const notification = normalizeNotification({
        id: options.id || generateId("notification"),
        title: options.title || (type === "error" ? "خطأ" : type === "warning" ? "تنبيه" : type === "success" ? "تم بنجاح" : "معلومة"),
        message: String(message || ""),
        type,
        category: options.category || "system",
        targetLabel: options.targetLabel || "",
        createdAt: nowIso(),
        persistent: isPersistent,
        count: 1,
        groupKey,
        progress: typeof options.progress === "number" ? Math.min(100, Math.max(0, options.progress)) : undefined,
        action: options.action && typeof options.action.run === "function"
          ? { label: String(options.action.label || "إجراء"), run: options.action.run, dismissOnRun: options.action.dismissOnRun !== false }
          : null
      });
      // Do-Not-Disturb (Focus Mode §17.7): keep recording to history but
      // suppress the visible toast — except for errors, which must surface.
      const dndActive = get().focusMode && get().focusDoNotDisturb && type !== "error";
      const visibleToast = !dndActive && shouldShowNotificationToast(get().settings || {}, notification);
      const retentionDays = get().settings?.notifications?.retentionDays || 30;

      const PRIORITY = { error: 0, warning: 1, success: 2, info: 3 };
      set((state) => {
        const base = state.notifications || [];
        const merged = visibleToast ? [notification, ...base] : base;
        const sorted = merged.slice(0, 6).sort((a, b) => (PRIORITY[a.type] ?? 3) - (PRIORITY[b.type] ?? 3));
        return {
          toast: visibleToast ? { message: notification.message, type } : state.toast,
          notifications: sorted,
          notificationHistory: pruneNotificationHistory([notification, ...(state.notificationHistory || [])], retentionDays).slice(0, 160)
        };
      });
      if (visibleToast && !isPersistent) {
        scheduleNotificationDismiss(
          () => get().dismissNotification(notification.id),
          options.durationMs || get().settings.notifications?.durationMs || 5500
        );
      }
      return notification.id;
    },
    updateNotificationProgress: (id, progress) => {
      const clamped = Math.min(100, Math.max(0, Number(progress) || 0));
      set((state) => ({
        notifications: (state.notifications || []).map((n) =>
          n.id === id ? { ...n, progress: clamped } : n
        ),
        // Keep history (the source of truth for the Notification Center) in sync
        // so progress bars in the center advance, not just the live toast.
        notificationHistory: (state.notificationHistory || []).map((n) =>
          n.id === id ? { ...n, progress: clamped } : n
        )
      }));
    },
    // Resolve a long-running notification in place: drop its live toast and
    // patch the history entry to its terminal state (success/error). Keeps the
    // Notification Center to a single entry per operation instead of a stuck
    // progress row plus a separate completion row.
    finalizeNotification: (id, patch = {}) => set((state) => {
      const allowed = ["type", "title", "message", "progress", "targetLabel"];
      const clean = {};
      for (const key of allowed) {
        if (patch[key] !== undefined) clean[key] = patch[key];
      }
      return {
        notifications: (state.notifications || []).filter((item) => item.id !== id),
        toast: state.notifications?.length <= 1 ? null : state.toast,
        notificationHistory: (state.notificationHistory || []).map((item) =>
          item.id === id ? { ...item, ...clean, updatedAt: nowIso() } : item
        )
      };
    }),
    showToast: (message, type = "info") => get().showNotification(message, { type }),
    dismissNotification: (id) => set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
      toast: state.notifications.length <= 1 ? null : state.toast
    })),
    clearNotifications: () => set({ notifications: [], toast: null }),
    clearNotificationHistory: () => set({ notificationHistory: [] }),
    archiveNotification: (id) => {
      const archivedAt = nowIso();
      set((state) => ({
        notifications: (state.notifications || []).filter((item) => item.id !== id),
        notificationHistory: (state.notificationHistory || []).map((item) => item.id === id ? { ...item, archivedAt, readAt: item.readAt || archivedAt } : item)
      }));
    },
    markNotificationsRead: (ids = []) => {
      const wanted = new Set(Array.isArray(ids) ? ids : [ids]);
      if (!wanted.size) return;
      const readAt = nowIso();
      set((state) => ({
        notificationHistory: (state.notificationHistory || []).map((item) => (
          wanted.has(item.id) && !item.readAt ? { ...item, readAt } : item
        ))
      }));
    },
    markAllNotificationsRead: () => {
      const readAt = nowIso();
      set((state) => ({
        notificationHistory: (state.notificationHistory || []).map((item) => (item.readAt ? item : { ...item, readAt }))
      }));
    },
    toggleNotificationCenter: () => set((state) => ({ notificationCenterOpen: !state.notificationCenterOpen })),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen: !!sidebarOpen }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setCurrentPage: (page) => set({ currentPage: page }),
    goToPage: (page) => set({ currentPage: page, selectedItemId: null }),
    setSelectedItemId: (id) => set({ selectedItemId: id }),
    setNavItemIds: (ids) => set({ navItemIds: normalizeNavIds(ids) }),
    openDataTab: async (tab = "export") => {
      await get().updateSettings?.({ ui: { lastDataCenterTab: tab } });
      set({ currentPage: "backup", selectedItemId: null });
    },
    openHelpSection: async (section = "getting-started") => {
      await get().updateSettings?.({ ui: { lastHelpSection: section } });
      set({ currentPage: "help", selectedItemId: null });
    },
    setBackgroundOperation: (backgroundOperation) => set({ backgroundOperation }),
    cancelBackgroundOperation: () => set({ backgroundOperation: null }),
    addRecentSearch: (query) => {
      if (!query || !query.trim()) return;
      const normalized = query.trim();
      set((state) => {
        const filtered = (state.recentSearches || []).filter((item) => item !== normalized);
        return { recentSearches: [normalized, ...filtered].slice(0, 12) };
      });
    },
    clearRecentSearches: () => set({ recentSearches: [] }),
    setFocusMode: (focusMode) => set({ focusMode: !!focusMode }),
    toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
    setFocusDoNotDisturb: (focusDoNotDisturb) => set({ focusDoNotDisturb: !!focusDoNotDisturb })
  };
}
