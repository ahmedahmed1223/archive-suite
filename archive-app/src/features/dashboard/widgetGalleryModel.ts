/**
 * Widget Gallery — pure model helpers.
 * Thin wrappers over dashboardLayoutModel's setPanelHidden so the gallery
 * has a clean API without inventing a parallel model.
 */

import type {
  DashboardLayout,
  DashboardLayoutItems
} from "./dashboardLayoutModel.js";
import { setPanelHidden } from "./dashboardLayoutModel.js";

export interface WidgetDescriptor {
  id: string;
  label: string;
  visible: boolean;
}

/**
 * Returns the ordered list of widget descriptors for the gallery UI.
 * `panelTitles` maps id -> Arabic label (passed from the page, not duplicated here).
 */
export function listWidgets(
  layout: DashboardLayout | null | undefined,
  panelTitles: Record<string, string>
): WidgetDescriptor[] {
  const items: DashboardLayoutItems = layout?.items || {};
  return Object.keys(panelTitles).map((id) => ({
    id,
    label: panelTitles[id] || id,
    visible: !items[id]?.hidden
  }));
}

/** Toggle a single widget's hidden flag. Delegates to existing setPanelHidden. */
export function toggleWidgetVisibility(
  layout: DashboardLayout | null | undefined,
  id: string
): DashboardLayout {
  const items: DashboardLayoutItems = layout?.items || {};
  const currentlyHidden = !!items[id]?.hidden;
  return setPanelHidden(layout, id, !currentlyHidden);
}

/** Show a widget (make visible). */
export function addWidget(
  layout: DashboardLayout | null | undefined,
  id: string
): DashboardLayout {
  return setPanelHidden(layout, id, false);
}

/** Hide a widget. */
export function removeWidget(
  layout: DashboardLayout | null | undefined,
  id: string
): DashboardLayout {
  return setPanelHidden(layout, id, true);
}
