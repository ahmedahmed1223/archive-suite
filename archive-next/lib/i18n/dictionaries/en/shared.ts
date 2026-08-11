import type { DictionaryShape } from "../../types";
import type { shared as arabicShared } from "../ar/shared";

export const shared = {
  appName: "Archive Suite",
  actions: {
    save: "Save",
    cancel: "Cancel",
    retry: "Try again",
    confirm: "Confirm",
    accept: "OK",
    close: "Close",
  },
  feedback: {
    loading: "Loading…",
    genericError: "The operation could not be completed. Try again.",
    noResults: "No results",
    confirmActionTitle: "Confirm action",
    promptValueTitle: "Enter value",
    alertTitle: "Alert",
    dismiss: "Close",
  },
  languages: {
    ar: "Arabic",
    en: "English",
  },
  dataTable: {
    empty: "No data to display.",
    noSort: "No sorting is active.",
    sortedBy: "Table sorted by {columns}.",
    ascending: "{column} ascending",
    descending: "{column} descending",
    thenSeparator: ", then ",
    scrollRegion: "Scrollable table region",
    namedScrollRegion: "{label} — scrollable table region",
    scrollHint: "When needed, focus the table region and use the left and right arrow keys to scroll horizontally.",
    columns: "Columns",
    toggleSort: "Toggle sorting for column {column}"
  },
  mediaPlayer: {
    playbackError: "This item could not be played. Check the path and whether the browser supports its format.",
    empty: "No item selected for playback.",
    timelineAriaLabel: "Media timeline"
  },
  mediaSourcePicker: {
    dialogAriaLabel: "Choose media source",
    browseTitle: "Browse archive files — {path}",
    close: "Close",
    loading: "Loading…"
  },
  iconPicker: {
    choose: "Choose an icon",
    search: "Search for an icon"
  },
  changeImpactPreview: {
    introduction: "Impact preview:",
    available: "available"
  },
  dataViewSwitcher: {
    label: "View mode"
  },
  shortcutsOverlay: {
    title: "Keyboard shortcuts",
    description: "A quick overview of the keyboard shortcuts currently available.",
    labels: {
      commandPalette: "Open command palette",
      shortcutsHelp: "Show shortcut panel",
      focusSearch: "Move to search",
      newRecord: "Create a new record",
      saveRecord: "Save description",
      focusComments: "Move to comments",
      focusTags: "Move to tags"
    }
  },
  storageBrowser: {
    panelAriaLabel: "File management workspace",
    title: "File management",
    description: "Browse connected storage providers and run only the operations they support.",
    providerLabel: "Storage provider",
    offlineSuffix: " — Offline",
    providerStatusAriaLabel: "Storage provider status",
    noProvider: "No storage provider",
    statuses: {
      ready: "Ready",
      syncing: "Syncing",
      offline: "Offline"
    },
    actionsAriaLabel: "File actions",
    actions: {
      upload: "Upload",
      createFolder: "New folder",
      move: "Move"
    },
    unavailableAction: "Unavailable for the selected storage provider",
    pathAriaLabel: "Storage path",
    root: "Root",
    searchLabel: "Search this folder",
    searchPlaceholder: "Search by file or folder name",
    openError: "Could not open the storage provider",
    loading: "Loading files…",
    contentsAriaLabel: "Storage contents",
    parentFolder: "Previous folder",
    open: "Open",
    download: "Download",
    noMatches: "No matching items in this folder."
  },
  pages: {
    notFoundTitle: "Page not found.",
    notFoundDescription: "The link you opened is invalid or its page has been removed.",
    backHome: "Back to home",
    openArchive: "Open archive",
    pageError: "Page unavailable",
    pageErrorTitle: "An error occurred while loading this screen.",
    pageErrorDescription: "Try again, or return home if the error continues.",
    errorReference: "Error reference",
  },
  globalError: {
    badge: "Unexpected error",
    title: "Could not load {brand}.",
    description: "Try again. If the error continues, open the error log from the workspace.",
    errorReference: "Error reference",
    retry: "Try again",
    errorLog: "Error log"
  },
  suggestions: {
    title: "Improvement suggestions",
    severity: { high: "Important", medium: "Improvement", low: "Note" },
    selectAllAriaLabel: "Select all suggestions",
    selectedCount: "{count} selected",
    selectAll: "Select all",
    approveSelected: "Approve selected",
    dismissSelected: "Dismiss selected",
    selectItemAriaLabel: "Select {title}",
    itemCount: "{count} items",
    open: "Open",
    useful: "Useful",
    notUseful: "Not useful",
    dismiss: "Hide",
    feedbackError: "Unable to save the suggestion feedback."
  },
} as const satisfies DictionaryShape<typeof arabicShared>;
