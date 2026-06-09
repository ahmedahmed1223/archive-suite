import { lazy } from "react";
import {
  HEAVY_PAGE_IDS,
  PAGE_GROUPS
} from "./pageManifest.js";

// Every page is loaded via React.lazy so the initial bundle stays small.
// In the single-file cloud build (vite-plugin-singlefile) Rollup inlines all
// dynamic chunks anyway, so the lazy wrapper becomes a no-op at runtime there;
// the Suspense boundary in RuntimeShellApp handles the async boundary for the
// standard chunked build.

const DashboardPage       = lazy(() => import("../pages/DashboardPage.jsx"));
const ArchivePage         = lazy(() => import("../pages/ArchivePage.jsx"));
const AddVideoPage        = lazy(() => import("../pages/AddVideoPage.jsx"));
const DetailPage          = lazy(() => import("../pages/DetailPage.jsx"));
const TypesPage           = lazy(() => import("../pages/TypesPage.jsx"));
const SearchPage          = lazy(() => import("../pages/SearchPage.jsx"));
const CollectionsPage     = lazy(() => import("../pages/CollectionsPage.jsx"));
const ProjectsPage        = lazy(() => import("../pages/ProjectsPage.jsx"));
const TranscriberPage     = lazy(() => import("../pages/TranscriberPage.jsx"));
const UploaderPage        = lazy(() => import("../pages/UploaderPage.jsx"));
const VocabularyPage      = lazy(() => import("../pages/VocabularyPage.jsx"));
const HierarchicalTagsPage = lazy(() => import("../pages/HierarchicalTagsPage.jsx"));
const UsersPage           = lazy(() => import("../pages/UsersPage.jsx"));
const HistoryPage         = lazy(() => import("../pages/HistoryPage.jsx"));
const SettingsPage        = lazy(() => import("../pages/SettingsPage.jsx"));
const DataCenterPage      = lazy(() => import("../pages/DataCenterPage.jsx"));
const ReportsPage         = lazy(() => import("../pages/ReportsPage.jsx"));
const HelpPage            = lazy(() => import("../pages/HelpPage.jsx"));
const SyncLogPage         = lazy(() => import("../pages/SyncLogPage.jsx"));
const GraphViewPage       = lazy(() => import("../pages/GraphViewPage.jsx"));
const FirstRunPage        = lazy(() => import("../pages/FirstRunPage.jsx"));
const FavoritesPage       = lazy(() => import("../pages/FavoritesPage.jsx"));
const ReadingListsPage    = lazy(() => import("../pages/ReadingListsPage.jsx"));
const ServerStatusPage    = lazy(() => import("../pages/ServerStatusPage.jsx"));
const DuplicatesPage      = lazy(() => import("../pages/DuplicatesPage.jsx"));
const SavedSearchesPage   = lazy(() => import("../pages/SavedSearchesPage.jsx"));

export const PAGE_COMPONENTS = {
  dashboard:   DashboardPage,
  archive:     ArchivePage,
  add:         AddVideoPage,
  detail:      DetailPage,
  types:       TypesPage,
  search:      SearchPage,
  settings:    SettingsPage,
  backup:      DataCenterPage,
  history:     HistoryPage,
  collections: CollectionsPage,
  projects:    ProjectsPage,
  transcriber: TranscriberPage,
  uploader:    UploaderPage,
  vocabulary:  VocabularyPage,
  htags:       HierarchicalTagsPage,
  reports:     ReportsPage,
  users:       UsersPage,
  help:        HelpPage,
  "sync-log":  SyncLogPage,
  graph:       GraphViewPage,
  firstRun:    FirstRunPage,
  favorites:       FavoritesPage,
  "reading-lists":  ReadingListsPage,
  "server-status":  ServerStatusPage,
  "duplicates":     DuplicatesPage,
  "saved-searches": SavedSearchesPage,
};

export { HEAVY_PAGE_IDS, PAGE_GROUPS };
