import { useMemo } from "react";
import { PAGE_MANIFEST } from "../app/pageManifest.js";

/**
 * Builds the breadcrumb trail for a given page ID by parsing the manifest's
 * breadcrumb string (e.g. "الأرشيف / إضافة") and mapping each segment back
 * to a navigable page where possible.
 *
 * The manifest breadcrumb strings follow one of these patterns:
 *   "الرئيسية"                     → dashboard (single level, no breadcrumb shown)
 *   "الرئيسية / الأرشيف"           → home + archive
 *   "التوصيف / الأنواع"            → group label + page
 *   "العمل اليومي / المجموعات"     → group label + page
 *
 * Strategy:
 *   1. Split the breadcrumb string on " / ".
 *   2. The first segment is the "root" label.  If it is "الرئيسية" we map it to
 *      "dashboard"; otherwise we look for a page whose group label matches.
 *   3. The last segment is ALWAYS the current page (not clickable).
 *   4. Middle segments become group-level labels.  We try to find a representative
 *      navigable page for each group (the first non-current page in the group).
 *
 * Returns an array of { id, label, navigable } crumbs.
 * Only the LAST crumb has navigable=false; all others are clickable.
 */

// Group display labels — mirror SIDEBAR_GROUP_LABELS from viewModel.js
const GROUP_LABELS = {
  daily: "العمل اليومي",
  taxonomy: "التوصيف",
  production: "الإنتاج",
  administration: "الإدارة",
  maintenance: "الصيانة"
};

// A representative landing page for each group (first page users expect to see)
const GROUP_LANDING_PAGE = {
  daily: "archive",
  taxonomy: "types",
  production: "reports",
  administration: "settings",
  maintenance: "backup"
};

// Build a lookup: page id → full manifest entry
const PAGE_BY_ID = Object.fromEntries(PAGE_MANIFEST.map((p) => [p.id, p]));

// Build a reverse lookup: breadcrumb first-segment label → page id (for special cases)
// "الرئيسية" always maps to dashboard
const LABEL_TO_PAGE = {
  "الرئيسية": "dashboard"
};

export function useBreadcrumbs(currentPageId) {
  return useMemo(() => {
    const page = PAGE_BY_ID[currentPageId];
    if (!page) return [];

    const rawBreadcrumb = page.meta?.breadcrumb || "";
    // Split on " / " (Arabic breadcrumb separator used in the manifest)
    const segments = rawBreadcrumb
      .split(" / ")
      .map((s) => s.trim())
      .filter(Boolean);

    if (segments.length <= 1) {
      // Top-level page — single crumb, no nav trail needed
      return [{ id: currentPageId, label: page.meta?.title || currentPageId, navigable: false }];
    }

    const crumbs = [];

    segments.forEach((seg, idx) => {
      const isLast = idx === segments.length - 1;

      if (isLast) {
        // Current page — always use the manifest title for accuracy
        crumbs.push({
          id: currentPageId,
          label: page.meta?.title || seg,
          navigable: false
        });
        return;
      }

      // Root / intermediate segment — map to a navigable page
      if (LABEL_TO_PAGE[seg]) {
        crumbs.push({ id: LABEL_TO_PAGE[seg], label: seg, navigable: true });
        return;
      }

      // Check if the segment matches a group label; if so, use the group landing page
      const groupEntry = Object.entries(GROUP_LABELS).find(([, label]) => label === seg);
      if (groupEntry) {
        const [groupId] = groupEntry;
        const landingPageId = GROUP_LANDING_PAGE[groupId] || null;
        // Don't add a group crumb that points at the current page itself
        if (landingPageId && landingPageId !== currentPageId) {
          const landingPage = PAGE_BY_ID[landingPageId];
          crumbs.push({
            id: landingPageId,
            label: landingPage?.meta?.title || seg,
            navigable: true
          });
        } else {
          // Still show the group label but non-navigable
          crumbs.push({ id: `group-${groupId}`, label: seg, navigable: false });
        }
        return;
      }

      // Segment matches a page title directly — find the page
      const matchingPage = PAGE_MANIFEST.find(
        (p) => (p.meta?.title === seg) && p.id !== currentPageId
      );
      if (matchingPage) {
        crumbs.push({ id: matchingPage.id, label: matchingPage.meta.title, navigable: true });
        return;
      }

      // Fallback: include as a non-navigable label
      crumbs.push({ id: `label-${idx}`, label: seg, navigable: false });
    });

    return crumbs;
  }, [currentPageId]);
}
