import { PAGE_MANIFEST } from "../app/pageManifest.js";

export const PAGE_NATIVE_MIGRATION = {
  dashboard: { status: "native", notes: "Page JSX lives in src/pages/DashboardPage.jsx; shell, store, services, and vendor imports are native." },
  archive: { status: "native", notes: "Page JSX lives in src/pages/ArchivePage.jsx with native grid/list/table modes and a native file import wizard." },
  add: { status: "native", notes: "Page JSX lives in src/pages/AddVideoPage.jsx with a native multi-step form and localFile metadata support." },
  detail: { status: "native", notes: "Page JSX lives in src/pages/DetailPage.jsx with native preview, editing, custom fields, and history summary." },
  types: { status: "native", notes: "Page JSX lives in src/pages/TypesPage.jsx with native type, subtype, and custom-field management including localFile." },
  search: { status: "native", notes: "Page JSX lives in src/pages/SearchPage.jsx with route-backed filters and direct links back to Archive." },
  settings: { status: "native", notes: "Page JSX lives in src/pages/SettingsPage.jsx with native tabs, direct save controls, onboarding replay, and shortcut conflict handling." },
  backup: { status: "native", notes: "Page JSX lives in src/pages/DataCenterPage.jsx; data operations use native storage, health, Excel, and portability services." },
  history: { status: "native", notes: "Page JSX lives in src/pages/HistoryPage.jsx with route-backed search, action filters, and pagination." },
  collections: { status: "native", notes: "Page JSX lives in src/pages/CollectionsPage.jsx with native cards, detail preview, and manual item management." },
  projects: { status: "native", notes: "Page JSX lives in src/pages/ProjectsPage.jsx with native montage timeline, rough-cut builder, reordering, and JSON/EDL/MP4 export." },
  uploader: { status: "native", notes: "Page JSX lives in src/pages/UploaderPage.jsx; uploads media to the FileStore port (local/disk/Dropbox/S3) with listing and removal." },
  transcriber: { status: "native", notes: "Page JSX lives in src/pages/TranscriberPage.jsx; transcribes audio/video via the AiProvider port — cloud Whisper or in-browser (G2) — with timestamped segments." },
  vocabulary: { status: "native", notes: "Page JSX lives in src/pages/VocabularyPage.jsx; vocabulary filtering and @ autocomplete data are now driven by src/features/vocabulary." },
  htags: { status: "native", notes: "Page JSX lives in src/pages/HierarchicalTagsPage.jsx; tree helpers and # autocomplete paths are now driven by src/features/hierarchical-tags." },
  reports: { status: "native", notes: "Page JSX lives in src/pages/ReportsPage.jsx; export helpers use the explicit xlsx vendor module." },
  users: { status: "native", notes: "Page JSX lives in src/pages/UsersPage.jsx with native role filtering, account status controls, and protected admin handling." },
  help: { status: "native", notes: "Page JSX lives in src/pages/HelpPage.jsx; shared UI wrappers and runtime bridges have been removed." },
  "sync-log": { status: "native", notes: "Page JSX lives in src/pages/SyncLogPage.jsx; reads audit_logs for sync.* events and renders per-device summary plus chronological log." },
  graph: { status: "native", notes: "Page JSX lives in src/pages/GraphViewPage.jsx; lightweight inline SVG relationship graph (shared tags + type) — no d3/recharts." },
  favorites: { status: "native", notes: "Page JSX lives in src/pages/FavoritesPage.jsx; favorites and quick-access items driven by the favorites store slice." },
  "reading-lists": { status: "native", notes: "Page JSX lives in src/pages/ReadingListsPage.jsx; watch-later and reading list queues driven by the reading-lists store slice." },
  "server-status": { status: "native", notes: "Page JSX lives in src/pages/ServerStatusPage.jsx; server health, storage, and service status from the health endpoint." },
  duplicates: { status: "native", notes: "Page JSX lives in src/pages/DuplicatesPage.jsx; duplicate detection and merge flows driven by the duplicates feature module." },
  "saved-searches": { status: "native", notes: "Page JSX lives in src/pages/SavedSearchesPage.jsx; saved searches and alert subscriptions driven by the saved-searches store slice." }
};

export function getPageMigrationStatus() {
  return PAGE_MANIFEST.map((page) => {
    const metadata = PAGE_NATIVE_MIGRATION[page.id] || {};
    return {
      id: page.id,
      title: page.meta?.title || "",
      group: page.group,
      heavy: !!page.heavy,
      status: metadata.status || "unknown",
      notes: metadata.notes || "Page status has not been documented yet."
    };
  });
}

export function getPageMigrationSummary(statusRows = getPageMigrationStatus()) {
  const total = statusRows.length;
  const wrappedPages = statusRows.filter((page) => page.status === "wrapped").length;
  const native = statusRows.filter((page) => page.status === "native").length;
  const heavyWrapped = statusRows.filter((page) => page.heavy && page.status === "wrapped").length;

  return {
    total,
    native,
    wrappedPages,
    heavyWrapped,
    percentNative: total === 0 ? 0 : Math.round(native / total * 100)
  };
}
