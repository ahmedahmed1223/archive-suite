import {
  useTheme
} from "../../theme/useTheme.js";
import {
  useAppStore,
  useAuthStore
} from "../../stores/index.js";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Bell,
  BookOpen,
  Bookmark,
  Copy,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clapperboard,
  ClipboardList,
  CloudUpload,
  CircleQuestionMark,
  Compass,
  Database,
  Eye,
  EyeOff,
  FolderOpen,
  Files,
  FolderTree,
  GitMerge,
  HardDrive,
  History,
  Inbox,
  Kanban,
  LayoutGrid,
  Link2,
  ListChecks,
  Menu,
  RotateCcw,
  Save,
  Search,
  Server,
  Settings2,
  Shield,
  Star,
  Tag,
  Users,
  Wand2,
  Workflow,
  X,
  Video
} from "lucide-react";
import * as React from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

import { FavoritesSidebarSection } from "../favorites/FavoritesSidebarSection.jsx";
import { ContextualQuickActions } from "./ContextualSidebar.jsx";
import { getSidebarNavigationGroups } from "./viewModel.js";
import { ACTIONS, canPerform } from "../../features/users/permissions.js";
import { USER_ROLES } from "../../features/users/viewModel.js";
import {
  getRoleProfileQuietPages,
  orderPageIdsForRoleProfile,
  resolveRoleProfileId
} from "../../features/onboarding/roleProfiles.js";
import { getUnreadNotifications } from "../../features/notifications/viewModel.js";
import {
  applySidebarLayout,
  getDefaultSidebarLayout,
  getSidebarDrawerFrame,
  hasSidebarLayoutDraftChanges,
  normalizeSidebarLayout,
  reorderSidebarItem,
  resolveSidebarResponsiveState,
  setSidebarCollapsed,
  setSidebarItemHidden,
  setSidebarItemPinned
} from "../../features/navigation/sidebarLayoutModel.js";

function getRoleMeta(roleId) {
  return USER_ROLES.find((role) => role.id === roleId) || USER_ROLES[USER_ROLES.length - 1];
}

// Map sidebar page ids to the RBAC action that gates them. Missing entries
// are treated as "always visible" (so personal pages like Dashboard, Search,
// Archive remain available to every authenticated user).
const SIDEBAR_PAGE_PERMISSIONS = {
  users: ACTIONS.USER_MANAGE,
  settings: ACTIONS.SETTINGS_EDIT,
  backup: ACTIONS.BACKUP_CREATE,
  reports: ACTIONS.AUDIT_VIEW,
  history: ACTIONS.AUDIT_VIEW,
  "sync-log": ACTIONS.AUDIT_VIEW
};


const iconMap = {
  dashboard: LayoutGrid,
  archive: Archive,
  discover: Compass,
  add: CirclePlus,
  search: Search,
  collections: FolderOpen,
  kanban: Kanban,
  projects: Clapperboard,
  "production-tasks": ClipboardList,
  types: FolderTree,
  vocabulary: BookOpen,
  htags: Tag,
  graph: Workflow,
  users: Users,
  settings: Shield,
  history: History,
  help: CircleQuestionMark,
  backup: HardDrive,
  uploader: CloudUpload,
  "file-manager": Files,
  transcriber: Wand2,
  reports: ChartColumn,
  "sync-log": GitMerge,
  favorites:        Star,
  "reading-lists":  ListChecks,
  "server-status":  Server,
  "duplicates":     Copy,
  "saved-searches": Bookmark,
  "shared-links":   Link2,
  "shared-with-me": Inbox
};

function useIsMobile() {
  const getIsMobile = React.useCallback(() => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function") return window.matchMedia("(max-width: 767px)").matches;
    return window.innerWidth < 768;
  }, []);
  const [isMobile, setIsMobile] = React.useState(getIsMobile);
  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const checkMobile = () => setIsMobile(getIsMobile());
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [getIsMobile]);
  return isMobile;
}

function SidebarButton({ page, active, onClick, badge, collapsed }) {
  const Icon = iconMap[page.id] || Database;
  return jsxs("button", {
    type: "button",
    onClick,
    "aria-current": active ? "page" : undefined,
    title: collapsed ? page.meta?.title : undefined,
    "aria-label": collapsed ? page.meta?.title : undefined,
    className: `va-sidebar-item ${active ? "va-sidebar-item-active" : ""} group relative flex min-h-11 w-full items-center gap-3 rounded-[var(--va-radius-lg)] px-3 py-2 text-right text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 ${
      active
        ? "bg-emerald-500/12 text-emerald-300"
        : "text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]"
    }`,
    children: [
      active && jsx("span", { className: "absolute inset-inline-end-0 right-0 top-2 bottom-2 w-1 rounded-full bg-emerald-500" }),
      jsx("span", {
        className: `flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--va-radius-md)] border transition-colors ${
          active ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-300" : "border-[var(--va-border-soft)] bg-[var(--va-surface-2)] group-hover:border-[var(--va-border-strong)]"
        }`,
        children: jsx(Icon, { className: "h-4 w-4" })
      }),
      !collapsed && jsxs("span", {
        className: "flex min-w-0 flex-1 items-center justify-between gap-2",
        children: [
          jsx("span", { className: "truncate", children: page.meta?.title || page.id }),
          badge && jsx("span", {
            className: "va-number-badge shrink-0 rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-[11px] text-[var(--va-text-2)]",
            children: badge
          })
        ]
      })
    ]
  });
}

export function Sidebar() {
  const {
    currentPage,
    setCurrentPage,
    setSelectedItemId,
    sidebarOpen,
    toggleSidebar,
    videoItems,
    lockApp,
    isPasswordSet,
    notificationHistory,
    notificationCenterOpen,
    toggleNotificationCenter,
    setSidebarOpen,
    settings = {},
    updateSettings,
    getWatchLaterCount
  } = useAppStore();
  const { currentUser, logout } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const isDark = resolvedTheme === "dark";
  const activeCount = videoItems.filter((item) => !item.isDeleted).length;
  const watchLaterCount = getWatchLaterCount?.() ?? 0;
  const unreadNotifications = getUnreadNotifications(notificationHistory);
  const roleProfileId = resolveRoleProfileId({ settings, currentUser });

  const permittedGroups = getSidebarNavigationGroups()
    .map((group) => ({
      ...group,
      pages: group.pages.filter((page) => {
        if (page.id === "detail") return false;
        const requiredAction = SIDEBAR_PAGE_PERMISSIONS[page.id];
        if (!requiredAction) return true;
        return canPerform(currentUser, requiredAction);
      })
    }))
    .filter((group) => group.pages.length > 0);
  const guidedGroups = React.useMemo(() => {
    const ids = permittedGroups.flatMap((group) => group.pages.map((page) => page.id));
    const order = new Map(orderPageIdsForRoleProfile(ids, roleProfileId).map((id, index) => [id, index]));
    return permittedGroups
      .map((group) => ({
        ...group,
        pages: [...group.pages].sort((first, second) => (order.get(first.id) ?? 999) - (order.get(second.id) ?? 999))
      }))
      .sort((first, second) => {
        const firstRank = Math.min(...first.pages.map((page) => order.get(page.id) ?? 999));
        const secondRank = Math.min(...second.pages.map((page) => order.get(page.id) ?? 999));
        return firstRank - secondRank;
      });
  }, [permittedGroups, roleProfileId]);

  // ── customizable sidebar (pin/hide/reorder + persisted collapse) ──
  const availableIds = React.useMemo(
    () => guidedGroups.flatMap((group) => group.pages.map((page) => page.id)),
    [guidedGroups]
  );
  const savedLayout = React.useMemo(
    () => {
      const normalized = normalizeSidebarLayout(settings.ui?.sidebarLayout, availableIds);
      if (settings.ui?.sidebarLayout) return normalized;
      const quietPages = new Set(getRoleProfileQuietPages(roleProfileId));
      if (quietPages.size === 0) return normalized;
      const items = { ...normalized.items };
      for (const pageId of quietPages) {
        if (items[pageId]) items[pageId] = { ...items[pageId], hidden: true };
      }
      return { ...normalized, items };
    },
    [settings.ui?.sidebarLayout, availableIds, roleProfileId]
  );
  const [editing, setEditing] = React.useState(false);
  const [draftLayout, setDraftLayout] = React.useState(null);
  const activeLayout = editing && draftLayout ? draftLayout : savedLayout;
  const responsiveSidebar = resolveSidebarResponsiveState({
    isMobile,
    requestedOpen: sidebarOpen,
    persistedCollapsed: activeLayout.collapsed,
    editing
  });
  const collapsed = responsiveSidebar.collapsed;
  const shaped = applySidebarLayout(guidedGroups, activeLayout, { editing });
  const drawerFrame = getSidebarDrawerFrame({ open: responsiveSidebar.drawerOpen });

  const setDrawerOpen = React.useCallback((open) => {
    if (setSidebarOpen) {
      setSidebarOpen(open);
      return;
    }
    if (open !== sidebarOpen) toggleSidebar?.();
  }, [setSidebarOpen, sidebarOpen, toggleSidebar]);

  const toggleDrawer = React.useCallback(() => {
    setDrawerOpen(!responsiveSidebar.drawerOpen);
  }, [responsiveSidebar.drawerOpen, setDrawerOpen]);

  React.useEffect(() => {
    if (!isMobile && sidebarOpen) setDrawerOpen(false);
  }, [isMobile, sidebarOpen, setDrawerOpen]);

  React.useEffect(() => {
    if (!responsiveSidebar.drawerOpen || typeof window === "undefined") return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [responsiveSidebar.drawerOpen, setDrawerOpen]);

  React.useEffect(() => {
    if (!responsiveSidebar.drawerOpen || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [responsiveSidebar.drawerOpen]);

  const persistLayout = (nextLayout) => {
    updateSettings?.({ ui: { ...(settings.ui || {}), sidebarLayout: nextLayout } });
  };
  const toggleCollapsed = () => persistLayout(setSidebarCollapsed(savedLayout, !savedLayout.collapsed));
  const startEditing = () => { setDraftLayout(savedLayout); setEditing(true); };
  const cancelEditing = () => { setDraftLayout(null); setEditing(false); };
  const saveEditing = () => { if (draftLayout) persistLayout(draftLayout); setDraftLayout(null); setEditing(false); };
  const resetLayout = () => setDraftLayout(getDefaultSidebarLayout(availableIds));

  const goToPage = (pageId) => {
    if (editing) return;
    setSelectedItemId(null);
    setCurrentPage(pageId);
    if (responsiveSidebar.drawerOpen) setDrawerOpen(false);
  };

  // Renders one nav entry: a plain button in view mode, or a button + edit
  // controls (pin / hide / move up / move down) in edit mode. `listIds` is the
  // ordered id list of the entry's own list (group or pinned) for reorder bounds.
  const renderItem = (page, listIds) => {
    const isActive = currentPage === page.id;
    if (!editing) {
      // DaisyUI menu item: wrap in <li> with `active` class for active state
      return jsxs("li", {
        className: isActive ? "active" : "",
        children: [
          jsx(SidebarButton, {
            page,
            active: isActive,
            onClick: () => goToPage(page.id),
            badge: page.id === "archive" ? activeCount : page.id === "reading-lists" ? (watchLaterCount > 0 ? watchLaterCount : undefined) : undefined,
            collapsed
          })
        ]
      }, page.id);
    }
    const index = listIds.indexOf(page.id);
    const title = page.meta?.title || page.id;
    const ctrl = "inline-flex h-7 w-7 items-center justify-center rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55";
    // Edit mode: <li> with block wrapper to bypass DaisyUI menu's flex defaults on children
    return jsxs("li", {
      className: "block !p-0",
      children: [
        jsxs("div", {
          className: `rounded-[var(--va-radius-lg)] border p-1 ${page._hidden ? "border-[var(--va-border-soft)] opacity-60" : "border-[var(--va-border-strong)]"}`,
          children: [
            jsx(SidebarButton, { page, active: false, onClick: () => {}, collapsed: false }),
            jsxs("div", {
              className: "mt-0.5 flex items-center justify-end gap-0.5 px-1 pb-0.5",
              children: [
                jsx("button", {
                  type: "button",
                  onClick: () => setDraftLayout((l) => setSidebarItemPinned(l, page.id, !page._pinned)),
                  title: page._pinned ? "إلغاء التثبيت" : "تثبيت",
                  "aria-label": page._pinned ? `إلغاء تثبيت ${title}` : `تثبيت ${title}`,
                  className: `inline-flex h-7 w-7 items-center justify-center rounded-[var(--va-radius-md)] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 ${page._pinned ? "border-amber-500/30 bg-amber-500/12 text-amber-300" : "border-[var(--va-border-soft)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]"}`,
                  children: jsx(Star, { className: "h-3.5 w-3.5", fill: page._pinned ? "currentColor" : "none" })
                }),
                jsx("button", {
                  type: "button",
                  onClick: () => setDraftLayout((l) => setSidebarItemHidden(l, page.id, !page._hidden)),
                  title: page._hidden ? "إظهار" : "إخفاء",
                  "aria-label": page._hidden ? `إظهار ${title}` : `إخفاء ${title}`,
                  className: ctrl,
                  children: page._hidden ? jsx(EyeOff, { className: "h-3.5 w-3.5" }) : jsx(Eye, { className: "h-3.5 w-3.5" })
                }),
                jsx("button", {
                  type: "button",
                  disabled: index <= 0,
                  onClick: () => setDraftLayout((l) => reorderSidebarItem(l, listIds, page.id, "up")),
                  title: "تحريك لأعلى",
                  "aria-label": `تحريك ${title} لأعلى`,
                  className: ctrl,
                  children: jsx(ArrowUp, { className: "h-3.5 w-3.5" })
                }),
                jsx("button", {
                  type: "button",
                  disabled: index >= listIds.length - 1,
                  onClick: () => setDraftLayout((l) => reorderSidebarItem(l, listIds, page.id, "down")),
                  title: "تحريك لأسفل",
                  "aria-label": `تحريك ${title} لأسفل`,
                  className: ctrl,
                  children: jsx(ArrowDown, { className: "h-3.5 w-3.5" })
                })
              ]
            })
          ]
        })
      ]
    }, page.id);
  };

  const sidebarContent = jsxs(Fragment, {
    children: [
      jsxs("div", {
        // When collapsed the narrow rail can't fit the logo + toggle side by
        // side, so they used to overflow under the top bar (hiding the expand
        // icon). Stack them vertically and shrink padding while collapsed.
        className: `va-sidebar-brand relative z-10 flex border-b border-[var(--va-border-soft)] bg-[var(--va-surface)] ${collapsed ? "flex-col items-center gap-2 p-3" : "items-center gap-3 p-5"}`,
        children: [
          jsx("div", {
            className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--va-radius-lg)] bg-emerald-500 shadow-[var(--va-elev-2)]",
            children: jsx(Video, { className: "h-5 w-5 text-[var(--va-text-inverse)]" })
          }),
          !collapsed && jsxs("div", {
            className: "min-w-0 flex-1",
            children: [
              jsx("h2", { className: "truncate text-lg font-bold text-[var(--va-text)]", children: "أرشيف الفيديو" }),
              jsx("p", { className: "truncate text-xs text-[var(--va-text-muted)]", children: "نظام إدارة الأرشيف" })
            ]
          }),
          !isMobile && !editing && jsx("button", {
            type: "button",
            onClick: toggleCollapsed,
            className: "inline-flex h-8 w-8 items-center justify-center rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
            title: collapsed ? "توسيع القائمة" : "طي القائمة",
            "aria-label": collapsed ? "توسيع القائمة" : "طي القائمة",
            children: collapsed ? jsx(ChevronLeft, { className: "h-4 w-4" }) : jsx(ChevronRight, { className: "h-4 w-4" })
          }),
          isMobile && jsx("button", {
            type: "button",
            onClick: () => setDrawerOpen(false),
            className: "inline-flex h-8 w-8 items-center justify-center rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
            "aria-label": "إغلاق القائمة الجانبية",
            children: jsx(X, { className: "h-4 w-4" })
          })
        ]
      }),
      jsx("nav", {
        className: "custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-3",
        "aria-label": "روابط القائمة الجانبية",
        children: jsxs(Fragment, {
          children: [
            !editing && jsx(ContextualQuickActions, {
              currentPage,
              collapsed,
              onNavigate: (action) => goToPage(action.targetPage)
            }),
            !editing && jsx(FavoritesSidebarSection, {
              collapsed,
              onNavigate: () => { if (responsiveSidebar.drawerOpen) setDrawerOpen(false); }
            }),
            editing && jsxs("div", {
              className: "sticky top-0 z-10 -mx-1 mb-1 flex items-center gap-1.5 rounded-[var(--va-radius-lg)] border border-emerald-500/25 bg-emerald-500/12 p-2 shadow-[var(--va-elev-1)] backdrop-blur",
              children: [
                jsxs("button", { type: "button", onClick: saveEditing, className: "inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-[var(--va-radius-md)] bg-emerald-500 px-3 text-xs font-medium text-[var(--va-text-inverse)] transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55", children: [jsx(Save, { className: "h-3.5 w-3.5" }), "حفظ"] }),
                jsx("button", { type: "button", onClick: cancelEditing, title: "إلغاء", "aria-label": "إلغاء التخصيص", className: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55", children: jsx(X, { className: "h-4 w-4" }) }),
                jsx("button", { type: "button", onClick: resetLayout, title: "استعادة الافتراضي", "aria-label": "استعادة الترتيب الافتراضي", className: "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55", children: jsx(RotateCcw, { className: "h-4 w-4" }) })
              ]
            }),
            shaped.pinned.length > 0 && jsx("section", {
              children: jsxs("ul", {
                className: "menu menu-sm p-0 w-full gap-0.5",
                children: [
                  !collapsed && jsxs("li", {
                    className: "menu-title flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-400/90 py-1",
                    children: [jsx(Star, { className: "h-3 w-3", fill: "currentColor" }), "مثبّتة"]
                  }),
                  ...shaped.pinned.map((page) => renderItem(page, shaped.pinned.map((p) => p.id)))
                ]
              })
            }, "pinned"),
            ...shaped.groups.map((group) => jsx("section", {
              children: jsxs("ul", {
                className: "menu menu-sm p-0 w-full gap-0.5",
                children: [
                  !collapsed && jsx("li", {
                    className: "menu-title text-xs font-semibold uppercase tracking-wide text-[var(--va-text-muted)] py-1",
                    children: group.label
                  }),
                  ...group.pages.map((page) => renderItem(page, group.pages.map((p) => p.id)))
                ]
              })
            }, group.id))
          ]
        })
      }),
      jsxs("div", {
        className: "space-y-2 border-t border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3",
        children: [
          jsxs("button", {
            type: "button",
            onClick: toggleNotificationCenter,
            "aria-label": collapsed ? "مركز الرسائل" : undefined,
            className: `flex min-h-10 w-full items-center gap-3 rounded-[var(--va-radius-lg)] px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 ${
              notificationCenterOpen ? "bg-emerald-500/12 text-emerald-300" : "text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]"
            }`,
            children: [
              jsx(Bell, { className: "h-4 w-4 shrink-0", "aria-hidden": "true" }),
              !collapsed && jsxs("span", {
                className: "flex min-w-0 flex-1 items-center justify-between gap-2",
                children: [
                  jsx("span", { children: "مركز الرسائل" }),
                  unreadNotifications.length > 0 && jsx("span", {
                    className: "va-number-badge rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-[11px] text-[var(--va-text-2)]",
                    children: unreadNotifications.length
                  })
                ]
              })
            ]
          }),
          !editing && !collapsed && jsxs("button", {
            type: "button",
            onClick: startEditing,
            className: "flex min-h-10 w-full items-center gap-3 rounded-[var(--va-radius-lg)] px-3 py-2 text-sm text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
            title: "تثبيت/إخفاء/ترتيب عناصر القائمة",
            children: [
              jsx(Settings2, { className: "h-4 w-4 shrink-0 text-emerald-400" }),
              "تخصيص القائمة"
            ]
          }),
          isPasswordSet && !editing && jsxs("button", {
            type: "button",
            onClick: lockApp,
            "aria-label": collapsed ? "قفل التطبيق" : undefined,
            className: "flex min-h-10 w-full items-center gap-3 rounded-[var(--va-radius-lg)] px-3 py-2 text-sm text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
            children: [
              jsx(Shield, { className: "h-4 w-4 shrink-0", "aria-hidden": "true" }),
              !collapsed && "قفل التطبيق"
            ]
          }),
          currentUser && !collapsed && (() => {
            const roleMeta = getRoleMeta(currentUser.role);
            return jsxs("div", {
              className: "rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3 shadow-[var(--va-elev-1)]",
              children: [
                jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                  jsx("p", { className: "truncate text-sm font-medium text-[var(--va-text)]", children: currentUser.displayName || currentUser.name || currentUser.username || "مستخدم" }),
                  jsx("span", {
                    className: "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    style: { borderColor: `${roleMeta.color}55`, backgroundColor: `${roleMeta.color}18`, color: roleMeta.color },
                    title: roleMeta.description,
                    children: roleMeta.label
                  })
                ] }),
                currentUser.username && jsx("p", {
                  className: "mt-1 truncate text-xs text-[var(--va-text-muted)] font-mono",
                  dir: "ltr",
                  children: `@${currentUser.username}`
                }),
                jsxs("div", {
                  className: "mt-3 flex flex-wrap gap-2",
                  children: [
                    isPasswordSet && jsx("button", {
                      type: "button",
                      onClick: lockApp,
                      className: "flex-1 min-w-0 rounded-[var(--va-radius-md)] border border-emerald-500/25 bg-emerald-500/12 px-3 py-1.5 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
                      title: "ارجع إلى شاشة الدخول للتبديل لحساب آخر",
                      children: "تبديل المستخدم"
                    }),
                    jsx("button", {
                      type: "button",
                      onClick: logout,
                      className: "flex-1 min-w-0 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] px-3 py-1.5 text-xs text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
                      children: "تسجيل الخروج"
                    })
                  ]
                })
              ]
            });
          })()
        ]
      })
    ]
  });

  if (isMobile) {
    return jsxs("div", {
      className: drawerFrame.rootClassName,
      dir: "rtl",
      children: [
        jsx("div", {
          className: drawerFrame.contentClassName,
          children: jsx("button", {
            type: "button",
            onClick: toggleDrawer,
            className: drawerFrame.toggleClassName,
            "aria-label": responsiveSidebar.drawerOpen ? "إغلاق القائمة الجانبية" : "فتح القائمة الجانبية",
            children: responsiveSidebar.drawerOpen ? jsx(X, { className: "h-5 w-5" }) : jsx(Menu, { className: "h-5 w-5" })
          })
        }),
        responsiveSidebar.drawerOpen && jsxs("div", {
          className: drawerFrame.sideClassName,
          children: [
            jsx("button", {
              type: "button",
              className: drawerFrame.overlayClassName,
              onClick: () => setDrawerOpen(false),
              "aria-label": "إغلاق القائمة الجانبية"
            }),
            jsx("aside", {
              role: "navigation",
              "aria-label": "القائمة الجانبية",
              className: drawerFrame.panelClassName,
              style: drawerFrame.panelStyle,
              dir: "rtl",
              children: sidebarContent
            })
          ]
        })
      ]
    });
  }

  return jsx("aside", {
        role: "navigation",
        "aria-label": "القائمة الجانبية",
        // RTL: the sidebar is anchored on the inline-start (visual right). border-s
        // draws the divider on the inline-start edge facing the content area.
        className: `va-sidebar ${collapsed ? "w-[72px]" : "w-[clamp(240px,18vw,280px)]"} flex h-screen shrink-0 flex-col border-s border-[var(--va-border-soft)] bg-[var(--va-surface)] shadow-[var(--va-elev-1)] transition-[width] duration-200`,
        dir: "rtl",
        children: sidebarContent
  });
}

Sidebar.displayName = "Sidebar";
Sidebar.componentId = "sidebar";
Sidebar.migrationStatus = "native";

export default Sidebar;
