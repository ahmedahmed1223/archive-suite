import { useMemo } from "react";

import { PAGE_MANIFEST as RAW_PAGE_MANIFEST } from "../app/pageManifest.js";

interface PageMeta {
  title?: string;
  breadcrumb?: string;
}

interface PageManifestEntry {
  id: string;
  meta?: PageMeta;
}

interface BreadcrumbCrumb {
  id: string;
  label: string;
  navigable: boolean;
}

const PAGE_MANIFEST = RAW_PAGE_MANIFEST as PageManifestEntry[];

const GROUP_LABELS: Record<string, string> = {
  daily: "العمل اليومي",
  taxonomy: "التوصيف",
  production: "الإنتاج",
  administration: "الإدارة",
  maintenance: "الصيانة",
};

const GROUP_LANDING_PAGE: Record<string, string> = {
  daily: "archive",
  taxonomy: "types",
  production: "reports",
  administration: "settings",
  maintenance: "backup",
};

const PAGE_BY_ID = Object.fromEntries(PAGE_MANIFEST.map((page) => [page.id, page])) as Record<
  string,
  PageManifestEntry
>;

const LABEL_TO_PAGE: Record<string, string> = {
  الرئيسية: "dashboard",
};

export function useBreadcrumbs(currentPageId: string): BreadcrumbCrumb[] {
  return useMemo(() => {
    const page = PAGE_BY_ID[currentPageId];
    if (!page) return [];

    const rawBreadcrumb = page.meta?.breadcrumb || "";
    const segments = rawBreadcrumb
      .split(" / ")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length <= 1) {
      return [{ id: currentPageId, label: page.meta?.title || currentPageId, navigable: false }];
    }

    const crumbs: BreadcrumbCrumb[] = [];

    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1;

      if (isLast) {
        crumbs.push({
          id: currentPageId,
          label: page.meta?.title || segment,
          navigable: false,
        });
        return;
      }

      if (LABEL_TO_PAGE[segment]) {
        crumbs.push({ id: LABEL_TO_PAGE[segment], label: segment, navigable: true });
        return;
      }

      const groupEntry = Object.entries(GROUP_LABELS).find(([, label]) => label === segment);
      if (groupEntry) {
        const [groupId] = groupEntry;
        const landingPageId = GROUP_LANDING_PAGE[groupId] || null;
        if (landingPageId && landingPageId !== currentPageId) {
          const landingPage = PAGE_BY_ID[landingPageId];
          crumbs.push({
            id: landingPageId,
            label: landingPage?.meta?.title || segment,
            navigable: true,
          });
        } else {
          crumbs.push({ id: `group-${groupId}`, label: segment, navigable: false });
        }
        return;
      }

      const matchingPage = PAGE_MANIFEST.find(
        (entry) => entry.meta?.title === segment && entry.id !== currentPageId
      );
      if (matchingPage) {
        crumbs.push({ id: matchingPage.id, label: matchingPage.meta?.title || segment, navigable: true });
        return;
      }

      crumbs.push({ id: `label-${index}`, label: segment, navigable: false });
    });

    return crumbs;
  }, [currentPageId]);
}
