import * as React from "react";
import {
  AddVideoPage,
  ArchivePage,
  CollectionsPage,
  DashboardPage,
  DetailPage,
  HierarchicalTagsPage,
  HistoryPage,
  ProjectsPage,
  SearchPage,
  TranscriberPage,
  TypesPage,
  UploaderPage,
  UsersPage,
  VocabularyPage
} from "../pages/index.js";
import {
  HEAVY_PAGE_IDS,
  PAGE_GROUPS
} from "./pageManifest.js";

// Heavy pages are split via React.lazy + dynamic import so they don't
// inflate the initial render tree. In the single-file production build
// (vite-plugin-singlefile) the chunks are still inlined, but the
// component bodies are deferred until the user first navigates to them
// — which keeps the initial parse + first-paint faster.
const SettingsPageLazy = React.lazy(() =>
  import("../pages/SettingsPage.jsx").then((mod) => ({ default: mod.SettingsPage }))
);
const HelpPageLazy = React.lazy(() =>
  import("../pages/HelpPage.jsx").then((mod) => ({ default: mod.HelpPage }))
);
const DataCenterPageLazy = React.lazy(() =>
  import("../pages/DataCenterPage.jsx").then((mod) => ({ default: mod.DataCenterPage }))
);
const ReportsPageLazy = React.lazy(() =>
  import("../pages/ReportsPage.jsx").then((mod) => ({ default: mod.ReportsPage }))
);
const SyncLogPageLazy = React.lazy(() =>
  import("../pages/SyncLogPage.jsx").then((mod) => ({ default: mod.SyncLogPage }))
);
const GraphViewPageLazy = React.lazy(() =>
  import("../pages/GraphViewPage.jsx").then((mod) => ({ default: mod.GraphViewPage }))
);

export const PAGE_COMPONENTS = {
  dashboard: DashboardPage,
  archive: ArchivePage,
  add: AddVideoPage,
  detail: DetailPage,
  types: TypesPage,
  search: SearchPage,
  settings: SettingsPageLazy,
  backup: DataCenterPageLazy,
  history: HistoryPage,
  collections: CollectionsPage,
  projects: ProjectsPage,
  transcriber: TranscriberPage,
  uploader: UploaderPage,
  vocabulary: VocabularyPage,
  htags: HierarchicalTagsPage,
  reports: ReportsPageLazy,
  users: UsersPage,
  help: HelpPageLazy,
  "sync-log": SyncLogPageLazy,
  graph: GraphViewPageLazy
};

export { HEAVY_PAGE_IDS, PAGE_GROUPS };
