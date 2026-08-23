import { activity } from "./activity";
import { approvalRequests } from "./approvalRequests";
import { archiveDetail } from "./archiveDetail";
import { archiveList } from "./archiveList";
import { archiveRecordCard } from "./archiveRecordCard";
import { analytics } from "./analytics";
import { automation } from "./automation";
import { backup } from "./backup";
import { broadcast } from "./broadcast";
import { bulkMacroRecorder } from "./bulkMacroRecorder";
import { catalog } from "./catalog";
import { commandPalette } from "./commandPalette";
import { collaboration } from "./collaboration";
import { dataCenter } from "./dataCenter";
import { daily } from "./daily";
import { delegations } from "./delegations";
import { discover } from "./discover";
import { duplicates } from "./duplicates";
import { errors } from "./errors";
import { favorites } from "./favorites";
import { filelessRecordForm } from "./filelessRecordForm";
import { firstRun } from "./firstRun";
import { geotagPanel } from "./geotagPanel";
import { graph } from "./graph";
import { home } from "./home";
import { importFromUrlForm } from "./importFromUrlForm";
import { ingest } from "./ingest";
import { inbox } from "./inbox";
import { intakeTemplatesPanel } from "./intakeTemplatesPanel";
import { kanban } from "./kanban";
import { loading } from "./loading";
import { login } from "./login";
import { map } from "./map";
import { mediaDerivativesTree } from "./mediaDerivativesTree";
import { mediaCompare } from "./mediaCompare";
import { mediaJobs } from "./mediaJobs";
import { mediaJobsPage } from "./mediaJobsPage";
import { mediaJobLookup } from "./mediaJobLookup";
import { mediaReview } from "./mediaReview";
import { mediaPlay } from "./mediaPlay";
import { mediaStudio } from "./mediaStudio";
import { metadataTemplates } from "./metadataTemplates";
import { notifications } from "./notifications";
import { passwordRecovery } from "./passwordRecovery";
import { notificationsPanel } from "./notificationsPanel";
import { projects } from "./projects";
import { projectGroups } from "./projectGroups";
import { projectTasks } from "./projectTasks";
import { plugins } from "./plugins";
import { recentFavoritesMenu } from "./recentFavoritesMenu";
import { readingLists } from "./readingLists";
import { recordDescribeForm } from "./recordDescribeForm";
import { reviewLink } from "./reviewLink";
import { reviewLinkViewer } from "./reviewLinkViewer";
import { reports } from "./reports";
import { rights } from "./rights";
import { savedSearches } from "./savedSearches";
import { scheduledUploads } from "./scheduledUploads";
import { scheduledUploadsClient } from "./scheduledUploadsClient";
import { search } from "./search";
import { searchResults } from "./searchResults";
import { safetyPreview } from "./safetyPreview";
import { settings } from "./settings";
import { settingsUsers } from "./settingsUsers";
import { status } from "./status";
import { shareViewer } from "./shareViewer";
import { shareToken } from "./shareToken";
import { sharesWithMe } from "./sharesWithMe";
import { shares } from "./shares";
import { sync } from "./sync";
import { timeline } from "./timeline";
import { transcriber } from "./transcriber";
import { types } from "./types";
import { trash } from "./trash";
import { tags } from "./tags";
import { vocabulary } from "./vocabulary";
import { vocabTemplates } from "./vocabTemplates";
import { files } from "./files";
import { collections } from "./collections";
import { copilot } from "./copilot";
import { systemControl } from "./systemControl";
import { uploadForm } from "./uploadForm";
import { uploadLinksPanel } from "./uploadLinksPanel";
import { uploads } from "./uploads";
import { whatsNewDialog } from "./whatsNewDialog";
import { workInbox } from "./workInbox";

export const pages = {
  activity,
  approvalRequests,
  archiveDetail,
  archiveList,
  archiveRecordCard,
  analytics,
  automation,
  backup,
  broadcast,
  bulkMacroRecorder,
  catalog,
  commandPalette,
  collaboration,
  dataCenter,
  daily,
  delegations,
  discover,
  duplicates,
  errors,
  favorites,
  filelessRecordForm,
  firstRun,
  geotagPanel,
  graph,
  home,
  importFromUrlForm,
  ingest,
  inbox,
  intakeTemplatesPanel,
  kanban,
  loading,
  login,
  map,
  mediaDerivativesTree,
  mediaCompare,
  mediaJobs,
  mediaJobsPage,
  mediaJobLookup,
  mediaReview,
  mediaPlay,
  mediaStudio,
  metadataTemplates,
  notifications,
  passwordRecovery,
  notificationsPanel,
  projects,
  projectGroups,
  projectTasks,
  plugins,
  recentFavoritesMenu,
  readingLists,
  recordDescribeForm,
  reviewLink,
  reviewLinkViewer,
  reports,
  rights,
  savedSearches,
  scheduledUploads,
  scheduledUploadsClient,
  search,
  searchResults,
  safetyPreview,
  settings,
  settingsUsers,
  status,
  shareViewer,
  shareToken,
  sharesWithMe,
  shares,
  sync,
  timeline,
  transcriber,
  types,
  trash,
  tags,
  vocabulary,
  vocabTemplates,
  files,
  collections,
  copilot,
  systemControl,
  uploadForm,
  uploadLinksPanel,
  uploads,
  whatsNewDialog,
  workInbox,
} as const;
