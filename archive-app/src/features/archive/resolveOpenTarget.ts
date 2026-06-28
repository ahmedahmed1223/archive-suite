/**
 * §19.9 — Decide where an Archive/Types open or edit action should land.
 *
 * The product default is a dedicated full page/view ("detail") rather than the
 * sliding `SideEditPanel` drawer added in §1300. The side panel is kept as an
 * explicit, opt-in secondary affordance gated behind `settings.ui.editInSidePanel`
 * (which defaults to FALSE). This keeps the behavior backward-compatible while
 * making "open in a dedicated page" the clear default everywhere.
 *
 * Pure decision function — no React, no side effects — so it can be unit-tested
 * in isolation and shared by any caller that needs the same routing rule.
 */

export type OpenAction = "open" | "edit";
export type OpenTarget = "detail" | "sidePanel";

export interface ResolveOpenTargetParams {
  action?: unknown;
  editInSidePanel?: boolean;
}

const VALID_ACTIONS = new Set<OpenAction>(["open", "edit"]);

/**
 * Resolve the target surface for an item open/edit interaction.
 *
 * - `open` always lands on the dedicated detail page.
 * - `edit` lands on the dedicated detail page by default; it only uses the side
 *   panel when the user explicitly opted into `editInSidePanel`.
 *
 * @param {object} params
 * @param {OpenAction} [params.action="open"] - the interaction kind.
 * @param {boolean} [params.editInSidePanel=false] - user preference; when true,
 *   an `edit` action opens the side panel instead of the dedicated page.
 * @returns {OpenTarget} the surface the caller should route to.
 */
export function resolveOpenTarget({ action = "open", editInSidePanel = false }: ResolveOpenTargetParams = {}): OpenTarget {
  const normalizedAction: OpenAction = VALID_ACTIONS.has(action as OpenAction) ? action as OpenAction : "open";
  if (normalizedAction === "edit" && editInSidePanel === true) {
    return "sidePanel";
  }
  return "detail";
}

/**
 * Read the side-panel-edit preference off the settings object. Anything other
 * than an explicit `true` is treated as the safe default (dedicated page).
 *
 * @param {{ ui?: { editInSidePanel?: unknown } } | null | undefined} settings
 * @returns {boolean}
 */
export function isEditInSidePanelEnabled(settings: { ui?: { editInSidePanel?: unknown } } | null | undefined): boolean {
  return settings?.ui?.editInSidePanel === true;
}
