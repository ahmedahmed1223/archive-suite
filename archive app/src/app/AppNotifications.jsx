/**
 * AppNotifications - global overlay layer.
 *
 * All children render via createPortal into document.body, so this component
 * can safely live as a sibling to AppRouter in a Fragment — no wrapper div
 * needed.
 *
 * Contains:
 *   - ToastNotification
 *   - NotificationDrawer
 *   - UndoRedoBar
 *   - StatusBar
 *   - KeyboardShortcutsDialog
 *   - CommandPalette
 *   - QuickAddDialog
 *   - V1ProductTour
 *   - ForceChangePasswordDialog
 *
 * Props are passed from RuntimeShellApp so state stays in one place.
 */
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  CommandPalette,
  ForceChangePasswordDialog,
  StatusBar,
  ToastNotification,
  UndoRedoBar,
  V1ProductTour,
} from "./shell/ShellParts.jsx";
import { NotificationDrawer } from "../components/common/NotificationDrawer.jsx";
import { QuickAddDialog } from "../features/videos/QuickAddDialog.jsx";
import { KeyboardShortcutsDialog } from "../components/common/KeyboardShortcutsDialog.jsx";

export function AppNotifications({
  showShortcuts,
  setShowShortcuts,
  showCommandPalette,
  setShowCommandPalette,
  showQuickAdd,
  setShowQuickAdd,
  showV1Tour,
  onCompleteV1Tour,
  onSkipV1Tour,
  currentUserRole,
}) {
  return jsxs(React.Fragment, {
    children: [
      jsx(ToastNotification, {}),
      jsx(NotificationDrawer, {}),
      jsx(UndoRedoBar, {}),
      jsx(StatusBar, {}),
      jsx(KeyboardShortcutsDialog, {
        open: showShortcuts,
        onOpenChange: setShowShortcuts,
      }),
      jsx(CommandPalette, {
        open: showCommandPalette,
        onOpenChange: setShowCommandPalette,
        onOpenShortcuts: () => setShowShortcuts(true),
        onOpenQuickAdd: () => setShowQuickAdd(true),
      }),
      jsx(QuickAddDialog, {
        open: showQuickAdd,
        onOpenChange: setShowQuickAdd,
      }),
      jsx(V1ProductTour, {
        open: showV1Tour,
        role: currentUserRole,
        onComplete: onCompleteV1Tour,
        onSkip: onSkipV1Tour,
      }),
      jsx(ForceChangePasswordDialog, {}),
    ],
  });
}
