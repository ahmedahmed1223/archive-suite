import {
  PAGE_CONTEXT_META,
  PAGE_GROUPS,
  PAGE_MANIFEST,
  type PageManifestEntry
} from "../../app/pageManifest.js";

export const SIDEBAR_GROUP_LABELS: Record<string, string> = {
  daily: "العمل اليومي",
  taxonomy: "التوصيف",
  production: "الإنتاج",
  administration: "الإدارة",
  maintenance: "الصيانة"
};

export function getSidebarNavigationGroups(manifest: PageManifestEntry[] = PAGE_MANIFEST) {
  return Object.entries(PAGE_GROUPS).map(([groupId, pageIds]) => ({
    id: groupId,
    label: SIDEBAR_GROUP_LABELS[groupId] || groupId,
    pages: pageIds
      .map((pageId) => manifest.find((page) => page.id === pageId))
      .filter(Boolean)
  }));
}

export function getPageContextBarModel(pageId = "dashboard", fallbackTitle = "") {
  const meta = PAGE_CONTEXT_META[pageId] || PAGE_CONTEXT_META.dashboard || {};
  return {
    pageId,
    title: meta.title || fallbackTitle || "أرشيف الفيديو",
    breadcrumb: meta.breadcrumb || "",
    hint: meta.hint || "",
    helpSection: meta.helpSection || "getting-started"
  };
}

export function getPrimaryPageAction(pageId = "dashboard") {
  const actions = {
    dashboard: { label: "إضافة فيديو", targetPage: "add" },
    archive: { label: "إضافة فيديو", targetPage: "add" },
    add: { label: "فتح الأرشيف", targetPage: "archive" },
    backup: { label: "استيراد بيانات", targetPage: "backup", dataTab: "import" },
    help: { label: "مركز التحكم", targetPage: "dashboard" },
    settings: { label: "فحص النظام", targetPage: "settings", settingsTab: "maintenance" },
    "file-manager": { label: "رفع ملفات", targetPage: "file-manager", event: "videoarchive:file-manager-upload" }
  };
  return (actions as Record<string, { label: string; targetPage: string; dataTab?: string; settingsTab?: string; event?: string }>)[pageId]
    || { label: "فتح الأرشيف", targetPage: "archive" };
}
