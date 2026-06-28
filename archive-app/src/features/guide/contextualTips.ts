import { PAGE_CONTEXT_META } from "../../app/pageManifest.js";
import { normalizeHelpSectionId } from "../help/viewModel.js";

export const TIPS_DISMISSED_KEY = "tipsDismissed";

export function getTipId(pageId: any = ""): string {
  return `tip:${String(pageId || "").trim()}`;
}

export function getTipsForPage(pageId: any, manifestMeta: any = PAGE_CONTEXT_META): any[] {
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

export function shouldShowTip(tipId: any, dismissed: any = []): boolean {
  const id = String(tipId || "").trim();
  if (!id) return false;
  const set = dismissed instanceof Set ? dismissed : new Set(Array.isArray(dismissed) ? dismissed : []);
  return !set.has(id);
}

export function getDismissedTips(settings: any = {}): string[] {
  const value = settings && settings.ui && settings.ui[TIPS_DISMISSED_KEY];
  return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

export function getDismissTipPatch(tipId: any, settings: any = {}): any {
  const id = String(tipId || "").trim();
  const current = getDismissedTips(settings);
  if (!id || current.includes(id)) {
    return { ui: { [TIPS_DISMISSED_KEY]: current } };
  }
  return { ui: { [TIPS_DISMISSED_KEY]: [...current, id] } };
}
