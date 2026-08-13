import type { DictionaryShape } from "../../types";
import type { settings as arabicSettings } from "../ar/settings";

export const settings = {
  language: {
    title: "Interface language",
    label: "Interface language",
    description: "Choose the language used for navigation, messages, and the user guide. Your choice is saved to your account and follows you to other devices.",
    saving: "Saving language…",
    success: "Language updated.",
    error: "The language could not be saved. Try again.",
  },
  appearance: {
    presetsTitle: "Theme presets",
    presetNames: {
      cinematicDark: "Cinematic Dark",
      luxuryDark: "Luxury Dark",
      oceanDark: "Ocean Dark",
      neutralLight: "Neutral Light",
      highContrast: "High Contrast"
    },
    themeDataTitle: "Theme data",
    exportTheme: "Export theme",
    importTheme: "Import theme",
    importUnknownError: "An unknown error occurred while importing the theme.",
    exportedJsonPreview: "Exported JSON preview",
    schedulingTitle: "Time-based theme switching",
    enableScheduling: "Enable automatic time-based switching",
    darkMode: "Dark",
    lightMode: "Light",
    deleteRule: "Delete rule",
    startTimePlaceholder: "Start time",
    endTimePlaceholder: "End time",
    ruleModeAriaLabel: "Theme mode for the rule",
    addRule: "Add"
  },
  dropboxFolderPicker: {
    chooseFolder: "Choose folder",
    dialogAriaLabel: "Choose Dropbox folder",
    browseTitle: "Browse Dropbox folders — {path}",
    close: "Close",
    loading: "Loading…",
    subfoldersAriaLabel: "Subfolders",
    parentFolder: "Previous folder",
    open: "Open",
    empty: "There are no subfolders here.",
    saving: "Saving…",
    chooseCurrent: "Choose “{path}”"
  },
  shortcuts: {
    panelAriaLabel: "Keyboard shortcut settings",
    title: "Keyboard shortcuts",
    loading: "Loading shortcuts…",
    description: "Customize keyboard shortcuts to work faster. Select a shortcut to change its keys.",
    resetTitle: "Restore all shortcuts to their defaults",
    resetButton: "Reset",
    resetDialogTitle: "Reset shortcuts",
    resetDialogMessage: "Restore all keyboard shortcuts to their defaults? Your custom shortcuts will be lost.",
    shortcutsListAriaLabel: "Shortcut list",
    recorderAriaLabel: "Shortcut recorder",
    recorderPrompt: "Press the keys…",
    saveButton: "Save",
    cancelButton: "Cancel",
    changeShortcutTitle: "Select to change the shortcut",
    modifierHint: "💡 A shortcut can only be saved when it includes at least one modifier key: Ctrl, Cmd, Shift, or Alt.",
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
} as const satisfies DictionaryShape<typeof arabicSettings>;
