/**
 * Pure model for per-page contextual tips (§1152).
 *
 * A short, dismissible hint shown near a page header that points the user at
 * that page's most useful action and links into the matching help section.
 * The tip text reuses the existing page metadata (`meta.hint` /
 * `meta.helpSection`) from `app/pageManifest.js` so there is a single source of
 * truth and no content drift with the help center.
 *
 * Pure: no React / store / DOM. The component layer renders the descriptor and
 * persists dismissed tip ids under `settings.ui.tipsDismissed` via
 * `updateSettings`.
 */

import { PAGE_CONTEXT_META } from "../../app/pageManifest.js";
import { normalizeHelpSectionId } from "../help/viewModel.js";

// Settings key (under `ui`) holding the array of dismissed tip ids. Kept here
// so the component and any future consumer share one source of truth.
export const TIPS_DISMISSED_KEY = "tipsDismissed";

/**
 * Stable tip id for a page. Namespacing keeps tip ids from colliding with any
 * other dismissable surface that might persist ids in the same bucket.
 * @param {string} pageId
 * @returns {string}
 */
export function getTipId(pageId = "") {
  return `tip:${String(pageId || "").trim()}`;
}

/**
 * Build the contextual tip descriptors for a page.
 *
 * Returns an array (0 or 1 tip today) so the surface can render a list without
 * special-casing, and so additional per-page tips can be added later without a
 * signature change. Pages without metadata or a hint yield no tips.
 *
 * @param {string} pageId
 * @param {Record<string, { title?: string, hint?: string, helpSection?: string }>} [manifestMeta]
 * @returns {Array<{ id: string, pageId: string, title: string, body: string, helpSection: string }>}
 */
export function getTipsForPage(pageId, manifestMeta = PAGE_CONTEXT_META) {
  const key = String(pageId || "").trim();
  if (!key) return [];
  const meta = manifestMeta && manifestMeta[key];
  if (!meta || !meta.hint) return [];
  return [
    {
      id: getTipId(key),
      pageId: key,
      title: meta.title || "",
      body: meta.hint,
      helpSection: normalizeHelpSectionId(meta.helpSection)
    }
  ];
}

/**
 * Whether a tip should still be shown given the dismissed set.
 *
 * A tip with no id is never shown (defensive). Dismissed tips stay hidden so
 * the surface never nags after the user closes it.
 *
 * @param {string} tipId
 * @param {string[]|Set<string>} dismissed
 * @returns {boolean}
 */
export function shouldShowTip(tipId, dismissed = []) {
  const id = String(tipId || "").trim();
  if (!id) return false;
  const set = dismissed instanceof Set ? dismissed : new Set(Array.isArray(dismissed) ? dismissed : []);
  return !set.has(id);
}

/**
 * Read the persisted dismissed-tip ids from a settings object.
 * @param {{ ui?: { [key: string]: unknown } }} settings
 * @returns {string[]}
 */
export function getDismissedTips(settings = {}) {
  const value = settings && settings.ui && settings.ui[TIPS_DISMISSED_KEY];
  return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

/**
 * Settings patch (immutable) that adds `tipId` to the dismissed list without
 * duplicating an already-dismissed id. The caller spreads it through
 * `updateSettings`, which deep-merges the `ui` slice.
 *
 * @param {string} tipId
 * @param {{ ui?: { [key: string]: unknown } }} settings
 * @returns {{ ui: { [key: string]: string[] } }}
 */
export function getDismissTipPatch(tipId, settings = {}) {
  const id = String(tipId || "").trim();
  const current = getDismissedTips(settings);
  if (!id || current.includes(id)) {
    return { ui: { [TIPS_DISMISSED_KEY]: current } };
  }
  return { ui: { [TIPS_DISMISSED_KEY]: [...current, id] } };
}
