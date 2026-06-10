import assert from "node:assert/strict";

import {
  MEDIA_PREVIEW_STATUS,
  getMediaPreviewDescriptor,
  getHtml5VideoPreviewSource,
  isHtml5PreviewableVideo
} from "../src/features/archive/mediaPreview.js";
import {
  filterCommandPaletteCommands,
  groupCommandPaletteCommands
} from "../src/components/common/commandPaletteViewModel.js";
import {
  createShortcutDialogItems,
  filterShortcutDialogItems,
  getShortcutDialogCategories,
  getShortcutDialogItemsForCategory
} from "../src/components/common/shortcutDialogViewModel.js";
import {
  createArchiveRouteParams,
  getArchiveActiveFilterCount,
  getArchiveResultRangeText,
  getFilteredArchiveItems,
  hasArchiveContentFilters,
  normalizeArchiveGridRows,
  normalizeArchiveItemSize,
  normalizeArchivePage,
  normalizeArchivePageSize,
  normalizeArchiveTopMode,
  parseArchiveRouteParams
} from "../src/features/archive/viewModel.js";
import {
  createFileImportRows,
  isLikelyVideoFile
} from "../src/features/archive/fileImport.js";
import {
  findShortcutConflict,
  getDefaultKeyboardShortcuts,
  getEffectiveKeyboardShortcuts,
  isTextEntryTarget,
  shortcutMatches
} from "../src/features/settings/keyboardShortcuts.js";
import {
  createSearchRouteParams,
  getSearchActiveFilterCount,
  getSearchResults,
  getTranscriptSegments,
  getTranscriptSnippets,
  parseSearchRouteParams
} from "../src/features/search/viewModel.js";
import {
  createHistoryRouteParams,
  getFilteredHistoryRecords,
  getHistoryActionCounts,
  parseHistoryRouteParams
} from "../src/features/history/viewModel.js";
import {
  createVocabularyEntryValue,
  createVocabularyRouteParams,
  analyzeVocabularyWorkspace,
  getFilteredVocabularyEntries,
  getVocabularyCategoryCounts,
  mergeVocabularyEntries,
  parseVocabularyAliases,
  parseVocabularyRouteParams
} from "../src/features/vocabulary/viewModel.js";
import {
  analyzeTagWorkspace,
  buildHierarchicalTagModel,
  createHierarchicalTagValue,
  getDescendantTagIds,
  getFilteredHierarchicalTags,
  getHierarchicalTagPath,
  getNextHierarchicalTagOrder
} from "../src/features/hierarchical-tags/viewModel.js";
import {
  createVirtualCollectionValue,
  getAvailableCollectionItems,
  getCollectionSummary,
  getFilteredCollections,
  resolveCollectionItems
} from "../src/features/collections/viewModel.js";
import {
  canDeactivateUser,
  createUserValue,
  getFilteredUsers,
  getUserSummary,
  normalizeUserRole
} from "../src/features/users/viewModel.js";
import {
  analyzeFieldImpact,
  analyzeTypeImpact,
  createContentTypeValue,
  createCustomFieldValue,
  createSubtypeValue,
  getDefaultArchiveContentTypes,
  getFieldsForSelection,
  getFilteredContentTypes,
  getTypeUsageCounts,
  hasMeaningfulFieldValue,
  normalizeFieldStorageKey,
  parseFieldOptions,
  suggestSafeTypeSlug,
  validateContentTypeDraft
} from "../src/features/types/viewModel.js";
import {
  createAsyncActionGuard
} from "../src/utils/asyncAction.js";
import {
  createLocalFileValue,
  createVideoLocalFilePatch,
  createVideoItemValue,
  getSubtypeLabel,
  getTypeLabel,
  normalizeLocalFileValue,
  parseVideoTags
} from "../src/features/videos/viewModel.js";
import {
  canViewField,
  filterItemByFieldAcl,
  normalizeFieldAcl
} from "../src/features/field-acl/viewModel.js";
import {
  filterNotifications,
  getNotificationCounts,
  groupNotificationsByDay,
  getUnreadNotifications,
  normalizeNotification,
  shouldShowNotificationToast
} from "../src/features/notifications/viewModel.js";
import {
  createConnectionStatusNotification,
  shouldEmitOperationalNotification
} from "../src/features/notifications/operationalNotifications.js";
import {
  HELP_FAQ_ITEMS,
  HELP_QUICK_SECTION_LINKS
} from "../src/features/help/content.js";
import {
  createHelpShortcutList,
  filterHelpFaqItems,
  filterHelpSections,
  normalizeHelpSectionId
} from "../src/features/help/viewModel.js";
import {
  createSettingsTabUiPatch,
  getSettingsTabState,
  hasMeaningfulSettingsDraftChanges,
  normalizeSettingsTab
} from "../src/features/settings/viewModel.js";
import {
  createOnboardingUiPatch,
  createOnboardingCompletionPatch,
  getOnboardingDestination,
  getFirstTaskDestination,
  getNextOnboardingStep,
  getOnboardingStepIndex,
  PRODUCT_TOUR_VERSION,
  shouldShowStartupOnboarding,
  shouldShowV1Tour
} from "../src/features/onboarding/viewModel.js";
import {
  getPageContextBarModel,
  getPrimaryPageAction,
  getSidebarNavigationGroups
} from "../src/components/navigation/viewModel.js";
import {
  getPageMigrationStatus,
  getPageMigrationSummary
} from "../src/pages/migrationStatus.js";
import {
  createDataCenterExportFilters,
  createDataCenterExportSummary,
  formatTimeUntilBackup,
  getNextBackupTime
} from "../src/features/data-center/viewModel.js";
import {
  createDashboardStats,
  getDailyFocusItems,
  getDashboardDemoItemIds,
  hasDashboardLayoutDraftChanges,
  parseDurationSeconds
} from "../src/features/dashboard/viewModel.js";
import {
  getDefaultDashboardLayout,
  normalizeDashboardLayout,
  toGridLayout,
  applyGridChange,
  setPanelHidden,
  setPanelAutoHeight,
  hasDashboardLayoutDraftChanges as gridLayoutChanged,
  DASHBOARD_DEFAULT_ITEMS
} from "../src/features/dashboard/dashboardLayoutModel.js";
import {
  createImportPreviewSummary,
  formatImportPreviewSummary
} from "../src/services/data-portability/importPreview.js";
import {
  getGlobalShortcutAction
} from "../src/stores/globalShortcuts.js";
import {
  isArchiveExcelImportFile,
  readArchiveImportFile
} from "../src/services/data-portability/importReader.js";
import { createArchiveCsvExportFiles } from "../src/services/data-portability/csvExport.js";
import {
  createArchiveExcelPackagePayload,
  createTransferPackage,
  readTransferPackage
} from "../src/services/data-portability/packageOperations.js";
import { createArchiveExcelWorkbook } from "../src/services/data-portability/excelWorkbook.js";
import {
  safeJsonParse,
  sanitizePlainData
} from "../src/services/data-portability/json.js";
import {
  createOperationSizeCheck,
  createSqliteReadinessCheck,
  createStorageEstimateCheck,
  formatPreflightSummary
} from "../src/services/health/preflight.js";
import {
  buildAppRoute,
  normalizeRoutePage,
  parseAppRoute
} from "../src/services/router/index.js";
import {
  applyAccentColor,
  getAccentColorTokens
} from "../src/theme/accentColor.js";
import {
  normalizeThemeVersion,
  DEFAULT_THEME_VERSION
} from "../src/theme/themeVersionStorage.js";
import { staggerFor, transitions } from "../src/theme/motion.js";
import { defaultSettings } from "../src/stores/settingsDefaults.js";
import { getDefaultSettings } from "../src/utils/settings.js";
// Ports + provider registry now come from the shared @archive/core package
// (consumed via git tag). The local adapters + bootstrap remain in this repo.
import {
  STORAGE_PROVIDER_METHODS,
  isStorageProvider,
  FILE_STORE_METHODS,
  isFileStore,
  AUTH_PROVIDER_METHODS,
  isAuthProvider,
  SESSION_PROVIDER_METHODS,
  isSessionProvider,
  SYNC_PROVIDER_METHODS,
  isSyncProvider,
  AI_PROVIDER_METHODS,
  isAiProvider,
  getStorageProvider,
  registerStorageProvider,
  getFileStore,
  registerFileStore,
  getAuthProvider,
  registerAuthProvider,
  getSessionProvider,
  registerSessionProvider,
  getSyncProvider,
  registerSyncProvider,
  getAiProvider,
  registerAiProvider
} from "@archive/core";
import * as core from "@archive/core";
import { localStorageProvider } from "../src/storage/adapters/local-indexeddb/index.js";
import { localFileStore } from "../src/storage/adapters/files-local/index.js";
import { localAuthProvider } from "../src/storage/adapters/local-auth/index.js";
import { localSessionProvider } from "../src/storage/adapters/local-session/index.js";
import { localSyncProvider } from "../src/storage/adapters/local-sync/index.js";
import { localAiStubProvider } from "../src/storage/adapters/ai-local-stub/index.js";
import { registerLocalProviders } from "../src/bootstrap/registerLocalProviders.js";
import { createLocalSqliteProvider } from "../src/storage/adapters/local-sqlite/index.js";
import { STORES } from "../src/services/storage/schema.js";
import { createRecoveryNotice } from "../src/utils/errorReporting.js";

function run(name, test) {
  test();
  console.log(`ok - ${name}`);
}

async function runAsync(name, test) {
  await test();
  console.log(`ok - ${name}`);
}

// The provider registry is now pure dependency injection (no built-in defaults).
// Bind the local adapters once, exactly as the SPA boot does, before any test
// exercises the registry.
registerLocalProviders();

run("archive media preview URLs", () => {
  assert.equal(isHtml5PreviewableVideo("clip.MP4?download=1"), true);
  assert.equal(isHtml5PreviewableVideo("clip.txt"), false);
  assert.equal(
    getHtml5VideoPreviewSource("C:\\Videos\\New Folder\\clip 1.mp4"),
    "file:///C:/Videos/New%20Folder/clip%201.mp4"
  );
  assert.equal(
    getHtml5VideoPreviewSource("/mnt/archive/clip 1.webm"),
    "file:///mnt/archive/clip%201.webm"
  );
  assert.equal(getHtml5VideoPreviewSource("relative/clip.mp4"), null);
  assert.equal(getMediaPreviewDescriptor("").status, MEDIA_PREVIEW_STATUS.MISSING_PATH);
  assert.equal(getMediaPreviewDescriptor("clip.txt").status, MEDIA_PREVIEW_STATUS.UNSUPPORTED_FORMAT);
  assert.equal(
    getMediaPreviewDescriptor("C:\\Videos\\clip.mp4", { runtimeProtocol: "http:" }).status,
    MEDIA_PREVIEW_STATUS.BLOCKED_LOCAL_PATH
  );
  assert.equal(
    getMediaPreviewDescriptor("https://example.com/clip.mp4", { runtimeProtocol: "https:" }).status,
    MEDIA_PREVIEW_STATUS.PLAYABLE
  );
});

run("archive view model", () => {
  const items = getFilteredArchiveItems({
    videoItems: [
      { id: "1", title: "حلقة خاصة", type: "show", subtype: "episode", tags: ["أخبار"], notes: "", updatedAt: "2026-01-02" },
      { id: "2", title: "مقطع محذوف", type: "show", tags: [], isDeleted: true, updatedAt: "2026-01-03" },
      { id: "3", title: "فيلم", type: "movie", tags: ["وثائقي"], isFavorite: true, updatedAt: "2026-01-01" },
      { id: "4", title: "لقطة محلية", type: "clip", tags: [], updatedAt: "2026-01-04", metadata: { localFile: { name: "field-recording.MOV", relativePath: "field/field-recording.MOV" } } }
    ],
    filterType: "show",
    searchQuery: "حلقه"
  });
  assert.deepEqual(items.map((item) => item.id), ["1"]);
  assert.deepEqual(getFilteredArchiveItems({
    videoItems: [
      { id: "local", title: "مادة", metadata: { localFile: { name: "field-recording.MOV", relativePath: "field/field-recording.MOV" } } }
    ],
    searchQuery: "recording"
  }).map((item) => item.id), ["local"]);
  assert.equal(getArchiveActiveFilterCount({ searchQuery: "x", filterType: "show", showDeleted: true }), 3);
  assert.equal(hasArchiveContentFilters({ showDeleted: true }), false);
  assert.equal(getArchiveResultRangeText({ total: 55, page: 3, itemsPerPage: 20 }), "عرض 41-55 من 55");

  const params = createArchiveRouteParams({ searchQuery: "test", filterType: "movie", showFavoritesOnly: true, sortDirection: "asc", viewMode: "table", topMode: "detailed", openImport: true, page: 3, pageSize: 48, itemSize: "comfortable", gridRows: 6 });
  const parsed = parseArchiveRouteParams(params);
  assert.equal(parsed.searchQuery, "test");
  assert.equal(parsed.filterType, "movie");
  assert.equal(parsed.showFavoritesOnly, true);
  assert.equal(parsed.sortDirection, "asc");
  assert.equal(parsed.viewMode, "table");
  assert.equal(parsed.topMode, "detailed");
  assert.equal(parsed.openImport, true);
  assert.equal(parsed.page, 3);
  assert.equal(parsed.pageSize, 48);
  assert.equal(parsed.itemSize, "comfortable");
  assert.equal(parsed.gridRows, 6);
  assert.equal(parseArchiveRouteParams(new URLSearchParams("view=missing")).viewMode, "grid");
  assert.equal(parseArchiveRouteParams(new URLSearchParams("top=wide&rows=9")).topMode, "quick");
  assert.equal(parseArchiveRouteParams(new URLSearchParams("rows=5")).gridRows, 5);
  assert.equal(normalizeArchiveTopMode("detailed"), "detailed");
  assert.equal(normalizeArchiveGridRows("4"), 4);
  assert.equal(normalizeArchiveGridRows("12"), 12);
  assert.equal(normalizeArchiveGridRows("13"), 3);
  assert.equal(normalizeArchiveGridRows("0"), 3);
  assert.equal(normalizeArchiveItemSize("huge"), "compact");
  assert.equal(normalizeArchivePageSize(999), 24);
  assert.equal(normalizeArchivePage("-1"), 1);
});

run("keyboard shortcut helpers", () => {
  const defaults = getDefaultKeyboardShortcuts();
  assert.equal(defaults.openSearch, "Alt+K");

  const shortcuts = getEffectiveKeyboardShortcuts({
    keyboardShortcuts: {
      openSearch: "Alt+K",
      openBackup: "Alt+K"
    }
  });
  assert.equal(findShortcutConflict(shortcuts, "openSearch", "Alt+K")?.id, "openBackup");
  assert.equal(shortcutMatches({ ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: "k" }, "Ctrl+K"), true);
  assert.equal(shortcutMatches({ ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: "k" }, "Ctrl+K"), false);
  assert.equal(isTextEntryTarget({ tagName: "INPUT" }), true);
});

run("search view model", () => {
  const params = createSearchRouteParams({
    query: "لقطة",
    type: "clip",
    subtype: "social",
    favoritesOnly: true,
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
    page: 2,
    pageSize: 48
  });
  const parsed = parseSearchRouteParams(params);
  assert.deepEqual(parsed, {
    query: "لقطة",
    type: "clip",
    subtype: "social",
    favoritesOnly: true,
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
    page: 2,
    pageSize: 48
  });
  assert.equal(getSearchActiveFilterCount(parsed), 6);

  const results = getSearchResults({
    videoItems: [
      { id: "1", title: "لقطة مؤتمر", type: "clip", subtype: "social", isFavorite: true, createdAt: "2026-01-15", updatedAt: "2026-01-16" },
      { id: "2", title: "لقطة قديمة", type: "clip", subtype: "social", isFavorite: true, createdAt: "2025-12-20", updatedAt: "2026-01-16" },
      { id: "3", title: "مؤتمر", type: "clip", subtype: "social", isFavorite: false, createdAt: "2026-01-15" }
    ],
    query: "لقطة",
    type: "clip",
    subtype: "social",
    favoritesOnly: true,
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31"
  });
  assert.deepEqual(results.map((item) => item.id), ["1"]);
  const transcriptItem = { id: "t1", title: "تفريغ", metadata: { transcript: "[01:05] هذه لقطة مهمة\n[02:10] نهاية أخرى" } };
  assert.deepEqual(getTranscriptSegments(transcriptItem).map((segment) => segment.seconds), [65, 130]);
  assert.equal(getTranscriptSnippets(transcriptItem, "مهمه")[0].timecode, "1:05");
  assert.equal(getSearchResults({ videoItems: [transcriptItem], query: "مهمة" })[0].transcriptSnippets.length, 1);
});

run("history view model", () => {
  const params = createHistoryRouteParams({ query: "عنوان", action: "update", page: 2, pageSize: 100 });
  assert.deepEqual(parseHistoryRouteParams(params), {
    query: "عنوان",
    action: "update",
    page: 2,
    pageSize: 100
  });

  const records = getFilteredHistoryRecords({
    changeHistory: [
      { id: "1", itemId: "v1", action: "create", timestamp: "2026-01-01T00:00:00.000Z" },
      { id: "2", itemId: "v2", action: "update", field: "title", newValue: "عنوان جديد", timestamp: "2026-01-03T00:00:00.000Z" },
      { id: "3", itemId: "v3", action: "delete", timestamp: "2026-01-02T00:00:00.000Z" }
    ],
    query: "عنوان",
    action: "update",
    itemTitleById: new Map([["v2", "مادة قديمة"]])
  });
  assert.deepEqual(records.map((record) => record.id), ["2"]);
  assert.equal(getHistoryActionCounts(records).update, 1);
});

run("vocabulary view model", () => {
  const aliases = parseVocabularyAliases("القدس, بيت المقدس، أورشليم");
  assert.deepEqual(aliases, ["القدس", "بيت المقدس", "أورشليم"]);
  const entry = createVocabularyEntryValue({ term: "القدس", category: "city", aliases });
  assert.equal(entry.category, "city");

  const params = createVocabularyRouteParams({ query: "قدس", category: "city", page: 3, pageSize: 96 });
  assert.deepEqual(parseVocabularyRouteParams(params), {
    query: "قدس",
    category: "city",
    page: 3,
    pageSize: 96
  });

  const vocabulary = [
    entry,
    createVocabularyEntryValue({ term: "رام الله", category: "city" }),
    createVocabularyEntryValue({ term: "وكالة", category: "organization" })
  ];
  assert.deepEqual(getFilteredVocabularyEntries({ vocabulary, query: "بيت", category: "city" }).map((item) => item.term), ["القدس"]);
  assert.equal(getVocabularyCategoryCounts(vocabulary).city, 2);

  const workspace = analyzeVocabularyWorkspace({
    vocabulary: [
      entry,
      createVocabularyEntryValue({ id: "dup", term: " القدس ", category: "city", aliases: ["مدينة القدس"] }),
      createVocabularyEntryValue({ id: "unused", term: "مصطلح مهمل", aliases: ["مرادف مهمل"] })
    ],
    videoItems: [
      { id: "v1", title: "مادة", tags: ["القدس", "مدينة القدس", "وسم بلا قاموس"], notes: "نص يذكر القدس" }
    ],
    hierarchicalTags: [
      createHierarchicalTagValue({ id: "tag1", name: "وسم بلا قاموس" }),
      createHierarchicalTagValue({ id: "tag2", name: "غير مستخدم" })
    ]
  });
  assert.deepEqual(workspace.duplicates.map((group) => group.key), ["القدس"]);
  assert.deepEqual(workspace.unusedTerms.map((item) => item.term), ["مصطلح مهمل"]);
  assert.deepEqual(workspace.tagsWithoutTerms.map((item) => item.name), ["وسم بلا قاموس", "غير مستخدم"]);
  const merged = mergeVocabularyEntries(entry, createVocabularyEntryValue({ term: "أورشليم", category: "place", aliases: ["القدس"] }));
  assert.equal(merged.term, "القدس");
  assert.deepEqual(merged.aliases, ["بيت المقدس", "أورشليم"]);
});

run("hierarchical tags view model", () => {
  const root = createHierarchicalTagValue({ id: "root", name: "الأصل", order: 0 });
  const child = createHierarchicalTagValue({ id: "child", name: "الفرع", parentId: "root", order: 0 });
  const grandchild = createHierarchicalTagValue({ id: "grandchild", name: "التفصيل", parentId: "child", order: 0 });
  const tags = [grandchild, child, root];
  const model = buildHierarchicalTagModel(tags);
  assert.deepEqual(model.roots.map((tag) => tag.id), ["root"]);
  assert.deepEqual(getDescendantTagIds("root", model.childrenByParent), ["child", "grandchild"]);
  assert.equal(getHierarchicalTagPath("grandchild", tags), "الأصل / الفرع / التفصيل");
  assert.equal(getNextHierarchicalTagOrder(tags, "root"), 1);
  assert.deepEqual(getFilteredHierarchicalTags(tags, "فرع").map((tag) => tag.id), ["grandchild", "child"]);
  const workspace = analyzeTagWorkspace({
    tags: [
      root,
      createHierarchicalTagValue({ id: "root-dup", name: " الأصل " }),
      child,
      createHierarchicalTagValue({ id: "unused", name: "غير مستخدم" })
    ],
    videoItems: [
      { id: "v1", tags: ["الأصل", "لقطة"] },
      { id: "v2", tags: ["لقطة", "قطة"], isDeleted: false }
    ],
    vocabulary: [
      createVocabularyEntryValue({ term: "الأصل", aliases: ["Root"] })
    ]
  });
  assert.equal(workspace.duplicates[0].key, "الاصل");
  assert.deepEqual(workspace.unused.map((item) => item.name), ["الفرع", "غير مستخدم"]);
  assert.equal(workspace.suggestions.some((item) => item.name === "لقطة"), true);
  assert.equal(workspace.aliasWarnings.length, 0);
});

run("collections view model", () => {
  const items = [
    { id: "v1", title: "مقابلة خاصة", tags: ["مهم"], updatedAt: "2026-01-01" },
    { id: "v2", title: "خبر عاجل", isDeleted: true },
    { id: "v3", title: "تقرير", tags: [] }
  ];
  const manual = createVirtualCollectionValue({ id: "c1", name: "مختارات", itemIds: ["v1", "v2"] });
  const smart = createVirtualCollectionValue({ id: "c2", name: "بحث", type: "smart", filterRules: { query: "مقابلة" } });

  assert.deepEqual(resolveCollectionItems(manual, items).map((item) => item.id), ["v1"]);
  assert.deepEqual(resolveCollectionItems(smart, items).map((item) => item.id), ["v1"]);
  assert.deepEqual(getAvailableCollectionItems(manual, items).map((item) => item.id), ["v3"]);
  assert.deepEqual(getFilteredCollections([manual, smart], "بحث").map((collection) => collection.id), ["c2"]);
  assert.deepEqual(getCollectionSummary([manual, smart], items), {
    total: 2,
    manual: 1,
    smart: 1,
    linkedItems: 1
  });
});

run("users view model", () => {
  const admin = createUserValue({ id: "admin", username: "admin", displayName: "المدير", role: "admin", isActive: true });
  const editor = createUserValue({ id: "editor", username: "editor", displayName: "محرر", role: "editor", isActive: true });
  const viewer = createUserValue({ id: "viewer", username: "viewer", displayName: "مشاهد", role: "missing", isActive: false });
  const users = [viewer, editor, admin];

  assert.equal(normalizeUserRole("missing"), "viewer");
  assert.equal(viewer.role, "viewer");
  assert.deepEqual(getFilteredUsers(users, "محرر", "all").map((user) => user.id), ["editor"]);
  assert.equal(getUserSummary(users).activeAdmins, 1);
  assert.equal(canDeactivateUser(admin, users), false);
  assert.equal(canDeactivateUser(editor, users), true);
});

run("types view model", () => {
  assert.equal(normalizeFieldStorageKey("اسم الحقل !"), "اسم_الحقل");
  assert.deepEqual(parseFieldOptions("أ، ب, ج"), ["أ", "ب", "ج"]);

  const type = createContentTypeValue({
    id: "interview",
    name: "مقابلات",
    fields: [
      createCustomFieldValue({ id: "guest", label: "الضيف", type: "text", order: 0 }),
      createCustomFieldValue({ id: "file", label: "ملف", type: "localFile", order: 1 })
    ],
    subtypes: [
      createSubtypeValue({ id: "full", name: "كاملة", fields: [createCustomFieldValue({ id: "season", label: "الموسم", order: 0 })] })
    ]
  });
  const archived = createContentTypeValue({ id: "old", name: "قديم", status: "archived" });
  assert.deepEqual(getFilteredContentTypes([archived, type], "مقاب", false).map((item) => item.id), ["interview"]);
  assert.equal(getTypeUsageCounts([type], [{ id: "v1", type: "interview" }, { id: "v2", type: "interview", isDeleted: true }]).interview, 1);
  assert.deepEqual(getFieldsForSelection([type], "interview", "full").map((field) => field.id), ["guest", "season", "file"]);
  assert.equal(hasMeaningfulFieldValue([]), false);
  assert.equal(hasMeaningfulFieldValue("ضيف"), true);
  const speakerField = createCustomFieldValue({ id: "speaker", label: "المتحدث", storageKey: "speaker" });
  const impactType = createContentTypeValue({
    id: "lecture",
    name: "محاضرة",
    fields: [speakerField],
    subtypes: [createSubtypeValue({ id: "main", name: "رئيسي" })]
  });
  const impactItems = [
    { id: "a", title: "محاضرة أولى", type: "lecture", subtype: "main", metadata: { speaker: "سارة" } },
    { id: "b", title: "محاضرة ثانية", type: "lecture", metadata: {} },
    { id: "c", title: "محذوفة", type: "lecture", metadata: { speaker: "أحمد" }, isDeleted: true },
    { id: "d", title: "مقابلة", type: "interview", metadata: { speaker: "ليلى" } }
  ];
  assert.equal(analyzeFieldImpact(speakerField, impactItems).affectedCount, 2);
  const typeImpact = analyzeTypeImpact(impactType, impactItems);
  assert.equal(typeImpact.affectedCount, 2);
  assert.equal(typeImpact.filledFieldCount, 1);
  assert.equal(typeImpact.subtypeCounts.main, 1);
  const defaults = getDefaultArchiveContentTypes();
  assert.equal(defaults.length >= 5, true);
  assert.equal(defaults.some((item) => (item.fields || []).some((field) => field.type === "localFile")), true);

  const draft = createContentTypeValue({
    id: "new-report",
    name: "تقارير",
    nameEn: "",
    fields: [
      createCustomFieldValue({ id: "a", label: "حالة", storageKey: "status", type: "select", options: ["جاهز", ""] }),
      createCustomFieldValue({ id: "b", label: "حالة ثانية", storageKey: "status", type: "text" }),
      createCustomFieldValue({ id: "c", label: "تابع", storageKey: "depends", showWhen: { fieldKey: "missing", equals: "x" } })
    ]
  });
  const validation = validateContentTypeDraft(draft, {
    contentTypes: [createContentTypeValue({ id: "reports", name: "تقارير", nameEn: "reports" })],
    previousType: createContentTypeValue({
      id: "new-report",
      name: "تقارير قديمة",
      fields: [createCustomFieldValue({ id: "a", label: "حالة", storageKey: "status", type: "text" })]
    }),
    videoItems: [{ id: "v1", type: "new-report", metadata: { status: "جاهز" } }]
  });
  assert.equal(suggestSafeTypeSlug("تقارير يومية 2026"), "reports-daily-2026");
  assert.equal(validation.canSave, false);
  assert.equal(validation.conflicts.some((item) => item.code === "duplicate-type-name"), true);
  assert.equal(validation.conflicts.some((item) => item.code === "duplicate-field-key"), true);
  assert.equal(validation.conflicts.some((item) => item.code === "empty-field-option"), true);
  assert.equal(validation.conflicts.some((item) => item.code === "missing-showwhen-field"), true);
  assert.equal(validation.conflicts.some((item) => item.code === "field-type-has-values"), true);
});

await runAsync("async action guard prevents duplicate work", async () => {
  const guard = createAsyncActionGuard();
  let calls = 0;
  const slow = () => new Promise((resolve) => {
    calls += 1;
    setTimeout(() => resolve(`done-${calls}`), 5);
  });
  const [first, second] = await Promise.all([guard.run(slow), guard.run(slow)]);
  assert.equal(first, "done-1");
  assert.equal(second, undefined);
  assert.equal(calls, 1);
  assert.equal(guard.isRunning(), false);
});

run("videos view model", () => {
  assert.deepEqual(parseVideoTags("أ، ب,#ج"), ["أ", "ب", "ج"]);
  const file = createLocalFileValue({ name: "clip.mp4", size: 1024, type: "video/mp4", lastModified: Date.UTC(2026, 0, 1), webkitRelativePath: "clips/clip.mp4" });
  assert.equal(file.extension, "mp4");
  assert.equal(normalizeLocalFileValue("D:\\clips\\clip.mp4").name, "clip.mp4");
  const patch = createVideoLocalFilePatch({ name: "raw.mov", size: 2048, type: "video/quicktime", webkitRelativePath: "raw/raw.mov" }, { currentTitle: "" });
  assert.equal(patch.title, "raw");
  assert.equal(patch.path, "raw/raw.mov");
  assert.equal(patch.metadata.localFile.extension, "mov");
  const item = createVideoItemValue({ title: "فيديو", type: "movie", tags: "أ، ب", metadata: { local: file }, fieldAcl: { local: ["admin"] } });
  assert.deepEqual(item.tags, ["أ", "ب"]);
  assert.deepEqual(item.fieldAcl.local, ["admin"]);
  assert.equal(getTypeLabel([{ id: "movie", name: "أفلام", subtypes: [{ id: "full", name: "كامل" }] }], "movie"), "أفلام");
  assert.equal(getSubtypeLabel([{ id: "movie", subtypes: [{ id: "full", name: "كامل" }] }], "movie", "full"), "كامل");
});

run("field ACL view model", () => {
  const acl = normalizeFieldAcl({ transcript: ["admin", "editor", "bad", "admin"], notes: ["admin"] });
  assert.deepEqual(acl.transcript, ["admin", "editor"]);
  assert.equal(canViewField("transcript", acl, { role: "editor" }), true);
  assert.equal(canViewField("transcript", acl, { role: "viewer" }), false);
  assert.equal(canViewField("unknown", acl, { role: "viewer" }), true);
  const item = {
    id: "v1",
    notes: "سر",
    metadata: { transcript: "نص حساس", public: "ظاهر" },
    fieldAcl: acl
  };
  const filtered = filterItemByFieldAcl(item, { role: "viewer" });
  assert.equal(filtered.notes, "");
  assert.deepEqual(filtered.metadata, { public: "ظاهر" });
});

run("notifications view model", () => {
  const first = normalizeNotification({ id: "n1", type: "success", category: "task", message: "تمت المهمة" });
  const second = normalizeNotification({ id: "n2", type: "error", category: "share", message: "فشل", readAt: "2026-01-01T00:00:00.000Z" });
  const archived = normalizeNotification({ id: "n3", type: "info", category: "system", message: "قديم", archivedAt: "2026-01-02T00:00:00.000Z" });
  const history = [first, second, archived];
  assert.equal(first.category, "task");
  assert.equal(first.readAt, null);
  assert.deepEqual(getUnreadNotifications(history).map((item) => item.id), ["n1"]);
  assert.equal(getNotificationCounts(history).unread, 1);
  assert.equal(getNotificationCounts(history).archived, 1);
  assert.equal(getNotificationCounts(history).task, 1);
  assert.deepEqual(filterNotifications(history, "share").map((item) => item.id), ["n2"]);
  assert.deepEqual(filterNotifications(history, "unread").map((item) => item.id), ["n1"]);
  assert.deepEqual(filterNotifications(history, { filter: "archived" }).map((item) => item.id), ["n3"]);
  assert.deepEqual(filterNotifications(history, { filter: "all", readState: "read" }).map((item) => item.id), ["n2"]);
  assert.deepEqual(filterNotifications(history, { filter: "all", query: "مهمه" }).map((item) => item.id), ["n1"]);
  assert.equal(groupNotificationsByDay(history, "all").length >= 1, true);
  assert.equal(shouldShowNotificationToast({ notifications: { mutedCategories: ["task"] } }, first), false);
  assert.equal(shouldShowNotificationToast({ notifications: { toastByType: { error: false } } }, second), false);
});

run("error recovery notice", () => {
  const notice = createRecoveryNotice(new Error("network timeout"), { context: "حفظ المادة" });
  assert.equal(notice.title, "فشل حفظ المادة");
  assert.equal(notice.reason, "اتصال غير مستقر");
  assert.equal(notice.message.includes("التعافي:"), true);
  assert.equal(notice.technicalDetails.includes("context: حفظ المادة"), true);
});

run("operational notifications", () => {
  const degraded = createConnectionStatusNotification({ state: "online" }, { state: "degraded", lastError: "db slow" });
  assert.equal(degraded.type, "warning");
  assert.equal(createConnectionStatusNotification({ state: "degraded" }, { state: "degraded" }), null);
  const online = createConnectionStatusNotification({ state: "offline" }, { state: "online", lastLatencyMs: 42 });
  assert.equal(online.type, "success");
  assert.equal(shouldEmitOperationalNotification(degraded, {}, 1000, 500), true);
  assert.equal(shouldEmitOperationalNotification(degraded, { [degraded.key]: 800 }, 1000, 500), false);
});

run("archive file import helpers", () => {
  assert.equal(isLikelyVideoFile({ name: "clip.mkv", type: "" }), true);
  assert.equal(isLikelyVideoFile({ name: "notes.pdf", type: "application/pdf" }), false);
  const rows = createFileImportRows([
    { name: "clip.mp4", size: 2048, type: "video/mp4", lastModified: Date.UTC(2026, 0, 1), webkitRelativePath: "batch/clip.mp4" },
    { name: "notes.txt", size: 20, type: "text/plain", lastModified: Date.UTC(2026, 0, 1) }
  ], [
    { title: "old", path: "old.mp4" }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "clip");
  assert.equal(rows[0].path, "batch/clip.mp4");
  assert.equal(rows[0].localFile.extension, "mp4");
});

run("global shortcut action resolver", () => {
  const ctrlK = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: "k", target: { tagName: "BODY" } };
  const ctrlSlashInInput = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: "/", target: { tagName: "INPUT" } };
  const ctrlKInInput = { ...ctrlK, target: { tagName: "INPUT" } };
  assert.equal(getGlobalShortcutAction(ctrlK, {}), "openCommandPalette");
  assert.equal(getGlobalShortcutAction(ctrlSlashInInput, {}), "showShortcuts");
  assert.equal(getGlobalShortcutAction(ctrlKInInput, {}), "openCommandPalette");

  const altK = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: true, key: "k", target: { tagName: "BODY" } };
  const altKInInput = { ...altK, target: { tagName: "INPUT" } };
  assert.equal(getGlobalShortcutAction(altK, {}), "openSearch");
  assert.equal(getGlobalShortcutAction(altKInInput, {}), null);

  assert.equal(getGlobalShortcutAction(ctrlK, { keyboardShortcuts: { openCommandPalette: "disabled" } }), null);
});

run("shortcut and command dialog view models", () => {
  const actions = [
    { id: "openSearch", label: "فتح البحث المتقدم", category: "التنقل", defaultKeys: "Ctrl+K" },
    { id: "lockApp", label: "قفل التطبيق", category: "الأمان", defaultKeys: "Ctrl+Shift+L" }
  ];
  const items = createShortcutDialogItems(actions);
  const visible = filterShortcutDialogItems(items, "قفل", { lockApp: "Alt+L" });
  assert.deepEqual(visible.map((item) => item.id), ["lockApp"]);
  assert.deepEqual(getShortcutDialogCategories(items), ["التنقل", "الأمان"]);
  assert.deepEqual(getShortcutDialogItemsForCategory(actions, visible, "الأمان").map((item) => item.id), ["lockApp"]);

  const commands = filterCommandPaletteCommands([
    { id: "backup", label: "فتح مركز البيانات", detail: "نسخ احتياطي واستيراد", keys: "Ctrl+B" },
    { id: "help", label: "فتح مركز المساعدة", detail: "تعليمات", keys: "Ctrl+/" }
  ], "استيراد");
  assert.deepEqual(commands.map((command) => command.id), ["backup"]);
  assert.deepEqual(groupCommandPaletteCommands([
    { id: "a", kind: "item" },
    { id: "b", group: "settings" },
    { id: "c", kind: "page" }
  ]).map((group) => group.id), ["page", "item", "settings"]);
});

run("help view model", () => {
  assert.equal(HELP_QUICK_SECTION_LINKS.some(([sectionId]) => sectionId === "shortcuts"), true);
  assert.equal(HELP_FAQ_ITEMS.some((faq) => faq.question.includes("فيديو")), true);
  assert.equal(normalizeHelpSectionId("keyboard"), "shortcuts");
  assert.equal(normalizeHelpSectionId(""), "getting-started");
  assert.deepEqual(filterHelpSections([
    { id: "getting-started", title: "البدء" },
    { id: "backup-import", title: "النسخ الاحتياطي", searchText: "استيراد نقل" }
  ], "نقل").map((section) => section.id), ["backup-import"]);
  assert.deepEqual(filterHelpFaqItems([
    { question: "كيف أبحث؟", answer: "استخدم الأرشيف" },
    { question: "كيف أنقل البيانات؟", answer: "استخدم ملف النقل" }
  ], "النقل").map((faq) => faq.question), ["كيف أنقل البيانات؟"]);

  const shortcutList = createHelpShortcutList([
    { id: "openSearch", label: "فتح البحث", category: "التنقل", defaultKeys: "Ctrl+K" },
    { id: "openBackup", label: "مركز البيانات", category: "التنقل", defaultKeys: "Ctrl+B" }
  ], { openBackup: "disabled" });
  assert.deepEqual(shortcutList[0].keys, ["Ctrl", "K"]);
  assert.equal(shortcutList[1].disabled, true);
});

run("settings view model", () => {
  assert.equal(normalizeSettingsTab("shortcuts"), "shortcuts");
  assert.equal(normalizeSettingsTab("missing"), "general");
  assert.equal(getSettingsTabState("security").activeLabel, "الأمان");
  assert.deepEqual(createSettingsTabUiPatch({ ui: { lastSettingsTab: "general", lastHelpSection: "x" } }, "data"), {
    ui: { lastSettingsTab: "data", lastHelpSection: "x" }
  });
  assert.equal(
    hasMeaningfulSettingsDraftChanges(
      { ui: { lastSettingsTab: "general" }, theme: "dark" },
      { ui: { lastSettingsTab: "security" }, theme: "dark" },
      "dark"
    ),
    false
  );
});

run("onboarding view model", () => {
  // welcome=0, storage=1, security=2, admin=3, appearance=4 (storage step
  // added in spB-B3 wizard UI).
  assert.equal(getOnboardingStepIndex("appearance"), 4);
  assert.equal(getNextOnboardingStep("appearance").id, "interface");
  assert.equal(getOnboardingStepIndex("storage"), 1);
  assert.equal(getNextOnboardingStep("storage").id, "security");
  assert.equal(getFirstTaskDestination("import-backup"), "backup");
  assert.equal(getOnboardingDestination("create-type"), "types");
  assert.equal(shouldShowStartupOnboarding({ authState: "setup", settings: { ui: { v1OnboardingCompleted: false } } }), true);
  assert.equal(shouldShowStartupOnboarding({ authState: "login", settings: { ui: { v1OnboardingCompleted: false } } }), false);
  assert.equal(shouldShowV1Tour({ settings: { ui: { v1OnboardingCompleted: true, v1TourCompleted: false } }, currentPage: "dashboard" }), true);
  assert.equal(shouldShowV1Tour({ settings: { ui: { v1OnboardingCompleted: true, v1TourCompleted: true, v1TourVersion: "old" } }, currentPage: "dashboard" }), true);
  assert.equal(shouldShowV1Tour({ settings: { ui: { v1OnboardingCompleted: true, v1TourCompleted: true, v1TourVersion: PRODUCT_TOUR_VERSION } }, currentPage: "dashboard" }), false);
  assert.deepEqual(createOnboardingUiPatch({
    stepId: "interface",
    securityMode: "quick",
    themeChoice: "system",
    firstTaskChoice: "add-video",
    completed: true,
    now: "2026-01-01T00:00:00.000Z"
  }), {
    lastOnboardingStep: "interface",
    onboardingSecurityMode: "quick",
    onboardingThemeChoice: "system",
    serverUpdatePolicy: "stable",
    firstTaskChoice: "add-video",
    v1OnboardingCompleted: true,
    onboardingSkippedAt: null,
    onboardingCoreUiSeenAt: "2026-01-01T00:00:00.000Z"
  });
  assert.deepEqual(createOnboardingCompletionPatch({
    securityMode: "quick",
    themeChoice: "light",
    accentColor: "indigo",
    visualDensity: "compact",
    firstTaskChoice: "create-type",
    serverUpdatePolicy: "preview",
    now: "2026-01-01T00:00:00.000Z"
  }).ui, {
    onboardingCompleted: true,
    v1OnboardingCompleted: true,
    onboardingSecurityMode: "quick",
    onboardingThemeChoice: "light",
    onboardingCoreUiSeenAt: "2026-01-01T00:00:00.000Z",
    onboardingSkippedAt: "2026-01-01T00:00:00.000Z",
    firstTaskChoice: "create-type",
    serverUpdatePolicy: "preview",
    lastOnboardingStep: "completed",
    visualDensity: "compact",
    onboardingReplayCompletedAt: null,
    firstTaskChoiceUsed: false
  });
});

run("navigation view model", () => {
  const groups = getSidebarNavigationGroups();
  assert.equal(groups.some((group) => group.id === "daily"), true);
  assert.equal(getPageContextBarModel("archive").title, "الأرشيف");
  assert.equal(getPrimaryPageAction("backup").dataTab, "import");
});

run("page migration native status", () => {
  const status = getPageMigrationStatus();
  const summary = getPageMigrationSummary(status);
  assert.equal(summary.total, 25);
  assert.equal(summary.native, 25);
  assert.equal(summary.wrappedPages, 0);
  assert.equal(status.find((page) => page.id === "archive")?.status, "native");
  assert.equal(status.find((page) => page.id === "dashboard")?.status, "native");
  assert.equal(status.find((page) => page.id === "backup")?.status, "native");
  assert.equal(status.find((page) => page.id === "reports")?.status, "native");
  assert.equal(status.find((page) => page.id === "help")?.status, "native");
  assert.equal(status.find((page) => page.id === "settings")?.status, "native");
  assert.equal(status.find((page) => page.id === "search")?.status, "native");
  assert.equal(status.find((page) => page.id === "history")?.status, "native");
  assert.equal(status.find((page) => page.id === "collections")?.status, "native");
  assert.equal(status.find((page) => page.id === "vocabulary")?.status, "native");
  assert.equal(status.find((page) => page.id === "htags")?.status, "native");
  assert.equal(status.find((page) => page.id === "users")?.status, "native");
  assert.equal(status.find((page) => page.id === "types")?.status, "native");
  assert.equal(status.find((page) => page.id === "add")?.status, "native");
  assert.equal(status.find((page) => page.id === "detail")?.status, "native");
});

run("data portability JSON safety", () => {
  let sawParseError = false;
  assert.deepEqual(safeJsonParse("{\"ok\":true}", null), { ok: true });
  assert.equal(safeJsonParse("{", "fallback", { onError: () => { sawParseError = true; } }), "fallback");
  assert.equal(sawParseError, true);

  const unsafe = { keep: 1, nested: { ok: 2 }, skip: undefined, fn: () => {} };
  Object.defineProperty(unsafe, "__proto__", { value: { polluted: true }, enumerable: true });
  unsafe.constructor = "blocked";
  unsafe.prototype = "blocked";
  unsafe.self = unsafe;

  const clean = sanitizePlainData(unsafe);
  assert.equal(Object.hasOwn(clean, "__proto__"), false);
  assert.equal(Object.hasOwn(clean, "constructor"), false);
  assert.equal(Object.hasOwn(clean, "prototype"), false);
  assert.equal(Object.hasOwn(clean, "skip"), false);
  assert.equal(Object.hasOwn(clean, "fn"), false);
  assert.deepEqual(clean.nested, { ok: 2 });
  assert.equal(clean.self, null);
});

run("transfer package normalization hook", () => {
  const packageData = createTransferPackage({
    contentTypes: [{ id: "type", name: "نوع", fields: [], subtypes: [] }],
    videoItems: [{ id: "video", type: "type", title: "فيديو" }]
  }, "test");

  const result = readTransferPackage(JSON.stringify(packageData), {
    normalizePayload: (payload) => ({
      ...payload,
      videoItems: payload.videoItems.map((item) => ({ ...item, title: `${item.title} معدل` }))
    })
  });

  assert.equal(result.valid, true);
  assert.equal(result.payload.videoItems[0].title, "فيديو معدل");
  assert.equal(result.package.payload.videoItems[0].title, "فيديو معدل");
});

await runAsync("archive import file reader", async () => {
  const baseState = {
    contentTypes: [{ id: "type", name: "نوع", fields: [], subtypes: [] }],
    videoItems: [{ id: "video", type: "type", title: "فيديو" }]
  };

  const jsonResult = await readArchiveImportFile({
    name: "archive.json",
    type: "application/json",
    text: async () => JSON.stringify(baseState)
  }, {
    normalizePayload: (payload) => ({ ...payload, version: payload.version || "2.0" })
  });
  assert.equal(jsonResult.valid, true);
  assert.equal(jsonResult.sourceType, "json");

  const transferPackage = createTransferPackage(baseState, "test");
  const transferResult = await readArchiveImportFile({
    name: "transfer.json",
    type: "application/json",
    text: async () => JSON.stringify(transferPackage)
  });
  assert.equal(transferResult.valid, true);
  assert.equal(transferResult.sourceType, "transfer");
  assert.equal(transferResult.packageInfo.packageType, "video-archive-transfer");

  const excelPackage = createArchiveExcelPackagePayload(baseState);
  const fakeXlsx = {
    read: () => ({ Sheets: { __archive_payload: {} } }),
    utils: {
      sheet_to_json: () => excelPackage.rows
    }
  };
  // The importer guards against CVE-2024-22363 by requiring the ZIP/OOXML
  // magic bytes (PK\x03\x04) — the fake buffer must carry a valid signature.
  const fakeOoxmlBuffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
  const excelResult = await readArchiveImportFile({
    name: "archive.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    arrayBuffer: async () => fakeOoxmlBuffer
  }, {
    loadXlsx: async () => fakeXlsx
  });
  assert.equal(isArchiveExcelImportFile({ name: "archive.xlsx" }), true);
  assert.equal(excelResult.valid, true);
  assert.equal(excelResult.sourceType, "excel");
});

run("data center view model", () => {
  const filters = createDataCenterExportFilters({
    typeFilter: "video",
    collectionFilter: "collection-1",
    dateFrom: "2026-01-01",
    favoritesOnly: true
  });
  assert.deepEqual(filters, {
    filters: {
      type: "video",
      collectionId: "collection-1",
      dateFrom: "2026-01-01",
      dateTo: "",
      favoriteOnly: true
    },
    compact: true
  });

  const summary = createDataCenterExportSummary({
    data: {
      videoItems: [{ id: "v1" }],
      contentTypes: [{ id: "type" }],
      users: [],
      auditLogs: [{ id: "log" }]
    },
    estimatedSize: 2048,
    filters: { typeFilter: "video", collectionFilter: "all", dateFrom: "", dateTo: "", favoritesOnly: false },
    formatFileSize: (value) => `${value}B`
  });
  assert.equal(summary.find((item) => item.label === "العناصر").value, 1);
  assert.equal(summary.find((item) => item.label === "الفلاتر").value, "نوع محدد");

  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  assert.equal(getNextBackupTime("daily", null, now).toISOString(), "2026-01-02T00:00:00.000Z");
  assert.equal(formatTimeUntilBackup(new Date(now + 90 * 60000), now), "بعد 1 ساعة و30 دقيقة");
});

import { getItemComments, canDeleteComment, extractMentionUsernames } from "../src/features/comments/viewModel.js";

run("comments view model — derives item thread from audit logs", () => {
  const logs = [
    { id: "c2", eventType: "comment.create", targetType: "video", targetId: "v1", userId: "u2", username: "editor", timestamp: "2026-01-01T10:02:00Z", details: { text: "ثاني" } },
    { id: "x", eventType: "video.update", targetType: "video", targetId: "v1", details: {} },
    { id: "deleted", eventType: "comment.create", targetType: "video", targetId: "v1", userId: "u1", username: "admin", timestamp: "2026-01-01T10:03:00Z", details: { text: "محذوف", deletedAt: "2026-01-01T10:04:00Z" } },
    { id: "c1", eventType: "comment.create", targetType: "video", targetId: "v1", userId: "u1", username: "admin", timestamp: "2026-01-01T10:00:00Z", details: { text: "أول" } },
    { id: "other", eventType: "comment.create", targetType: "video", targetId: "v2", details: { text: "خارج" } }
  ];
  const comments = getItemComments(logs, "v1");
  assert.deepEqual(comments.map((comment) => comment.id), ["c1", "c2"]);
  assert.equal(comments[0].text, "أول");
  assert.equal(comments[1].author, "editor");
  assert.equal(canDeleteComment(comments[1], { id: "u2", role: "viewer", isActive: true }), true);
  assert.equal(canDeleteComment(comments[1], { id: "u3", role: "viewer", isActive: true }), false);
  assert.equal(canDeleteComment(comments[1], { id: "u3", role: "editor", isActive: true }), true);
  assert.deepEqual(extractMentionUsernames("راجع @editor و@admin، ثم @editor مرة أخرى."), ["editor", "admin"]);
});

run("archive Excel workbook service", () => {
  const fakeXlsx = {
    utils: {
      book_new: () => ({ SheetNames: [], Sheets: {} }),
      json_to_sheet: (rows) => ({ rows }),
      aoa_to_sheet: (rows) => ({ rows }),
      encode_range: () => "A1:B2",
      book_append_sheet: (workbook, sheet, name) => {
        workbook.SheetNames.push(name);
        workbook.Sheets[name] = sheet;
      }
    }
  };
  const state = {
    contentTypes: [
      { id: "type", name: "نوع", fields: [{ id: "duration", label: "المدة", type: "text" }], subtypes: [] }
    ],
    videoItems: [
      { id: "video", type: "type", title: "فيديو", tags: ["وسم"], metadata: { duration: "10:00" }, createdAt: "2026-01-01", updatedAt: "2026-01-02" }
    ],
    settings: {},
    users: []
  };
  const { workbook, checksum } = createArchiveExcelWorkbook(fakeXlsx, state);

  assert.equal(workbook.SheetNames[0], "00_الفهرس");
  assert.equal(workbook.SheetNames.includes("__archive_payload"), true);
  assert.equal(Boolean(checksum), true);
  assert.equal(workbook.Workbook.Sheets.find((sheet) => sheet.name === "__archive_payload")?.Hidden, 1);
});

run("archive CSV export files", () => {
  const files = createArchiveCsvExportFiles({
    contentTypes: [{ id: "type", name: "نوع", archivedAt: "2026-01-01" }],
    videoItems: [{ id: "video", type: "type", title: "فيديو", tags: ["وسم"], isFavorite: true }],
    virtualCollections: [{ id: "collection", name: "مجموعة", itemIds: ["video"], isSmart: true }],
    users: [{ id: "user", username: "admin", displayName: "مدير", role: "admin", isActive: true }]
  }, {
    isArchivedRecord: (record) => Boolean(record.archivedAt)
  });

  assert.deepEqual(files.map((file) => file.slug), ["items", "content-types", "collections", "users"]);
  assert.equal(files[0].rows[0]["النوع"], "نوع");
  assert.equal(files[1].rows[0]["مؤرشف"], "نعم");
  assert.equal(files[2].rows[0]["ذكية"], "نعم");
});

run("dashboard view model", () => {
  assert.equal(parseDurationSeconds("01:02:03"), 3723);
  assert.equal(parseDurationSeconds("12:30"), 750);

  const now = Date.UTC(2026, 0, 8);
  const stats = createDashboardStats({
    now,
    videoItems: [
      { id: "demo-1", createdAt: new Date(now - 2 * 86400000).toISOString(), updatedAt: new Date(now - 86400000).toISOString(), metadata: { duration: "01:00:00" }, isFavorite: true },
      { id: "v2", createdAt: new Date(now - 10 * 86400000).toISOString(), updatedAt: new Date(now - 10 * 86400000).toISOString(), duration: 1800 },
      { id: "v3", isDeleted: true }
    ],
    contentTypes: [{ id: "type" }],
    virtualCollections: [{ id: "collection" }],
    hierarchicalTags: [{ id: "tag" }]
  });
  assert.equal(stats.total, 2);
  assert.equal(stats.totalHours, "2 س");
  assert.equal(stats.addedThisWeek, 1);
  assert.equal(stats.recentActivity, 1);
  assert.deepEqual(getDashboardDemoItemIds([{ id: "demo-1" }, { id: "v2" }]), ["demo-1"]);
  const focusItems = getDailyFocusItems({
    now,
    stats: { ...stats, needsReview: 2, completenessAverage: 64 },
    settings: {
      lastBackupAt: new Date(now - 8 * 86400000).toISOString(),
      systemHealth: { lastCheckAt: new Date(now - 2 * 86400000).toISOString() }
    },
    recentItems: [{ id: "v2", title: "جلسة مراجعة" }]
  });
  assert.deepEqual(focusItems.map((item) => item.id), ["review", "backup", "health", "recent"]);
  assert.equal(getDailyFocusItems({ now, stats: { total: 0 }, settings: {} })[0].action, "add");
  assert.equal(hasDashboardLayoutDraftChanges({ draftLayout: ["a"], currentLayout: ["b"] }), true);
  assert.equal(hasDashboardLayoutDraftChanges({ draftLayout: ["a"], currentLayout: ["a"] }), false);
});

run("dashboard customization grid layout", () => {
  const ids = Object.keys(DASHBOARD_DEFAULT_ITEMS);
  const def = getDefaultDashboardLayout();
  assert.deepEqual(Object.keys(def.items).sort(), [...ids].sort(), "default covers every panel");
  assert.equal(def.version, 1);
  assert.equal(def.items.hero.autoHeight, true);

  // corrupt / wrong-version input falls back to default (only available ids)
  const fromCorrupt = normalizeDashboardLayout({ version: 99, junk: true }, ids);
  assert.deepEqual(Object.keys(fromCorrupt.items).sort(), [...ids].sort());

  // unknown stored panel dropped, missing panel appended below
  const partial = { version: 1, items: {
    hero: { x: 0, y: 0, w: 12, h: 8 },
    ghost: { x: 0, y: 0, w: 4, h: 4 }
  } };
  const normalized = normalizeDashboardLayout(partial, ids);
  assert.equal(normalized.items.ghost, undefined, "unknown panel dropped");
  assert.ok(normalized.items.reportStrip, "missing panel appended");
  assert.equal(normalized.items.hero.w, 12, "valid stored geometry kept");

  // toGridLayout: visible only + resize handles reflect auto-height
  const hidden = setPanelHidden(def, "savedViews", true);
  const grid = toGridLayout(hidden, ids);
  assert.ok(!grid.some((n) => n.i === "savedViews"), "hidden panel excluded from grid");
  assert.deepEqual(grid.find((n) => n.i === "hero").resizeHandles, ["e", "w"], "auto-height = width-only resize");
  const manual = setPanelAutoHeight(def, "hero", false);
  assert.ok(toGridLayout(manual, ids).find((n) => n.i === "hero").resizeHandles.includes("s"), "manual height enables vertical resize");

  // applyGridChange merges RGL positions back
  const moved = applyGridChange(def, [{ i: "hero", x: 2, y: 1, w: 6, h: 5 }]);
  assert.equal(moved.items.hero.x, 2);
  assert.equal(moved.items.hero.w, 6);
  assert.equal(moved.items.reportStrip.x, def.items.reportStrip.x, "untouched panels preserved");

  // draft change detection (order-independent)
  assert.equal(gridLayoutChanged(def, def), false);
  assert.equal(gridLayoutChanged(def, moved), true);
  assert.equal(gridLayoutChanged(def, getDefaultDashboardLayout()), false, "key order does not matter");
  console.log("ok: dashboard customization grid layout");
});

run("import preview summaries", () => {
  const summary = createImportPreviewSummary(
    {
      settings: { theme: "dark" },
      videoItems: [
        { id: "v1", title: "Same title", updatedAt: "newer" },
        { id: "v2", title: "Same title" }
      ],
      users: [{ id: "u2", name: "Imported" }]
    },
    {
      videoItems: [{ id: "v1", title: "Same title", updatedAt: "older" }],
      users: [{ id: "u1", name: "Current" }]
    }
  );

  const videoEntity = summary.entities.find((entity) => entity.key === "videoItems");
  assert.equal(videoEntity.total, 2);
  assert.equal(videoEntity.newCount, 1);
  assert.equal(videoEntity.duplicateCount, 1);
  assert.equal(videoEntity.conflictCount, 0);
  assert.equal(videoEntity.potentialDuplicateCount, 1);
  assert.equal(summary.hasSettings, true);
  assert.equal(summary.hasUsers, true);

  const formatted = formatImportPreviewSummary(summary, {
    fileName: "archive.json",
    fileSize: 25,
    packageInfo: { checksum: "abcdef1234567890zz" }
  }, { formatFileSize: (value) => `${value}B` });
  assert.match(formatted, /archive\.json/);
  assert.match(formatted, /25B/);
  assert.match(formatted, /abcdef1234567890/);
});

run("operation preflight checks", () => {
  assert.equal(createOperationSizeCheck({ records: 50001 }).status, "warning");
  assert.equal(createOperationSizeCheck({ estimatedSize: 120 * 1024 * 1024 }).status, "ok");
  assert.equal(createSqliteReadinessCheck({ sqliteReady: false }).status, "warning");
  assert.equal(createSqliteReadinessCheck({ sqliteReady: true }).status, "ok");
  assert.equal(createStorageEstimateCheck({ usage: 93, quota: 100 }).status, "warning");
  assert.match(formatPreflightSummary({ checks: [{ status: "ok", label: "Storage", message: "Ready" }] }), /Storage: Ready/);
});

run("router helpers", () => {
  assert.equal(normalizeRoutePage("/detail/123"), "detail");
  assert.equal(buildAppRoute("detail", { selectedItemId: "clip 1" }), "#/detail/clip%201");

  const hashRoute = parseAppRoute({ hash: "#/help?section=transfer", protocol: "http:", pathname: "/", search: "" });
  assert.equal(hashRoute.page, "help");
  assert.equal(hashRoute.section, "transfer");

  const historyRoute = parseAppRoute({ hash: "", protocol: "http:", pathname: "/detail/video%201", search: "?tab=meta" });
  assert.equal(historyRoute.page, "detail");
  assert.equal(historyRoute.selectedItemId, "video 1");
  assert.equal(historyRoute.params.get("tab"), "meta");
});

run("theme accent tokens", () => {
  assert.deepEqual(getAccentColorTokens("indigo"), { accent: "#5b5fc7", strong: "#4338ca", soft: "#27275f" });
  assert.equal(getAccentColorTokens("missing").accent, "#2563eb");

  const writes = [];
  const tokens = applyAccentColor("rose", {
    style: {
      setProperty: (key, value) => writes.push([key, value])
    }
  });
  assert.equal(tokens.accent, "#e11d48");
  // Palette scale tokens are written first (drives Tailwind overrides) …
  assert.deepEqual(writes[0], ["--va-accent-50", "oklch(97.7% 0.013 17.4)"]);
  // … and the legacy aliases are still written for backward compatibility.
  assert.deepEqual(
    writes.find(([key]) => key === "--app-accent"),
    ["--app-accent", "#e11d48"]
  );
});

function createRequest(result) {
  const request = { result, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => request.onsuccess?.());
  return request;
}

function createFakeIndexedDB() {
  const stores = new Map();
  const keyPaths = new Map();

  const db = {
    objectStoreNames: {
      contains: (name) => stores.has(name)
    },
    createObjectStore: (name, options = {}) => {
      if (!stores.has(name)) stores.set(name, new Map());
      keyPaths.set(name, options.keyPath || "id");
      return stores.get(name);
    },
    transaction: (storeNames) => {
      const tx = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: (storeName) => {
          if (!stores.has(storeName)) {
            stores.set(storeName, new Map());
            keyPaths.set(storeName, "id");
          }
          const store = stores.get(storeName);
          const keyPath = keyPaths.get(storeName) || "id";
          const complete = () => queueMicrotask(() => tx.oncomplete?.());
          return {
            get: (key) => createRequest(store.get(key)),
            getAll: () => createRequest([...store.values()]),
            put: (record) => {
              store.set(record?.[keyPath], record);
              complete();
              return createRequest(record);
            },
            add: (record) => {
              store.set(record?.[keyPath], record);
              complete();
              return createRequest(record);
            },
            delete: (key) => {
              store.delete(key);
              complete();
              return createRequest(undefined);
            },
            clear: () => {
              store.clear();
              complete();
              return createRequest(undefined);
            }
          };
        }
      };
      queueMicrotask(() => tx.oncomplete?.());
      for (const storeName of Array.isArray(storeNames) ? storeNames : [storeNames]) {
        if (!stores.has(storeName)) {
          stores.set(storeName, new Map());
          keyPaths.set(storeName, storeName === "settings" ? "key" : "id");
        }
      }
      return tx;
    }
  };

  return {
    open: () => {
      const request = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
}

function installStoreSmokeGlobals() {
  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };
  globalThis.indexedDB = createFakeIndexedDB();
  globalThis.localStorage = localStorage;
  globalThis.window = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    localStorage,
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

await runAsync("store action smoke tests", async () => {
  installStoreSmokeGlobals();
  const { useAppStore, useAuthStore } = await import("../src/stores/appStore.js");
  const { importNormalizedPayload } = await import("../src/services/data-portability/normalizedImport.js");

  const store = useAppStore.getState();
  await store.loadAllData();
  await store.skipPasswordSetup();
  assert.equal(useAuthStore.getState().isAuthenticated, true);
  assert.equal(useAuthStore.getState().currentUser?.username, "admin");

  await store.setMasterPassword("StrongPass123!");
  assert.equal(useAppStore.getState().isPasswordSet, true);
  assert.equal(await useAuthStore.getState().login("admin", "StrongPass123!"), true);

  const notificationId = useAppStore.getState().showNotification("مهمة تجريبية", { category: "task", targetLabel: "مشروع smoke" });
  assert.equal(getUnreadNotifications(useAppStore.getState().notificationHistory).length, 1);
  useAppStore.getState().markNotificationsRead([notificationId]);
  assert.equal(getUnreadNotifications(useAppStore.getState().notificationHistory).length, 0);

  const type = await useAppStore.getState().addContentType({ id: "smoke-type", name: "نوع smoke", fields: [], subtypes: [] });
  const video = await useAppStore.getState().addVideoItem({ id: "smoke-video", title: "فيديو smoke", type: type.id });
  const updated = await useAppStore.getState().updateVideoItem({ ...video, title: "فيديو معدل" });
  assert.equal(updated.title, "فيديو معدل");

  const comment = await useAppStore.getState().addItemComment(video.id, "ملاحظة إنتاج");
  assert.equal(comment.targetId, video.id);
  assert.equal(getItemComments(useAppStore.getState().auditLogs, video.id).length, 1);
  assert.equal(await useAppStore.getState().deleteItemComment(comment.id), true);
  assert.equal(getItemComments(useAppStore.getState().auditLogs, video.id).length, 0);
  assert.ok(useAppStore.getState().auditLogs.find((log) => log.id === comment.id)?.details?.deletedAt);

  assert.equal(await useAppStore.getState().deleteVideoItem(video.id), true);
  assert.equal(useAppStore.getState().videoItems.find((item) => item.id === video.id)?.isDeleted, true);
  assert.equal(await useAppStore.getState().restoreVideoItem(video.id), true);
  assert.equal(useAppStore.getState().videoItems.find((item) => item.id === video.id)?.isDeleted, false);

  const settings = await useAppStore.getState().updateSettings({ theme: "light", ui: { lastSettingsTab: "security" } });
  assert.equal(settings.theme, "light");
  assert.equal(settings.ui.lastSettingsTab, "security");

  // Projects (G5) persist through the StorageProvider like any other store.
  const project = await useAppStore.getState().addProject({ name: "مشروع smoke", itemIds: [video.id] });
  assert.equal(useAppStore.getState().projects.some((p) => p.id === project.id), true);
  await useAppStore.getState().updateProject({ ...project, name: "مشروع معدّل" });
  await useAppStore.getState().loadAllData();
  assert.equal(useAppStore.getState().projects.find((p) => p.id === project.id)?.name, "مشروع معدّل");
  assert.equal(await useAppStore.getState().deleteProject(project.id), true);
  assert.equal(useAppStore.getState().projects.some((p) => p.id === project.id), false);

  const backup = await useAppStore.getState().createBackup("Smoke backup");
  assert.equal(backup.itemCount, 1);

  const mergeResult = await importNormalizedPayload({
    contentTypes: [{ id: "smoke-type", name: "نوع smoke", fields: [], subtypes: [] }],
    videoItems: [{ id: "merge-video", title: "مادة مدمجة", type: "smoke-type" }],
    settings: { theme: "dark" }
  }, "merge");
  assert.equal(mergeResult.success, true);
  await useAppStore.getState().loadAllData();
  assert.equal(useAppStore.getState().videoItems.some((item) => item.id === "merge-video"), true);

  const replaceResult = await importNormalizedPayload({
    contentTypes: [{ id: "replace-type", name: "نوع بديل", fields: [], subtypes: [] }],
    videoItems: [{ id: "replace-video", title: "مادة بديلة", type: "replace-type" }],
    settings: { theme: "light" }
  }, "replace");
  assert.equal(replaceResult.success, true);
  await useAppStore.getState().loadAllData();
  assert.deepEqual(useAppStore.getState().videoItems.map((item) => item.id), ["replace-video"]);
});

run("storage ports", () => {
  // Ports declare the contract surface and a shape-validator each.
  assert.deepEqual(STORAGE_PROVIDER_METHODS, [
    "open", "get", "getAll", "put", "add", "delete", "clear", "putBatch", "deleteBatch",
    "snapshot", "replaceAll"
  ]);
  assert.deepEqual(FILE_STORE_METHODS, ["putBlob", "getBlob", "getUrl", "remove", "list"]);

  assert.equal(isStorageProvider(null), false);
  assert.equal(isStorageProvider({}), false);
  const fullProvider = Object.fromEntries(STORAGE_PROVIDER_METHODS.map((m) => [m, () => {}]));
  assert.equal(isStorageProvider(fullProvider), true);
  delete fullProvider.put;
  assert.equal(isStorageProvider(fullProvider), false);

  assert.equal(isFileStore(null), false);
  assert.equal(isFileStore({}), false);
  const fullFileStore = Object.fromEntries(FILE_STORE_METHODS.map((m) => [m, () => {}]));
  assert.equal(isFileStore(fullFileStore), true);
});

run("local storage adapter + registry", () => {
  // The IndexedDB adapter satisfies the StorageProvider port.
  assert.equal(isStorageProvider(localStorageProvider), true);
  // Registry default is the local adapter (offline SPA behavior).
  assert.equal(getStorageProvider(), localStorageProvider);

  // Registering a valid provider swaps the active one; invalid is rejected.
  const stub = Object.fromEntries(STORAGE_PROVIDER_METHODS.map((m) => [m, () => {}]));
  assert.equal(registerStorageProvider(stub), stub);
  assert.equal(getStorageProvider(), stub);
  assert.throws(() => registerStorageProvider({}), /StorageProvider port/);
  // Restore the default so later tests/imports see expected behavior.
  registerStorageProvider(localStorageProvider);
  assert.equal(getStorageProvider(), localStorageProvider);
});

run("local file store adapter + registry", () => {
  assert.equal(isFileStore(localFileStore), true);
  assert.equal(getFileStore(), localFileStore);
  const stub = Object.fromEntries(FILE_STORE_METHODS.map((m) => [m, () => {}]));
  assert.equal(registerFileStore(stub), stub);
  assert.equal(getFileStore(), stub);
  assert.throws(() => registerFileStore({}), /FileStore port/);
  registerFileStore(localFileStore);
  assert.equal(getFileStore(), localFileStore);
});

run("auth/sync/ai ports", () => {
  assert.deepEqual(AUTH_PROVIDER_METHODS, ["hashSecret", "verifySecret", "validateStrength", "isLegacyHash"]);
  assert.deepEqual(SESSION_PROVIDER_METHODS, ["signIn", "signOut", "getCurrentUser", "getToken", "onChange"]);
  assert.deepEqual(SYNC_PROVIDER_METHODS, [
    "stampMetadata", "planIncoming", "mergeIntoLocal", "detectConflicts", "buildFieldDiff",
    "summarizeConflictPlan", "filterDelta", "buildSyncFloor", "subscribe", "pushChange", "pullSince"
  ]);
  assert.deepEqual(AI_PROVIDER_METHODS, [
    "isAvailable", "transcribe", "summarize", "suggestTags", "proofread",
    "autocompleteFields", "chat", "rankSearch"
  ]);

  for (const [methods, isPort] of [
    [AUTH_PROVIDER_METHODS, isAuthProvider],
    [SESSION_PROVIDER_METHODS, isSessionProvider],
    [SYNC_PROVIDER_METHODS, isSyncProvider],
    [AI_PROVIDER_METHODS, isAiProvider]
  ]) {
    assert.equal(isPort(null), false);
    assert.equal(isPort({}), false);
    const full = Object.fromEntries(methods.map((m) => [m, () => {}]));
    assert.equal(isPort(full), true);
    delete full[methods[0]];
    assert.equal(isPort(full), false);
  }
});

await runAsync("local session adapter + registry", async () => {
  assert.equal(isSessionProvider(localSessionProvider), true);
  assert.equal(getSessionProvider(), localSessionProvider);
  assert.equal(localSessionProvider.getCurrentUser(), null);
  assert.equal(localSessionProvider.getToken(), "");
  assert.equal(typeof localSessionProvider.onChange(() => {}), "function");
  assert.equal(await localSessionProvider.signOut(), true);
  await assert.rejects(() => localSessionProvider.signIn({ username: "admin", password: "x" }), /محلية/);

  const stub = Object.fromEntries(SESSION_PROVIDER_METHODS.map((m) => [m, () => {}]));
  assert.equal(registerSessionProvider(stub), stub);
  assert.equal(getSessionProvider(), stub);
  assert.throws(() => registerSessionProvider({}), /SessionProvider port/);
  registerSessionProvider(localSessionProvider);
});

await runAsync("local auth adapter + registry", async () => {
  assert.equal(isAuthProvider(localAuthProvider), true);
  assert.equal(getAuthProvider(), localAuthProvider);

  // Delegates honestly to the existing bcrypt utilities (no behavior change).
  // validateStrength returns an array of error messages (empty = valid).
  assert.equal(localAuthProvider.validateStrength("weak").length > 0, true);
  assert.equal(localAuthProvider.validateStrength("StrongPass123!").length, 0);
  const hash = await localAuthProvider.hashSecret("StrongPass123!");
  assert.equal(typeof hash, "string");
  assert.equal(await localAuthProvider.verifySecret("StrongPass123!", hash), true);
  assert.equal(await localAuthProvider.verifySecret("wrong", hash), false);
  assert.equal(localAuthProvider.isLegacyHash("a".repeat(64)), true);
  assert.equal(localAuthProvider.isLegacyHash(hash), false);

  const stub = Object.fromEntries(AUTH_PROVIDER_METHODS.map((m) => [m, () => {}]));
  assert.equal(registerAuthProvider(stub), stub);
  assert.equal(getAuthProvider(), stub);
  assert.throws(() => registerAuthProvider({}), /AuthProvider port/);
  registerAuthProvider(localAuthProvider);
});

await runAsync("local sync adapter + registry", async () => {
  assert.equal(isSyncProvider(localSyncProvider), true);
  assert.equal(getSyncProvider(), localSyncProvider);

  // Pure engine method delegates to the real implementation.
  const stamped = localSyncProvider.stampMetadata({ id: "x" }, { deviceId: "dev-1" });
  assert.equal(stamped.lastModifiedBy.deviceId, "dev-1");
  assert.equal(stamped.syncVersion, 1);

  // Offline transport is inert by design.
  assert.equal(typeof localSyncProvider.subscribe(() => {}), "function");
  assert.deepEqual(await localSyncProvider.pushChange({}), { pushed: false, reason: "offline" });
  assert.deepEqual(await localSyncProvider.pullSince(null), { items: [], cursor: null });

  const stub = Object.fromEntries(SYNC_PROVIDER_METHODS.map((m) => [m, () => {}]));
  assert.equal(registerSyncProvider(stub), stub);
  assert.equal(getSyncProvider(), stub);
  assert.throws(() => registerSyncProvider({}), /SyncProvider port/);
  registerSyncProvider(localSyncProvider);
});

await runAsync("local ai stub adapter + registry", async () => {
  assert.equal(isAiProvider(localAiStubProvider), true);
  assert.equal(getAiProvider(), localAiStubProvider);
  assert.equal(localAiStubProvider.isAvailable(), false);
  await assert.rejects(() => localAiStubProvider.summarize({ text: "x" }), /غير مُهيّأة/);
  await assert.rejects(() => localAiStubProvider.transcribe({}), /غير مُهيّأة/);

  const stub = Object.fromEntries(AI_PROVIDER_METHODS.map((m) => [m, () => {}]));
  assert.equal(registerAiProvider(stub), stub);
  assert.equal(getAiProvider(), stub);
  assert.throws(() => registerAiProvider({}), /AiProvider port/);
  registerAiProvider(localAiStubProvider);
});

run("core public barrel", () => {
  for (const fn of [
    "getStorageProvider", "registerStorageProvider",
    "getFileStore", "registerFileStore",
    "getAuthProvider", "registerAuthProvider",
    "getSessionProvider", "registerSessionProvider",
    "getSyncProvider", "registerSyncProvider",
    "getAiProvider", "registerAiProvider"
  ]) {
    assert.equal(typeof core[fn], "function", `core barrel missing ${fn}`);
  }
  assert.deepEqual(core.STORAGE_PROVIDER_METHODS, STORAGE_PROVIDER_METHODS);
  assert.equal(core.isStorageProvider, isStorageProvider);
  assert.equal(typeof core.isFileStore, "function");
  assert.equal(typeof core.isAuthProvider, "function");
  assert.equal(typeof core.isSessionProvider, "function");
  assert.equal(typeof core.isSyncProvider, "function");
  assert.equal(typeof core.isAiProvider, "function");
  // The barrel re-exports the SAME live registry (not a copy).
  assert.equal(core.getStorageProvider(), getStorageProvider());
});

run("register local providers seam", () => {
  const result = registerLocalProviders();
  assert.equal(getStorageProvider(), localStorageProvider);
  assert.equal(getFileStore(), localFileStore);
  assert.equal(getAuthProvider(), localAuthProvider);
  assert.equal(getSessionProvider(), localSessionProvider);
  assert.equal(getSyncProvider(), localSyncProvider);
  assert.equal(getAiProvider(), localAiStubProvider);
  assert.equal(result.storage, localStorageProvider);
  assert.equal(result.files, localFileStore);
  assert.equal(result.auth, localAuthProvider);
  assert.equal(result.session, localSessionProvider);
  assert.equal(result.sync, localSyncProvider);
  assert.equal(result.ai, localAiStubProvider);
});

run("registry requires configuration", () => {
  // Pure-DI registry still rejects providers that fail the port shape.
  assert.throws(() => registerStorageProvider({}), /StorageProvider port/);
  assert.throws(() => registerFileStore({}), /FileStore port/);
  assert.throws(() => registerAuthProvider({}), /AuthProvider port/);
  assert.throws(() => registerSessionProvider({}), /SessionProvider port/);
  assert.throws(() => registerSyncProvider({}), /SyncProvider port/);
  assert.throws(() => registerAiProvider({}), /AiProvider port/);
  // Restore valid local wiring for any later code.
  registerLocalProviders();
});

// Backend choice (spB-B3 infrastructure) — pure helpers with an injectable
// storage so we can exercise the full read/write/normalize path without
// touching real localStorage.
import {
  BACKEND_CHOICES,
  DEFAULT_BACKEND,
  DEFAULT_LOCAL_ENGINE,
  getBackendChoice,
  getBackendUrl,
  getLocalEngine,
  setBackendChoice,
  normalizeBackendChoice,
  normalizeLocalEngine,
  resolveBackendChoice,
  shouldForceLocalBackend
} from "../src/bootstrap/backendChoice.js";
import { registerByBackendChoice } from "../src/bootstrap/registerByBackendChoice.js";

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    __dump: () => Object.fromEntries(store)
  };
}

function createMemoryByteStorage(initialBytes = null) {
  let bytes = initialBytes ? new Uint8Array(initialBytes) : null;
  return {
    async read() {
      return bytes ? new Uint8Array(bytes) : null;
    },
    async write(nextBytes) {
      bytes = new Uint8Array(nextBytes);
    },
    dump() {
      return bytes ? new Uint8Array(bytes) : null;
    }
  };
}

run("backend choice — defaults to local when storage is empty or absent", () => {
  assert.equal(DEFAULT_BACKEND, "local");
  assert.equal(DEFAULT_LOCAL_ENGINE, "indexeddb");
  assert.deepEqual([...BACKEND_CHOICES], ["local", "pocketbase", "postgres"]);
  // No storage at all → default.
  assert.equal(getBackendChoice({ storage: null }), "local");
  // Empty storage → default.
  assert.equal(getBackendChoice({ storage: createMemoryStorage() }), "local");
  assert.equal(getLocalEngine({ storage: createMemoryStorage() }), "indexeddb");
  // Unknown stored value → normalized to default.
  const tampered = createMemoryStorage({ "va.backendChoice.v1": JSON.stringify({ backend: "rogue" }) });
  assert.equal(getBackendChoice({ storage: tampered }), "local");
});

run("backend choice — normalize accepts only the known set", () => {
  assert.equal(normalizeBackendChoice("local"), "local");
  assert.equal(normalizeBackendChoice("pocketbase"), "pocketbase");
  assert.equal(normalizeBackendChoice("postgres"), "postgres");
  assert.equal(normalizeBackendChoice("mysql"), "local");
  assert.equal(normalizeBackendChoice(""), "local");
  assert.equal(normalizeBackendChoice(null), "local");
  assert.equal(normalizeBackendChoice(undefined), "local");
  assert.equal(normalizeLocalEngine("indexeddb"), "indexeddb");
  assert.equal(normalizeLocalEngine("sqlite"), "sqlite");
  assert.equal(normalizeLocalEngine("unknown"), "indexeddb");
});

run("backend choice — round-trip set/get with URL pairing", () => {
  const storage = createMemoryStorage();
  assert.equal(setBackendChoice("pocketbase", "https://pb.example.com", { storage, localEngine: "sqlite" }), true);
  assert.equal(getBackendChoice({ storage }), "pocketbase");
  assert.equal(getBackendUrl({ storage }), "https://pb.example.com");
  assert.equal(getLocalEngine({ storage }), "sqlite");

  // Switching to local clears the URL — those two backends don't need one.
  assert.equal(setBackendChoice("local", "ignored-url", { storage }), true);
  assert.equal(getBackendChoice({ storage }), "local");
  assert.equal(getBackendUrl({ storage }), "");
  assert.equal(getLocalEngine({ storage }), "indexeddb");

  // Postgres remembers its URL independently.
  assert.equal(setBackendChoice("postgres", "https://db.example.com/api", { storage }), true);
  assert.equal(getBackendChoice({ storage }), "postgres");
  assert.equal(getBackendUrl({ storage }), "https://db.example.com/api");
});

run("backend choice — corrupted JSON in storage falls back to default", () => {
  const storage = createMemoryStorage({ "va.backendChoice.v1": "{not json" });
  assert.equal(getBackendChoice({ storage }), "local");
  assert.equal(getBackendUrl({ storage }), "");
});

run("backend choice — resolve honors AI Studio force-local flag", () => {
  const storage = createMemoryStorage();
  setBackendChoice("pocketbase", "https://pb.example.com", { storage });

  // Normal mode: persisted choice wins.
  assert.equal(shouldForceLocalBackend(), false);
  const normal = resolveBackendChoice({ storage });
  assert.equal(normal.backend, "pocketbase");
  assert.equal(normal.url, "https://pb.example.com");
  assert.equal(normal.localEngine, "indexeddb");
  assert.equal(normal.forced, false);

  // AI Studio bundle sets __VITE_AISTUDIO__ via vite define; we simulate it
  // on globalThis and confirm resolve forces local regardless of the saved
  // pocketbase choice.
  globalThis.__VITE_AISTUDIO__ = true;
  try {
    assert.equal(shouldForceLocalBackend(), true);
    const forced = resolveBackendChoice({ storage });
    assert.equal(forced.backend, "local");
    assert.equal(forced.url, "");
    assert.equal(forced.localEngine, "indexeddb");
    assert.equal(forced.forced, true);
  } finally {
    delete globalThis.__VITE_AISTUDIO__;
  }
});

run("backend choice — cloud mode registers cloud session, files, and sync providers", () => {
  const storage = createMemoryStorage();
  setBackendChoice("postgres", "https://srv.example.com", { storage });
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  try {
    globalThis.localStorage = storage;
    globalThis.window = { localStorage: storage };
    const result = registerByBackendChoice();
    assert.equal(result.backend, "postgres");
    assert.equal(result.session.getToken(), "");
    assert.notEqual(getFileStore(), localFileStore);
    assert.notEqual(getSyncProvider(), localSyncProvider);
    assert.equal(getSessionProvider(), result.session);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    registerLocalProviders();
  }
});

run("local providers — sqlite local engine falls back safely without OPFS", () => {
  const result = registerLocalProviders({ localEngine: "sqlite" });
  assert.equal(result.localEngine, "indexeddb");
  assert.equal(result.storage, localStorageProvider);
  assert.equal(isStorageProvider(result.storage), true);
  assert.match(result.warning, /SQLite/);
  registerLocalProviders();
});

await runAsync("local sqlite provider — CRUD, snapshot, replaceAll, and sqlite file round-trip", async () => {
  const storage = createMemoryByteStorage();
  const provider = createLocalSqliteProvider({ storage });
  assert.equal(isStorageProvider(provider), true);
  assert.equal(provider.engine, "sqlite");

  await provider.open();
  await provider.put(STORES.SETTINGS, { key: "app_settings", ui: { themeVersion: "v4" } });
  await provider.put(STORES.ITEMS, { id: "v1", title: "لقطة افتتاحية", type: "clip" });
  assert.equal((await provider.get(STORES.ITEMS, "v1")).title, "لقطة افتتاحية");

  await assert.rejects(
    () => provider.add(STORES.ITEMS, { id: "v1", title: "مكرر" }),
    (error) => error?.name === "ConstraintError"
  );
  await provider.add(STORES.ITEMS, { id: "v2", title: "لقطة ثانية", type: "clip" });
  await provider.putBatch(STORES.BOOKMARKS, [
    { id: "b1", itemId: "v1" },
    { id: "b2", itemId: "v2" }
  ]);
  await provider.deleteBatch(STORES.BOOKMARKS, ["b1"]);
  assert.deepEqual((await provider.getAll(STORES.BOOKMARKS)).map((item) => item.id), ["b2"]);

  await provider.delete(STORES.ITEMS, "v2");
  assert.equal(await provider.get(STORES.ITEMS, "v2"), undefined);
  const snapshot = await provider.snapshot();
  assert.deepEqual(snapshot.videoItems.map((item) => item.id), ["v1"]);
  assert.equal(snapshot.settings.ui.themeVersion, "v4");

  const counts = await provider.replaceAll({
    contentTypes: [{ id: "clip", name: "لقطات" }],
    videoItems: [{ id: "v3", title: "مستوردة", type: "clip" }],
    bookmarks: [],
    settings: { ui: { themeVersion: "v4" } },
    users: [{ id: "u1", username: "admin" }],
    projects: [{ id: "p1", name: "مشروع" }]
  });
  assert.equal(counts.contentTypes, 1);
  assert.equal(counts.videoItems, 1);
  assert.equal((await provider.get(STORES.ITEMS, "v1")), undefined);
  assert.equal((await provider.get(STORES.ITEMS, "v3")).title, "مستوردة");

  const exported = await provider.exportSqliteFile();
  assert.ok(exported.byteLength > 100, "exported SQLite file should contain schema and records");

  const reopened = createLocalSqliteProvider({ storage: createMemoryByteStorage(exported) });
  assert.equal((await reopened.get(STORES.ITEMS, "v3")).title, "مستوردة");

  const imported = createLocalSqliteProvider({ storage: createMemoryByteStorage() });
  const importResult = await imported.importSqliteFile(exported);
  assert.equal(importResult.imported, true);
  assert.equal((await imported.get(STORES.PROJECTS, "p1")).name, "مشروع");
});

// Cloud-http adapter (spB7) — the SPA's StorageProvider over the RPC API.
// Tested with an injected fetch fake so it stays offline + deterministic.
// (isStorageProvider is already imported at the top of this file.)
import { createCloudHttpProvider, CloudHttpError, resilientRpc } from "../src/storage/adapters/cloud-http/index.js";

function createFetchFake() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, method: body.method, args: body.args });
    // Echo a deterministic result keyed by method so tests can assert wiring.
    const resultByMethod = {
      get: { id: body.args[1], echoed: true },
      getAll: [{ id: "a" }, { id: "b" }],
      put: body.args[1],
      add: body.args[1],
      snapshot: { videoItems: [{ id: "x" }], version: "2.0" },
      replaceAll: { videoItems: 1 }
    };
    const result = body.method in resultByMethod ? resultByMethod[body.method] : null;
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result })
    };
  };
  return { fetchImpl, calls };
}

run("cloud-http adapter satisfies the StorageProvider port", () => {
  const { fetchImpl } = createFetchFake();
  const provider = createCloudHttpProvider({ baseUrl: "https://srv.example.com", fetchImpl });
  assert.equal(isStorageProvider(provider), true);
});

await runAsync("cloud-http forwards method+args to /api/rpc and returns result", async () => {
  const { fetchImpl, calls } = createFetchFake();
  const provider = createCloudHttpProvider({ baseUrl: "https://srv.example.com/", fetchImpl });

  const got = await provider.get("video_items", "v1");
  assert.deepEqual(got, { id: "v1", echoed: true });
  // trailing slash on baseUrl is normalized to a single /api/rpc.
  assert.equal(calls[0].url, "https://srv.example.com/api/rpc");
  assert.equal(calls[0].method, "get");
  assert.deepEqual(calls[0].args, ["video_items", "v1"]);

  const all = await provider.getAll("video_items");
  assert.deepEqual(all.map((r) => r.id), ["a", "b"]);

  const snap = await provider.snapshot();
  assert.equal(snap.version, "2.0");
});

await runAsync("cloud-http surfaces server-side ok:false as CloudHttpError", async () => {
  const provider = createCloudHttpProvider({
    baseUrl: "",
    fetchImpl: async () => ({ ok: 400, status: 400, json: async () => ({ ok: false, error: "boom" }) })
  });
  await assert.rejects(() => provider.put("video_items", { id: "x" }), (err) => {
    assert.ok(err instanceof CloudHttpError);
    assert.equal(err.method, "put");
    assert.match(err.message, /boom/);
    return true;
  });
});

await runAsync("cloud-http wraps network failures with the method name", async () => {
  const provider = createCloudHttpProvider({
    baseUrl: "",
    fetchImpl: async () => { throw new Error("ECONNREFUSED"); }
  });
  await assert.rejects(() => provider.getAll("video_items"), (err) => {
    assert.ok(err instanceof CloudHttpError);
    assert.equal(err.method, "getAll");
    assert.match(err.message, /ECONNREFUSED|تعذّر الاتصال/);
    return true;
  });
});

// Cloud session + token-aware cloud-http (spB9 SPA auth).
import {
  getCloudToken, setCloudToken, clearCloudToken, loginToCloud, CloudLoginError, createCloudSessionProvider
} from "../src/bootstrap/cloudSession.js";
import { createCloudFileStore } from "../src/storage/adapters/cloud-files/index.js";
import { createCloudSyncProvider } from "../src/storage/adapters/cloud-sync/index.js";
import { createCloudAiProvider, CloudAiError } from "../src/storage/adapters/cloud-ai/index.js";

function memStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
}

run("cloud session — set/get/clear token", () => {
  const storage = memStorage();
  assert.equal(getCloudToken({ storage }), "");
  setCloudToken("jwt-123", { storage });
  assert.equal(getCloudToken({ storage }), "jwt-123");
  clearCloudToken({ storage });
  assert.equal(getCloudToken({ storage }), "");
});

await runAsync("loginToCloud posts credentials and stores the token", async () => {
  const storage = memStorage();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ ok: true, token: "jwt-xyz", user: { username: "admin", role: "admin" } }) };
  };
  const { token, user } = await loginToCloud({ baseUrl: "https://srv.example.com/", username: "admin", password: "p", fetchImpl, storage });
  assert.equal(token, "jwt-xyz");
  assert.equal(user.role, "admin");
  assert.equal(calls[0].url, "https://srv.example.com/api/auth/login");
  assert.deepEqual(calls[0].body, { username: "admin", password: "p" });
  assert.equal(getCloudToken({ storage }), "jwt-xyz");
});

await runAsync("cloud session provider stores token and current user", async () => {
  const storage = memStorage();
  const events = [];
  const fetchImpl = async (url, init) => {
    assert.equal(url, "https://srv.example.com/api/auth/login");
    assert.deepEqual(JSON.parse(init.body), { username: "admin", password: "p" });
    return { ok: true, status: 200, json: async () => ({ ok: true, token: "jwt-session", user: { id: "u1", username: "admin", role: "admin" } }) };
  };
  const session = createCloudSessionProvider({ baseUrl: "https://srv.example.com/", fetchImpl, storage });
  const unsubscribe = session.onChange((state) => events.push(state));
  const result = await session.signIn({ username: "admin", password: "p" });
  assert.equal(result.token, "jwt-session");
  assert.equal(session.getToken(), "jwt-session");
  assert.equal(session.getCurrentUser().username, "admin");
  assert.equal(events.at(-1).user.username, "admin");
  assert.equal(await session.signOut(), true);
  assert.equal(session.getToken(), "");
  assert.equal(session.getCurrentUser(), null);
  unsubscribe();
});

await runAsync("cloud file store sends bearer requests for blobs", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", auth: init.headers?.Authorization || "" });
    if ((init.method || "GET") === "GET" && url.includes("/api/files/url?")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, result: "https://tmp.example.com/folder/a.txt" }) };
    }
    if ((init.method || "GET") === "GET" && url.includes("/api/files?")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, result: ["folder/a.txt"] }) };
    }
    if ((init.method || "GET") === "GET") {
      return { ok: true, status: 200, blob: async () => new Blob(["downloaded"]) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { key: "folder/a.txt", url: "/api/files/folder%2Fa.txt" } }) };
  };
  const files = createCloudFileStore({ baseUrl: "https://srv.example.com/", fetchImpl, getToken: () => "tok-1" });
  const put = await files.putBlob("folder/a.txt", new Blob(["uploaded"], { type: "text/plain" }));
  assert.equal(put.key, "folder/a.txt");
  assert.deepEqual(await files.list("folder/"), ["folder/a.txt"]);
  assert.equal(await files.getUrl("folder/a.txt"), "https://tmp.example.com/folder/a.txt");
  assert.equal(await (await files.getBlob("folder/a.txt")).text(), "downloaded");
  await files.remove("folder/a.txt");
  assert.deepEqual(calls.map((call) => [call.method, call.auth]), [
    ["PUT", "Bearer tok-1"],
    ["GET", "Bearer tok-1"],
    ["GET", "Bearer tok-1"],
    ["GET", "Bearer tok-1"],
    ["DELETE", "Bearer tok-1"]
  ]);
  assert.equal(calls[2].url, "https://srv.example.com/api/files/url?key=folder%2Fa.txt");
});

await runAsync("cloud-http resilientRpc retries retryable network errors only", async () => {
  let attempts = 0;
  const result = await resilientRpc(async () => {
    attempts += 1;
    if (attempts < 3) throw new CloudHttpError("network", { retryable: true });
    return "ok";
  }, { wait: async () => {}, retries: 2, method: "getAll" });
  assert.equal(result, "ok");
  assert.equal(attempts, 3);

  let nonRetryAttempts = 0;
  await assert.rejects(() => resilientRpc(async () => {
    nonRetryAttempts += 1;
    throw new CloudHttpError("unauthorized", { status: 401, retryable: false });
  }, { wait: async () => {}, retries: 2, method: "getAll" }), (err) => err instanceof CloudHttpError && err.status === 401);
  assert.equal(nonRetryAttempts, 1);
});

await runAsync("cloud sync provider pushes and pulls over bearer HTTP", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET", auth: init.headers?.Authorization || "", body: init.body ? JSON.parse(init.body) : null });
    if (url.includes("/api/sync/pull")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { items: [{ id: "v1", syncVersion: 2 }], cursor: 2 } }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { pushed: true, cursor: 2 } }) };
  };
  const sync = createCloudSyncProvider({ baseUrl: "https://srv.example.com/", fetchImpl, getToken: () => "tok-2" });
  assert.deepEqual(await sync.pushChange({ store: "video_items", record: { id: "v1", syncVersion: 2 } }), { pushed: true, cursor: 2 });
  assert.deepEqual(await sync.pullSince(1), { items: [{ id: "v1", syncVersion: 2 }], cursor: 2 });
  assert.equal(calls[0].url, "https://srv.example.com/api/sync/push");
  assert.equal(calls[1].url, "https://srv.example.com/api/sync/pull?cursor=1");
  assert.deepEqual(calls.map((call) => call.auth), ["Bearer tok-2", "Bearer tok-2"]);
});

run("cloud-sync subscribe opens SSE with token + delivers change events", () => {
  // Fake EventSource capturing the URL and letting the test emit messages.
  const instances = [];
  class FakeEventSource {
    constructor(url) { this.url = url; this.onmessage = null; this.closed = false; instances.push(this); }
    close() { this.closed = true; }
    emit(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
  }
  const sync = createCloudSyncProvider({
    baseUrl: "https://srv.example.com/",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: {} }) }),
    getToken: () => "tok-9",
    EventSourceImpl: FakeEventSource
  });

  const received = [];
  const unsubscribe = sync.subscribe((change) => received.push(change));
  assert.equal(instances.length, 1);
  assert.equal(instances[0].url, "https://srv.example.com/api/sync/events?token=tok-9");

  instances[0].emit({ type: "change", change: { id: "v1", title: "حيّ" } });
  instances[0].emit({ type: "ping" }); // non-change frames ignored
  instances[0].emit({ type: "change", change: { id: "v2" } });
  assert.deepEqual(received, [{ id: "v1", title: "حيّ" }, { id: "v2" }]);

  unsubscribe();
  assert.equal(instances[0].closed, true);
});

run("cloud-sync subscribe is inert when EventSource is unavailable", () => {
  const sync = createCloudSyncProvider({
    baseUrl: "",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: {} }) }),
    getToken: () => "",
    EventSourceImpl: null
  });
  const off = sync.subscribe(() => { throw new Error("should not be called"); });
  assert.equal(typeof off, "function");
  off(); // no throw
});

run("cloud-ai satisfies AiProvider port + isAvailable true", () => {
  const ai = createCloudAiProvider({ baseUrl: "https://srv.example.com", getToken: () => "t", fetchImpl: async () => ({}) });
  assert.equal(isAiProvider(ai), true);
  assert.equal(ai.isAvailable(), true);
});

await runAsync("cloud-ai proxies generative calls to /api/ai/rpc with Bearer", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { summary: "موجز", tags: ["t"] } }) };
  };
  const ai = createCloudAiProvider({ baseUrl: "https://srv.example.com/", getToken: () => "tok-ai", fetchImpl });
  const out = await ai.summarize({ text: "نص" });
  assert.deepEqual(out, { summary: "موجز", tags: ["t"] });
  assert.equal(calls[0].url, "https://srv.example.com/api/ai/rpc");
  assert.equal(calls[0].auth, "Bearer tok-ai");
  assert.equal(calls[0].body.method, "summarize");
  assert.deepEqual(calls[0].body.args, [{ text: "نص" }]);
});

await runAsync("cloud-ai maps 503 to a clear 'not configured' message", async () => {
  const ai = createCloudAiProvider({
    baseUrl: "", getToken: () => "t",
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ ok: false, error: "AI is not configured on this server." }) })
  });
  await assert.rejects(() => ai.chat({ context: "c", query: "q" }), (err) => {
    assert.ok(err instanceof CloudAiError);
    assert.equal(err.status, 503);
    assert.match(err.message, /غير مُفعّلة|غير مُهيّأ|الخادم/);
    return true;
  });
});

await runAsync("cloud-ai transcribe uploads raw audio to /api/ai/transcribe", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ctype: init.headers["Content-Type"], fname: init.headers["X-Filename"], auth: init.headers.Authorization, body: init.body });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { transcription: "نصّ مفرّغ", segments: [] } }) };
  };
  const ai = createCloudAiProvider({ baseUrl: "https://srv.example.com/", getToken: () => "tok-t", fetchImpl });
  const blob = { type: "audio/mpeg" }; // stand-in blob; adapter forwards it as body
  const out = await ai.transcribe({ blob, mimeType: "audio/mpeg", name: "clip.mp3" });
  assert.equal(out.transcription, "نصّ مفرّغ");
  assert.equal(calls[0].url, "https://srv.example.com/api/ai/transcribe");
  assert.equal(calls[0].ctype, "audio/mpeg");
  assert.equal(calls[0].fname, "clip.mp3");
  assert.equal(calls[0].auth, "Bearer tok-t");
  assert.equal(calls[0].body, blob); // raw blob sent as body (not JSON)
});

await runAsync("cloud-ai transcribe: no blob rejects; 503 → clear message", async () => {
  const ai = createCloudAiProvider({ baseUrl: "", getToken: () => "t", fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ ok: false }) }) });
  await assert.rejects(() => ai.transcribe({}), (err) => { assert.ok(err instanceof CloudAiError); return true; });
  await assert.rejects(() => ai.transcribe({ blob: { type: "audio/wav" } }), (err) => {
    assert.equal(err.status, 503); assert.match(err.message, /Whisper|غير مُفعّل/); return true;
  });
});

await runAsync("auth store routes cloud backend login through loginToCloud", async () => {
  const storage = memStorage();
  setBackendChoice("postgres", "https://srv.example.com/", { storage });

  const previousFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const calls = [];
  const appState = { users: [], currentUser: null, isLocked: true };
  const useAppStore = {
    getState: () => appState,
    setState: (patch) => Object.assign(appState, patch)
  };

  try {
    globalThis.localStorage = storage;
    globalThis.window = { localStorage: storage };
    globalThis.fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          token: "jwt-cloud",
          user: { id: "cloud-admin", username: "admin", role: "admin" }
        })
      };
    };

    registerByBackendChoice();
    const { createStore } = await import("../src/stores/storeCore.js");
    const { createAuthStore } = await import("../src/stores/slices/authSlice.js");
    const useAuthStore = createAuthStore({ createStore, useAppStore });

    assert.equal(await useAuthStore.getState().login("admin", "cloud-pass", true), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://srv.example.com/api/auth/login");
    assert.deepEqual(calls[0].body, { username: "admin", password: "cloud-pass" });
    assert.equal(getCloudToken({ storage }), "jwt-cloud");
    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(useAuthStore.getState().currentUser?.username, "admin");
    assert.equal(appState.currentUser?.id, "cloud-admin");
    assert.equal(appState.isLocked, false);
  } finally {
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    registerLocalProviders();
  }
});

await runAsync("loginToCloud surfaces bad credentials as CloudLoginError", async () => {
  const storage = memStorage();
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ ok: false, error: "بيانات الدخول غير صحيحة." }) });
  await assert.rejects(
    () => loginToCloud({ baseUrl: "", username: "admin", password: "bad", fetchImpl, storage }),
    (err) => { assert.ok(err instanceof CloudLoginError); assert.equal(err.status, 401); return true; }
  );
  assert.equal(getCloudToken({ storage }), "");
});

await runAsync("cloud-http sends Bearer token and clears it on 401", async () => {
  let currentToken = "tok-1";
  let cleared = false;
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push(init.headers.Authorization || null);
    if (currentToken === "expired") {
      return { ok: false, status: 401, json: async () => ({ ok: false, error: "Token expired." }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, result: [] }) };
  };
  const provider = createCloudHttpProvider({
    baseUrl: "",
    fetchImpl,
    getToken: () => currentToken,
    onUnauthorized: () => { cleared = true; }
  });

  await provider.getAll("video_items");
  assert.equal(seen[0], "Bearer tok-1");

  currentToken = "expired";
  await assert.rejects(() => provider.getAll("video_items"));
  assert.equal(cleared, true);
});

// G7 — timestamp linking parser (DetailPage notes/transcripts).
import {
  parseTimestampSegments, timecodeToSeconds, hasTimestamps
} from "../src/features/archive/timestampLinks.js";

run("timestamp parser — timecodeToSeconds handles MM:SS and HH:MM:SS", () => {
  assert.equal(timecodeToSeconds("12", "45"), 12 * 60 + 45);
  assert.equal(timecodeToSeconds("01", "02", "03"), 3723);
  assert.equal(timecodeToSeconds("90", "00"), 5400); // minutes may exceed 59 in MM:SS
  assert.equal(timecodeToSeconds("1", "75"), null);   // SS out of range
  assert.equal(timecodeToSeconds("1", "10", "75"), null); // SS out of range in HMS
});

run("timestamp parser — splits text into text + time segments", () => {
  const segs = parseTimestampSegments("شاهد عند 12:45 ثم [01:02:03] النهاية");
  const times = segs.filter((s) => s.type === "time");
  assert.equal(times.length, 2);
  assert.equal(times[0].seconds, 765);
  assert.equal(times[0].value, "12:45");
  assert.equal(times[1].seconds, 3723);
  assert.equal(times[1].value, "01:02:03"); // brackets stripped from the label
});

run("timestamp parser — plain text + hasTimestamps + out-of-range", () => {
  assert.deepEqual(parseTimestampSegments("لا توجد طوابع هنا"), [{ type: "text", value: "لا توجد طوابع هنا" }]);
  assert.equal(hasTimestamps("لا توجد طوابع هنا"), false);
  assert.equal(hasTimestamps("ابدأ من 00:30"), true);
  assert.deepEqual(parseTimestampSegments(""), []);
  assert.equal(hasTimestamps("الإصدار 12:99 غير صالح"), false); // SS>59 → plain text
});

// G5 — projects / montage view-model (data + NLE export, pure).
import {
  createProjectValue, createRoughCutValue, isValidRoughCut, roughCutDuration,
  addRoughCut, removeRoughCut, reorderRoughCut, getOrderedRoughCuts,
  getProjectDuration, buildProjectTimeline, secondsToTimecode, buildEdl,
  getFilteredProjects, getProjectSummary, PROJECT_TASK_STATUSES,
  createProjectTaskValue, addProjectTask, moveProjectTask, removeProjectTask,
  getProjectTasksByStatus
} from "../src/features/projects/viewModel.js";
import {
  CloudExportError, canExportMp4, safeFileName, triggerDownload,
  downloadTimelineJson, downloadEdl, requestMp4Export
} from "../src/features/projects/exportClient.js";

run("projects — rough cut value + validity + duration", () => {
  const cut = createRoughCutValue({ itemId: "v1", inSec: 10, outSec: 25, label: "مشهد" });
  assert.equal(cut.itemId, "v1");
  assert.equal(roughCutDuration(cut), 15);
  assert.equal(isValidRoughCut(cut), true);
  assert.equal(isValidRoughCut(createRoughCutValue({ itemId: "v1", inSec: 5, outSec: 5 })), false); // zero-length
  assert.equal(isValidRoughCut(createRoughCutValue({ inSec: 0, outSec: 5 })), false); // no item
});

run("projects — add/remove/reorder rough cuts keeps order + itemIds", () => {
  let p = createProjectValue({ name: "مونتاج" });
  p = addRoughCut(p, { itemId: "v1", inSec: 0, outSec: 10 });
  p = addRoughCut(p, { itemId: "v2", inSec: 5, outSec: 20 });
  p = addRoughCut(p, { itemId: "v1", inSec: 30, outSec: 40 });
  assert.deepEqual(p.roughCuts.map((c) => c.order), [0, 1, 2]);
  assert.deepEqual(p.itemIds, ["v1", "v2"]); // v1 not duplicated
  assert.equal(getProjectDuration(p), 10 + 15 + 10);

  // move the 3rd cut to the front
  const id3 = p.roughCuts[2].id;
  p = reorderRoughCut(p, id3, 0);
  assert.deepEqual(getOrderedRoughCuts(p).map((c) => c.id)[0], id3);
  assert.deepEqual(getOrderedRoughCuts(p).map((c) => c.order), [0, 1, 2]);

  p = removeRoughCut(p, id3);
  assert.equal(p.roughCuts.length, 2);
  assert.deepEqual(p.roughCuts.map((c) => c.order), [0, 1]); // re-indexed
});

run("projects — kanban tasks create, group, move, and remove", () => {
  assert.deepEqual(PROJECT_TASK_STATUSES, ["todo", "doing", "review", "done"]);
  let p = createProjectValue({ name: "إنتاج" });
  p = addProjectTask(p, { title: "مراجعة اللقطة", itemId: "v1", assigneeId: "u1" });
  p = addProjectTask(p, { title: "تصحيح الصوت", status: "doing" });
  assert.equal(p.tasks.length, 2);
  assert.equal(p.tasks[0].status, "todo");
  assert.equal(p.tasks[0].itemId, "v1");
  assert.equal(createProjectTaskValue({ title: "x", status: "bad" }).status, "todo");
  assert.deepEqual(getProjectTasksByStatus(p).todo.map((task) => task.title), ["مراجعة اللقطة"]);
  assert.deepEqual(getProjectTasksByStatus(p).doing.map((task) => task.title), ["تصحيح الصوت"]);

  p = moveProjectTask(p, p.tasks[0].id, "review");
  assert.deepEqual(getProjectTasksByStatus(p).review.map((task) => task.title), ["مراجعة اللقطة"]);
  p = removeProjectTask(p, p.tasks[0].id);
  assert.equal(p.tasks.length, 1);
});

run("projects — timeline export sequences clips with source + position", () => {
  let p = createProjectValue({ name: "T" });
  p = addRoughCut(p, { itemId: "v1", inSec: 0, outSec: 10, label: "أ" });
  p = addRoughCut(p, { itemId: "v2", inSec: 100, outSec: 130 });
  const items = new Map([["v1", { title: "مادة1", path: "C:/a.mp4" }], ["v2", { title: "مادة2", path: "C:/b.mp4" }]]);
  const tl = buildProjectTimeline(p, items);
  assert.equal(tl.totalDuration, 40);
  assert.deepEqual(tl.clips.map((c) => c.timelineStart), [0, 10]);
  assert.equal(tl.clips[0].title, "أ");           // rough-cut label wins
  assert.equal(tl.clips[1].title, "مادة2");        // falls back to item title
  assert.equal(tl.clips[0].source, "C:/a.mp4");
  assert.equal(tl.clips[1].sourceIn, 100);
});

run("projects — secondsToTimecode + EDL export (CMX3600)", () => {
  assert.equal(secondsToTimecode(0, 25), "00:00:00:00");
  assert.equal(secondsToTimecode(3661.5, 25), "01:01:01:13"); // 0.5s @25fps = 12.5 → rounds to 13
  assert.equal(secondsToTimecode(2, 25), "00:00:02:00");
  let p = createProjectValue({ name: "Cut" });
  p = addRoughCut(p, { itemId: "vid-1", inSec: 2, outSec: 5 });
  const edl = buildEdl(p, new Map([["vid-1", { title: "لقطة" }]]), { fps: 25 });
  assert.match(edl, /^TITLE: Cut/);
  assert.match(edl, /001\s+VID1\s+V\s+C/);          // clip line with reel
  assert.match(edl, /FROM CLIP NAME: لقطة/);
  assert.match(edl, /00:00:00:00 00:00:03:00/);     // record in/out (3s clip)
});

run("projects — filter + summary", () => {
  const a = createProjectValue({ name: "خبر عاجل" });
  const b = { ...createProjectValue({ name: "أرشيف قديم" }), status: "archived" };
  let c = createProjectValue({ name: "وثائقي" });
  c = addRoughCut(c, { itemId: "v1", inSec: 0, outSec: 12 });
  assert.deepEqual(getFilteredProjects([a, b, c], "عاجل").map((p) => p.name), ["خبر عاجل"]);
  assert.equal(getFilteredProjects([a, b, c]).length, 2);            // archived hidden
  assert.equal(getFilteredProjects([a, b, c], "", { includeArchived: true }).length, 3);
  const s = getProjectSummary([a, b, c]);
  assert.equal(s.total, 2);
  assert.equal(s.archived, 1);
  assert.equal(s.totalRoughCuts, 1);
  assert.equal(s.totalSeconds, 12);
});

// G5 — project export client (downloads + server MP4 render), with injected
// DOM / fetch / Blob so it runs headless in node.
function fakeDownloadDeps() {
  const downloads = [];
  let revoked = 0;
  const link = {};
  const doc = {
    createElement: () => link,
    body: { appendChild: () => {}, removeChild: () => {} }
  };
  link.click = () => downloads.push({ href: link.href, name: link.download });
  const urlApi = {
    createObjectURL: () => "blob:fake",
    revokeObjectURL: () => { revoked += 1; }
  };
  return { deps: { doc, urlApi, BlobImpl: Blob }, downloads, revokedRef: () => revoked };
}

run("export client — safeFileName + canExportMp4 gate", () => {
  assert.equal(safeFileName("مشروع: لقطة/١"), "مشروع_لقطة_١");
  assert.equal(safeFileName("   "), "export");
  assert.equal(canExportMp4({ backend: "local", token: "t" }), false);   // local never
  assert.equal(canExportMp4({ backend: "postgres", token: "" }), false);  // needs token
  assert.equal(canExportMp4({ backend: "postgres", token: "t" }), true);
});

run("export client — JSON + EDL trigger a named download", () => {
  const a = fakeDownloadDeps();
  assert.equal(downloadTimelineJson({ clips: [{ id: "c1" }] }, "وثائقي", a.deps), true);
  assert.equal(a.downloads[0].name, "وثائقي.timeline.json");

  const b = fakeDownloadDeps();
  assert.equal(downloadEdl("TITLE: X", "وثائقي", b.deps), true);
  assert.equal(b.downloads[0].name, "وثائقي.edl");
});

run("export client — triggerDownload no-ops without a DOM", () => {
  assert.equal(triggerDownload(new Blob(["x"]), "f.mp4", { doc: null, urlApi: null }), false);
});

await runAsync("export client — requestMp4Export streams a blob, guards token/empty/errors", async () => {
  const timeline = { project: { name: "P" }, clips: [{ id: "c1", source: "a.mp4", sourceIn: 0, sourceOut: 5, duration: 5 }] };

  // success
  let sent = null;
  const okFetch = async (url, opts) => {
    sent = { url, opts };
    return { ok: true, status: 200, blob: async () => new Blob(["MP4DATA"], { type: "video/mp4" }) };
  };
  const blob = await requestMp4Export({ timeline, baseUrl: "https://srv", getToken: () => "tok", fetchImpl: okFetch });
  assert.equal(sent.url, "https://srv/api/projects/export");
  assert.equal(sent.opts.headers.Authorization, "Bearer tok");
  assert.equal(JSON.parse(sent.opts.body).timeline.clips.length, 1);
  assert.equal(blob.type, "video/mp4");

  // no token → CloudExportError, no fetch
  await assert.rejects(
    () => requestMp4Export({ timeline, getToken: () => "", fetchImpl: okFetch }),
    (e) => e instanceof CloudExportError
  );

  // empty timeline → CloudExportError
  await assert.rejects(
    () => requestMp4Export({ timeline: { clips: [] }, getToken: () => "tok", fetchImpl: okFetch }),
    (e) => e instanceof CloudExportError
  );

  // server error → surfaces the server message
  const errFetch = async () => ({ ok: false, status: 500, json: async () => ({ ok: false, error: "فشل الترميز" }) });
  await assert.rejects(
    () => requestMp4Export({ timeline, getToken: () => "tok", fetchImpl: errFetch }),
    (e) => e instanceof CloudExportError && /فشل الترميز/.test(e.message)
  );
});

// AI assist — pure helpers that fold AiProvider results into form state.
import {
  mergeTagText, contentTypesToCategories, applyProofread, correctionsCount,
  applySummaryToNotes, buildSuggestPayload, createAiWorkbenchActions, hasSourceText
} from "../src/features/ai/viewModel.js";

run("ai assist — mergeTagText dedups case-insensitively, preserves order", () => {
  assert.equal(mergeTagText("أخبار، رياضة", ["سياسة", "رياضة"]), "أخبار، رياضة، سياسة");
  assert.equal(mergeTagText("", ["a", "A", "b"]), "a، b");          // case-insensitive dedup of new
  assert.equal(mergeTagText("x", []), "x");                          // nothing added
  assert.equal(mergeTagText("", []), "");                            // empty
  assert.equal(mergeTagText("tag1", [" tag1 ", "tag2"]), "tag1، tag2"); // trims
});

run("ai assist — contentTypesToCategories filters archived + maps id/name", () => {
  const cats = contentTypesToCategories([
    { id: "t1", name: "مقابلة" },
    { id: "t2", label: "تقرير" },
    { id: "t3", name: "قديم", status: "archived" },
    { name: "no-id" }
  ]);
  assert.deepEqual(cats, [{ id: "t1", name: "مقابلة" }, { id: "t2", name: "تقرير" }]);
});

run("ai assist — applyProofread + correctionsCount", () => {
  assert.equal(applyProofread("نص", { correctedText: "نصٌّ مصحّح" }), "نصٌّ مصحّح");
  assert.equal(applyProofread("الأصل", { correctedText: "" }), "الأصل");   // empty → keep original
  assert.equal(applyProofread("الأصل", {}), "الأصل");                       // missing → keep original
  assert.equal(correctionsCount({ corrections: [{}, {}] }), 2);
  assert.equal(correctionsCount({}), 0);
});

run("ai assist — applySummaryToNotes appends below existing, fills when empty", () => {
  assert.equal(applySummaryToNotes("", "ملخّص"), "ملخّص");
  assert.equal(applySummaryToNotes("ملاحظة", "ملخّص"), "ملاحظة\n\nملخّص");
  assert.equal(applySummaryToNotes("ملاحظة", "   "), "ملاحظة");             // blank summary → unchanged
});

run("ai assist — buildSuggestPayload + hasSourceText", () => {
  const p = buildSuggestPayload({ title: " عنوان ", notes: " وصف ", contentTypes: [{ id: "t1", name: "ن" }] });
  assert.equal(p.name, "عنوان");
  assert.equal(p.summary, "وصف");
  assert.deepEqual(p.categories, [{ id: "t1", name: "ن" }]);
  assert.equal(hasSourceText({ notes: "x" }), true);
  assert.equal(hasSourceText({ title: "t" }), true);
  assert.equal(hasSourceText({}), false);
  assert.equal(hasSourceText({ notes: "   " }), false);
});

run("ai assist — workbench action descriptors respect editable fields", () => {
  assert.deepEqual(createAiWorkbenchActions({ canEditNotes: false }).map((item) => item.id), ["suggestTags"]);
  assert.deepEqual(createAiWorkbenchActions({ canEditTags: false }).map((item) => item.id), ["summarize", "proofread"]);
});

// G6 — scoped sharing client (mint link + read public view), injected fetch.
import {
  canShare, detectShareToken, buildShareUrl, mintShareLink, fetchSharedView, ShareClientError
} from "../src/features/share/shareClient.js";

run("share client — canShare gate + detectShareToken + buildShareUrl", () => {
  assert.equal(canShare({ backend: "local", token: "t" }), false);
  assert.equal(canShare({ backend: "postgres", token: "" }), false);
  assert.equal(canShare({ backend: "postgres", token: "t" }), true);
  assert.equal(detectShareToken({ search: "?share=abc", hash: "" }), "abc");
  assert.equal(detectShareToken({ search: "", hash: "#share=xyz" }), "xyz");
  assert.equal(detectShareToken({ search: "?x=1", hash: "" }), "");
  assert.equal(buildShareUrl("tok", { origin: "https://a.test/" }), "https://a.test/?share=tok");
});

await runAsync("share client — mintShareLink posts scope with bearer; guards token", async () => {
  let sent = null;
  const okFetch = async (url, opts) => { sent = { url, opts }; return { ok: true, json: async () => ({ ok: true, result: { token: "TK", path: "/api/share/TK", title: "مراجعة", expiresAt: "2026-06-10T00:00:00.000Z" } }) }; };
  const out = await mintShareLink({ scope: { type: "collection", ids: ["c1"] }, title: "مراجعة", expiresInDays: 5, baseUrl: "https://srv", getToken: () => "jwt", fetchImpl: okFetch, origin: "https://app.test" });
  assert.equal(sent.url, "https://srv/api/share");
  assert.equal(sent.opts.headers.Authorization, "Bearer jwt");
  assert.equal(JSON.parse(sent.opts.body).scope.ids[0], "c1");
  assert.equal(JSON.parse(sent.opts.body).title, "مراجعة");
  assert.equal(JSON.parse(sent.opts.body).expiresInDays, 5);
  assert.equal(out.token, "TK");
  assert.equal(out.url, "https://app.test/?share=TK");
  assert.equal(out.expiresAt, "2026-06-10T00:00:00.000Z");

  await assert.rejects(() => mintShareLink({ scope: {}, getToken: () => "", fetchImpl: okFetch }), (e) => e instanceof ShareClientError);
});

await runAsync("share client — fetchSharedView returns result; maps errors to 404", async () => {
  const okFetch = async () => ({ ok: true, json: async () => ({ ok: true, result: { videoItems: [{ id: "v1" }], counts: { items: 1 } } }) });
  const view = await fetchSharedView({ token: "TK", baseUrl: "https://srv", fetchImpl: okFetch });
  assert.equal(view.videoItems.length, 1);

  const missFetch = async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: "منتهٍ" }) });
  await assert.rejects(() => fetchSharedView({ token: "BAD", fetchImpl: missFetch }), (e) => e instanceof ShareClientError && e.status === 404);
});

// G2 — in-browser Whisper transcription adapter (injected pipeline + decoder).
import { createLocalXenovaAiProvider, formatWhisperOutput } from "../src/storage/adapters/ai-local-xenova/index.js";

run("local whisper — formatWhisperOutput maps chunks to segments", () => {
  const out = formatWhisperOutput({ text: " مرحبا بالعالم ", chunks: [
    { timestamp: [0, 2.5], text: " مرحبا " },
    { timestamp: [2.5, 4], text: "بالعالم" },
    { timestamp: [4, 5], text: "  " } // blank → dropped
  ] });
  assert.equal(out.transcription, "مرحبا بالعالم");
  assert.deepEqual(out.segments, [
    { start: 0, end: 2.5, text: "مرحبا" },
    { start: 2.5, end: 4, text: "بالعالم" }
  ]);
  assert.deepEqual(formatWhisperOutput({}), { transcription: "", segments: [] });
});

run("local whisper — satisfies AiProvider port, text methods reject", () => {
  const p = createLocalXenovaAiProvider({ pipelineFactory: async () => () => ({}) });
  assert.equal(isAiProvider(p), true);
  assert.equal(p.isAvailable(), false);
  assert.equal(p.canTranscribe(), true);
});

await runAsync("local whisper — transcribe runs ASR (injected) + memoizes pipeline", async () => {
  let built = 0;
  let decoded = 0;
  const fakeAsr = async (input) => { assert.ok(input); return { text: "نصّ", chunks: [{ timestamp: [0, 1], text: "نصّ" }] }; };
  const provider = createLocalXenovaAiProvider({
    pipelineFactory: async () => { built += 1; return fakeAsr; },
    decodeAudio: async () => { decoded += 1; return new Float32Array([0, 1, 0]); }
  });
  const r1 = await provider.transcribe({ blob: { arrayBuffer: async () => new ArrayBuffer(8) } });
  assert.deepEqual(r1, { transcription: "نصّ", segments: [{ start: 0, end: 1, text: "نصّ" }] });
  const r2 = await provider.transcribe({ audio: new Float32Array([1]) }); // pre-decoded path
  assert.equal(r2.transcription, "نصّ");
  assert.equal(built, 1);   // pipeline built once, reused
  assert.equal(decoded, 1); // only the blob path decodes
  await assert.rejects(() => provider.transcribe({}), /لا يوجد ملف صوت/);
  await assert.rejects(() => provider.summarize({ text: "x" }), /تتطلّب مزوّدًا سحابيًّا/);
});

// Server status — pure health parsing + connection state transitions.
import {
  createConnectionStatusState,
  reduceConnectionStatus,
  statusFromHealth
} from "../src/features/server-status/connectionStatus.js";
import {
  fetchServerHealth,
  normalizeServerHealth,
  ServerHealthError
} from "../src/features/server-status/serverHealthClient.js";

run("connection status — health maps online/degraded and RPC errors map offline", () => {
  const initial = createConnectionStatusState();
  assert.equal(initial.state, "local");
  const onlineEvent = statusFromHealth({ ok: true, backend: "postgres", engine: "postgresql", db: { ok: true, latencyMs: 4 } }, "2026-06-04T00:00:00.000Z");
  const online = reduceConnectionStatus(initial, onlineEvent);
  assert.equal(online.state, "online");
  assert.equal(online.lastLatencyMs, 4);
  const degraded = reduceConnectionStatus(online, { type: "health", checkedAt: "2026-06-04T00:00:01.000Z", health: { backend: "postgres", engine: "postgresql", db: { ok: false, latencyMs: 8, error: "down" } } });
  assert.equal(degraded.state, "degraded");
  assert.equal(degraded.lastError, "down");
  const reconnecting = reduceConnectionStatus(degraded, { type: "unauthorized", status: 401, error: "expired" });
  assert.equal(reconnecting.state, "reconnecting");
  const offline = reduceConnectionStatus(reconnecting, { type: "rpc-failure", error: "network" });
  assert.equal(offline.state, "offline");
});

run("server health client — normalize health shape", () => {
  const health = normalizeServerHealth({ ok: true, backend: "postgres", engine: "postgresql", db: { ok: true, latencyMs: 12 }, uptimeSec: 3, version: "1.0.0", authRequired: true }, { measuredLatencyMs: 20, checkedAt: "now" });
  assert.equal(health.backend, "postgres");
  assert.equal(health.engine, "postgresql");
  assert.equal(health.db.latencyMs, 12);
  assert.equal(health.latencyMs, 20);
  assert.equal(health.checkedAt, "now");
});

await runAsync("server health client — fetches /api/health and maps errors", async () => {
  const ok = await fetchServerHealth({
    baseUrl: "https://srv/",
    checkedAt: "checked",
    fetchImpl: async (url) => {
      assert.equal(url, "https://srv/api/health");
      return { ok: true, status: 200, json: async () => ({ ok: true, backend: "postgres", engine: "postgresql", db: { ok: true, latencyMs: 5 } }) };
    }
  });
  assert.equal(ok.checkedAt, "checked");
  assert.equal(ok.db.ok, true);

  await assert.rejects(() => fetchServerHealth({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ ok: false, error: "no" }) })
  }), (err) => err instanceof ServerHealthError && err.status === 503);
});

// DB-config client — admin database settings (server Phase 3 endpoints).
import {
  canManageDb,
  buildPgUrl,
  buildDatabaseUrl,
  fetchDbConfig,
  testDbConnection,
  saveDbConfig,
  DbConfigError
} from "../src/features/settings/dbConfigClient.js";

run("db config — canManageDb gate + buildPgUrl", () => {
  assert.equal(canManageDb({ backend: "local", token: "t", role: "admin" }), false);
  assert.equal(canManageDb({ backend: "postgres", token: "", role: "admin" }), false);
  assert.equal(canManageDb({ backend: "postgres", token: "t", role: "viewer" }), false);
  assert.equal(canManageDb({ backend: "postgres", token: "t", role: "admin" }), true);
  assert.equal(buildPgUrl({ host: "db", port: 5432, database: "archive", user: "u", password: "p@ss" }), "postgresql://u:p%40ss@db:5432/archive");
  assert.equal(buildDatabaseUrl({ engine: "mysql", host: "db", database: "archive", user: "u", password: "p" }), "mysql://u:p@db:3306/archive");
  assert.equal(buildDatabaseUrl({ engine: "sqlite", file: "./archive.sqlite" }), "file:./archive.sqlite");
  assert.equal(buildDatabaseUrl({ engine: "sqlserver", host: "db", database: "archive", user: "sa", password: "p" }), "sqlserver://sa:p@db:1433/archive");
});

await runAsync("db config — fetch/test/save use bearer + correct routes; 403 maps", async () => {
  const sent = [];
  const okFetch = async (url, opts) => {
    sent.push({ url, method: opts.method, auth: opts.headers.Authorization, body: opts.body });
    if (url.endsWith("/api/admin/config") && opts.method === "GET") return { ok: true, json: async () => ({ ok: true, result: { database: { url: "postgresql://archive:***@postgres:5432/archive", source: "env", target: "bundled" } } }) };
    if (url.endsWith("/api/admin/db/test")) return { ok: true, json: async () => ({ ok: true, result: { ok: true } }) };
    if (url.endsWith("/api/admin/config") && opts.method === "POST") return { ok: true, json: async () => ({ ok: true, result: { saved: true, restartRequired: true, database: { url: "postgresql://u:***@ext:5432/db", target: "external" } } }) };
    throw new Error(`unexpected ${opts.method} ${url}`);
  };
  const deps = { baseUrl: "https://srv", getToken: () => "jwt", fetchImpl: okFetch };

  const cfg = await fetchDbConfig(deps);
  assert.equal(cfg.database.target, "bundled");
  const test = await testDbConnection({ engine: "mysql", url: "mysql://u:p@ext:3306/db", ...deps });
  assert.equal(test.ok, true);
  const saved = await saveDbConfig({ engine: "mysql", url: "mysql://u:p@ext:3306/db", ...deps });
  assert.equal(saved.restartRequired, true);

  assert.equal(sent[0].auth, "Bearer jwt");
  assert.deepEqual(JSON.parse(sent[1].body), { engine: "mysql", url: "mysql://u:p@ext:3306/db" });
  assert.deepEqual(JSON.parse(sent[2].body).database, { engine: "mysql", url: "mysql://u:p@ext:3306/db" });

  // 403 → friendly DbConfigError
  const forbidden = async () => ({ ok: false, status: 403, json: async () => ({ ok: false, error: "nope" }) });
  await assert.rejects(() => fetchDbConfig({ ...deps, fetchImpl: forbidden }), (e) => e instanceof DbConfigError && e.status === 403);
});

// FileStore-config client — storage status in Settings.
import {
  canManageFileStore, fetchFileStoreStatus, fetchFileStoreConfig, saveFileStoreConfig, startDropboxOAuth,
  FileStoreConfigError
} from "../src/features/settings/fileStoreConfigClient.js";

run("file store config — cloud/admin gate", () => {
  assert.equal(canManageFileStore({ backend: "local", token: "t", role: "admin" }), false);
  assert.equal(canManageFileStore({ backend: "postgres", token: "", role: "admin" }), false);
  assert.equal(canManageFileStore({ backend: "postgres", token: "t", role: "viewer" }), false);
  assert.equal(canManageFileStore({ backend: "postgres", token: "t", role: "owner" }), true);
});

await runAsync("file store config — fetch status uses bearer and maps 403", async () => {
  const sent = [];
  const okFetch = async (url, opts) => {
    sent.push({ url, method: opts.method, auth: opts.headers.Authorization });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          kind: "dropbox",
          label: "Dropbox",
          rootPath: "/archive",
          configured: true,
          capabilities: { upload: true, download: true, list: true, remove: true, temporaryUrl: true },
          health: { listOk: true, listCount: 7 }
        }
      })
    };
  };
  const status = await fetchFileStoreStatus({ baseUrl: "https://srv/", getToken: () => "jwt", fetchImpl: okFetch });
  assert.equal(status.kind, "dropbox");
  assert.equal(status.health.listCount, 7);
  assert.equal(sent[0].url, "https://srv/api/files/status");
  assert.equal(sent[0].method, "GET");
  assert.equal(sent[0].auth, "Bearer jwt");

  const forbidden = async () => ({ ok: false, status: 403, json: async () => ({ ok: false, error: "nope" }) });
  await assert.rejects(
    () => fetchFileStoreStatus({ baseUrl: "https://srv", getToken: () => "jwt", fetchImpl: forbidden }),
    (e) => e instanceof FileStoreConfigError && e.status === 403
  );
});

await runAsync("file store config — fetch/save persisted config", async () => {
  const sent = [];
  const okFetch = async (url, opts = {}) => {
    sent.push({ url, method: opts.method, auth: opts.headers.Authorization, type: opts.headers["Content-Type"], body: opts.body });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: url.endsWith("/api/admin/config") && opts.method === "GET"
          ? { fileStore: { kind: "dropbox", source: "file", dropbox: { rootPath: "/archive", hasAccessToken: true } } }
          : { saved: true, restartRequired: true, fileStore: { kind: "dropbox", dropbox: { rootPath: "/active", hasAccessToken: true } } }
      })
    };
  };
  const deps = { baseUrl: "https://srv/", getToken: () => "jwt", fetchImpl: okFetch };
  const cfg = await fetchFileStoreConfig(deps);
  assert.equal(cfg.kind, "dropbox");
  assert.equal(cfg.dropbox.rootPath, "/archive");
  const saved = await saveFileStoreConfig({
    kind: "dropbox",
    dropboxRootPath: "/active",
    dropboxAccessToken: "tok-secret",
    dropboxRefreshToken: "refresh-secret",
    dropboxAppKey: "app-key",
    dropboxAppSecret: "app-secret",
    dropboxSelectUser: "dbid:user1",
    ...deps
  });
  assert.equal(saved.restartRequired, true);
  assert.equal(sent[0].url, "https://srv/api/admin/config");
  assert.equal(sent[0].method, "GET");
  assert.equal(sent[0].auth, "Bearer jwt");
  assert.equal(sent[1].method, "POST");
  assert.equal(sent[1].type, "application/json");
  assert.deepEqual(JSON.parse(sent[1].body), {
    fileStore: {
      kind: "dropbox",
      dropbox: {
        rootPath: "/active",
        accessToken: "tok-secret",
        refreshToken: "refresh-secret",
        appKey: "app-key",
        appSecret: "app-secret",
        selectUser: "dbid:user1",
        selectAdmin: ""
      }
    }
  });
});

await runAsync("file store config — starts Dropbox OAuth link", async () => {
  const sent = [];
  const okFetch = async (url, opts = {}) => {
    sent.push({ url, method: opts.method, auth: opts.headers.Authorization, body: opts.body });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { authUrl: "https://www.dropbox.com/oauth2/authorize?x=1" } }) };
  };
  const result = await startDropboxOAuth({
    baseUrl: "https://srv/",
    getToken: () => "jwt",
    fetchImpl: okFetch,
    rootPath: "/media",
    selectUser: "dbid:user1",
    returnTo: "https://app/settings"
  });
  assert.match(result.authUrl, /^https:\/\/www\.dropbox\.com/);
  assert.equal(sent[0].url, "https://srv/api/admin/dropbox/oauth/start");
  assert.deepEqual(JSON.parse(sent[0].body), { rootPath: "/media", selectUser: "dbid:user1", selectAdmin: "", returnTo: "https://app/settings" });
});

// G8 — Uploader/Transcriber shared view-model.
import {
  secondsToClock, transcriptToText, resolveTranscribeProvider,
  availableTranscribeModes, sanitizeUploadKey, isAudioVideo, describeFileList,
  buildFileBrowserRows, filterFileBrowserRows,
  canUseServerMediaTools, createMediaMetadataPatch, deriveMediaSourceKey,
  formatMediaJobStatus, mergeMediaJobs, mediaProbeToDisplayRows,
  selectSmartThumbnailSecond
} from "../src/features/media/viewModel.js";
import {
  MediaClientError,
  createMediaClient
} from "../src/features/media/mediaClient.js";

run("media — secondsToClock + transcriptToText", () => {
  assert.equal(secondsToClock(0), "0:00");
  assert.equal(secondsToClock(75), "1:15");
  assert.equal(secondsToClock(3661), "1:01:01");
  const result = { transcription: "نصّ كامل", segments: [{ start: 0, end: 2, text: "أ" }, { start: 2, end: 4, text: "ب" }] };
  assert.equal(transcriptToText(result), "نصّ كامل");
  assert.equal(transcriptToText(result, { withTimecodes: true }), "[0:00] أ\n[0:02] ب");
  assert.equal(transcriptToText({ segments: [{ start: 0, text: "x" }] }), "x"); // falls back to segments
});

run("media — resolveTranscribeProvider + availableTranscribeModes", () => {
  const cloud = { isAvailable: () => true, transcribe: () => {} };
  assert.equal(resolveTranscribeProvider({ mode: "cloud", cloudProvider: cloud }).mode, "cloud");
  const localProv = { transcribe: () => {} };
  assert.equal(resolveTranscribeProvider({ mode: "local", localFactory: () => localProv }).provider, localProv);
  assert.throws(() => resolveTranscribeProvider({ mode: "cloud", cloudProvider: { isAvailable: () => false } }), /غير متاح/);
  assert.throws(() => resolveTranscribeProvider({ mode: "local" }), /غير متاح/);
  assert.deepEqual(availableTranscribeModes({ cloudProvider: cloud, hasLocal: true }), ["cloud", "local"]);
  assert.deepEqual(availableTranscribeModes({ cloudProvider: { isAvailable: () => false }, hasLocal: true }), ["local"]);
});

run("media — sanitizeUploadKey + isAudioVideo + describeFileList", () => {
  assert.equal(sanitizeUploadKey("My File (1).mp4"), "My_File_1_.mp4");
  assert.equal(sanitizeUploadKey("لقطة.mov", { folder: "/clips/" }), "clips/لقطة.mov");
  assert.match(sanitizeUploadKey("   "), /^file-\d+/);
  assert.equal(isAudioVideo({ type: "audio/mpeg" }), true);
  assert.equal(isAudioVideo({ name: "clip.MKV" }), true);
  assert.equal(isAudioVideo({ name: "doc.pdf", type: "application/pdf" }), false);
  const d = describeFileList(["b.jpg", "a.jpg"]);
  assert.equal(d.count, 2);
  assert.deepEqual(d.preview, ["a.jpg", "b.jpg"]);
});

run("media — file browser rows classify and filter", () => {
  const rows = buildFileBrowserRows(["clips/b.mov", "thumbs/a.JPG", "docs/readme.pdf", "audio/song.mp3"]);
  const image = rows.find((row) => row.key === "thumbs/a.JPG");
  assert.equal(image.name, "a.JPG");
  assert.equal(image.folder, "thumbs");
  assert.equal(image.type, "image");
  assert.equal(rows.find((row) => row.key === "clips/b.mov").type, "video");
  assert.equal(rows.find((row) => row.key === "audio/song.mp3").type, "audio");
  assert.equal(rows.find((row) => row.key === "docs/readme.pdf").type, "document");
  assert.deepEqual(filterFileBrowserRows(rows, "thumb").map((row) => row.key), ["thumbs/a.JPG"]);
  assert.deepEqual(filterFileBrowserRows(rows, "MOV").map((row) => row.key), ["clips/b.mov"]);
});

run("media toolkit view model — source keys, metadata patch, jobs", () => {
  assert.equal(canUseServerMediaTools({ backend: "local", token: "t", role: "admin" }), false);
  assert.equal(canUseServerMediaTools({ backend: "postgres", token: "", role: "admin" }), false);
  assert.equal(canUseServerMediaTools({ backend: "postgres", token: "t", role: "viewer" }), false);
  assert.equal(canUseServerMediaTools({ backend: "postgres", token: "t", role: "editor" }), true);
  assert.equal(deriveMediaSourceKey({ path: "uploads/a.mp4" }), "uploads/a.mp4");
  assert.equal(deriveMediaSourceKey({ metadata: { fileKey: "files/b.mp4" } }), "files/b.mp4");
  assert.equal(deriveMediaSourceKey({ metadata: { localFile: { path: "C:/Videos/a.mp4" } } }), "");
  assert.equal(selectSmartThumbnailSecond({ durationSec: 90 }), 9);

  const patch = createMediaMetadataPatch({
    probe: { durationSec: 90, width: 1920, height: 1080, codec: "h264", bitrate: 800000, hasAudio: true },
    thumbnailKey: "thumbnails/a-poster.jpg",
    audioKey: "audio/a.mp3",
    previewKey: "previews/a.gif",
    derivedKey: "derived/a-web.mp4"
  });
  assert.equal(patch.duration, 90);
  assert.equal(patch.thumbnail, "thumbnails/a-poster.jpg");
  assert.equal(patch.metadata.media.width, 1920);
  assert.equal(patch.metadata.media.audioKey, "audio/a.mp3");
  assert.deepEqual(mediaProbeToDisplayRows(patch.metadata.media).map((row) => row.value), ["1:30", "1920×1080", "h264", "800 kb/s", "نعم"]);

  const jobs = mergeMediaJobs([
    { id: "1", status: "done", updatedAt: 1 },
    { id: "2", status: "running", progress: 40, updatedAt: 3 },
    { id: "3", status: "error", error: "bad", updatedAt: 2 }
  ]);
  assert.deepEqual(jobs.map((job) => job.id), ["2", "3", "1"]);
  assert.equal(formatMediaJobStatus(jobs[0]).label, "قيد التنفيذ");
  assert.equal(formatMediaJobStatus(jobs[2]).label, "مكتملة");
});

await runAsync("media client — calls endpoints with bearer and maps errors", async () => {
  const sent = [];
  const client = createMediaClient({
    baseUrl: "https://srv/",
    getToken: () => "jwt",
    fetchImpl: async (url, options = {}) => {
      sent.push({ url, method: options.method || "GET", auth: options.headers?.Authorization, body: options.body });
      if (url.endsWith("/api/media/probe")) return { ok: true, status: 200, json: async () => ({ ok: true, result: { durationSec: 10 } }) };
      if (url.endsWith("/api/media/thumbnail")) return { ok: true, status: 200, json: async () => ({ ok: true, result: { outputKey: "thumbnails/a.jpg" } }) };
      if (url.endsWith("/api/media/jobs")) return { ok: true, status: 200, json: async () => ({ ok: true, result: [{ id: "j1" }] }) };
      if (url.endsWith("/api/media/jobs/j1/retry")) return { ok: true, status: 200, json: async () => ({ ok: true, result: { id: "j1", status: "queued" } }) };
      return { ok: false, status: 500, json: async () => ({ ok: false, error: "boom" }) };
    }
  });
  assert.equal((await client.probe("uploads/a.mp4")).durationSec, 10);
  assert.equal((await client.thumbnail("uploads/a.mp4", { width: 480 })).outputKey, "thumbnails/a.jpg");
  assert.equal((await client.listJobs())[0].id, "j1");
  assert.equal((await client.retryJob("j1")).status, "queued");
  assert.equal(sent[0].url, "https://srv/api/media/probe");
  assert.equal(sent[0].auth, "Bearer jwt");
  assert.deepEqual(JSON.parse(sent[1].body), { key: "uploads/a.mp4", width: 480 });

  await assert.rejects(
    () => client.audio("uploads/a.mp4", { format: "mp3" }),
    (error) => error instanceof MediaClientError && error.status === 500
  );
});

// Theme v2 storage tests — runs the standalone test suite from
// verify-modules.theme-v2.mjs in the same node process.
await import("./verify-modules.theme-v2.mjs");

// --- v4 theme version registration ---
assert.equal(DEFAULT_THEME_VERSION, "v4", "v4 is the default theme version");
assert.equal(defaultSettings().ui.themeVersion, "v4", "settings default mirrors v4");
assert.equal(getDefaultSettings().ui.themeVersion, "v4", "app settings default mirrors v4");
assert.equal(normalizeThemeVersion("v4"), "v4", "v4 must be a valid theme version");
assert.equal(normalizeThemeVersion("v3"), "v3", "v3 still valid");
assert.equal(normalizeThemeVersion("nope"), DEFAULT_THEME_VERSION, "unknown falls back to default");
console.log("ok: theme version v4 registered and defaulted");

// --- motion: stagger is capped at 12 items (spec §3) ---
assert.equal(staggerFor(0), 0, "first item no delay");
assert.equal(staggerFor(5), 5 * transitions.stagger, "within cap scales linearly");
assert.equal(staggerFor(11), 11 * transitions.stagger, "last capped item");
assert.equal(staggerFor(50), 12 * transitions.stagger, "beyond cap clamps to 12");
assert.ok(12 * transitions.stagger <= 0.5, "total stagger stays <= 500ms");
console.log("ok: motion stagger capped");

// --- regression guard: no hardcoded dark surface backgrounds (light-mode safety) ---
// Several v1-era CSS classes used to hardcode dark navy fills (e.g.
// rgba(15,23,42,…)) for *surfaces*, which rendered as gray/dark blobs in light
// mode. Surface backgrounds must use theme-aware tokens (var(--color-bg-elevated),
// var(--va-*), or transparent). Backdrops/scrims may still use plain black, so we
// only forbid the specific dark-navy surface literals that caused regressions.
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const overridesCss = readFileSync(fileURLToPath(new URL("../src/styles/app-overrides.css", import.meta.url)), "utf8");
  for (const banned of ["rgba(15,23,42", "rgba(22,32,51", "rgba(17,24,39"]) {
    assert.equal(
      overridesCss.includes(banned),
      false,
      `app-overrides.css must not hardcode dark surface fill "${banned}" — use a theme-aware token (var(--color-bg-elevated) / var(--va-*) / transparent)`
    );
  }
  console.log("ok: no hardcoded dark surface backgrounds in app-overrides.css");
}

// --- sidebar layout model (customizable sidebar: pin/hide/reorder + collapse) ---
{
  const {
    getDefaultSidebarLayout, normalizeSidebarLayout, applySidebarLayout,
    setSidebarItemHidden, setSidebarItemPinned, reorderSidebarItem,
    setSidebarCollapsed, hasSidebarLayoutDraftChanges
  } = await import("../src/features/navigation/sidebarLayoutModel.js");

  const ids = ["dashboard", "archive", "add", "settings"];
  const groups = [
    { id: "daily", label: "اليومي", pages: [{ id: "dashboard" }, { id: "archive" }, { id: "add" }] },
    { id: "admin", label: "الإدارة", pages: [{ id: "settings" }] }
  ];

  const def = getDefaultSidebarLayout(ids);
  assert.equal(def.collapsed, false);
  assert.equal(def.items.dashboard.order, 0);
  assert.equal(def.items.settings.order, 3);

  // normalize: corrupt -> default; drops unknown, appends missing
  assert.deepEqual(normalizeSidebarLayout(null, ids).items.add.order, 2);
  const normed = normalizeSidebarLayout({ version: 1, collapsed: true, items: { archive: { order: 0, hidden: true, pinned: true } } }, ids);
  assert.equal(normed.collapsed, true);
  assert.equal(normed.items.archive.hidden, true);
  assert.equal(normed.items.archive.pinned, true);
  assert.ok(!("oldpage" in normed.items), "unknown ids dropped");

  // apply: hidden excluded in view mode, kept in edit mode
  let layout = getDefaultSidebarLayout(ids);
  layout = setSidebarItemHidden(layout, "add", true);
  const viewShape = applySidebarLayout(groups, layout, { editing: false });
  assert.equal(viewShape.groups[0].pages.find((p) => p.id === "add"), undefined, "hidden hidden in view");
  const editShape = applySidebarLayout(groups, layout, { editing: true });
  assert.ok(editShape.groups[0].pages.find((p) => p.id === "add"), "hidden shown in edit");

  // pin pulls page into the pinned list, out of its group
  layout = setSidebarItemPinned(layout, "archive", true);
  const pinShape = applySidebarLayout(groups, layout, { editing: false });
  assert.ok(pinShape.pinned.find((p) => p.id === "archive"), "pinned surfaced");
  assert.equal(pinShape.groups[0].pages.find((p) => p.id === "archive"), undefined, "pinned removed from group");

  // reorder: dashboard down swaps order with archive within the daily list
  let l2 = getDefaultSidebarLayout(ids);
  const before = l2.items.dashboard.order;
  l2 = reorderSidebarItem(l2, ["dashboard", "archive", "add"], "dashboard", "down");
  assert.equal(l2.items.dashboard.order, l2.items.archive.order > before ? l2.items.dashboard.order : l2.items.dashboard.order); // swapped
  assert.ok(l2.items.dashboard.order > l2.items.archive.order, "dashboard moved after archive");
  // reorder past the edge is a no-op
  assert.equal(reorderSidebarItem(l2, ["dashboard"], "dashboard", "up"), l2);

  // collapse + change detection
  const collapsed = setSidebarCollapsed(getDefaultSidebarLayout(ids), true);
  assert.equal(collapsed.collapsed, true);
  assert.equal(hasSidebarLayoutDraftChanges(getDefaultSidebarLayout(ids), getDefaultSidebarLayout(ids)), false);
  assert.equal(hasSidebarLayoutDraftChanges(collapsed, getDefaultSidebarLayout(ids)), true);
  console.log("ok: sidebar layout model (pin/hide/reorder/collapse)");
}
