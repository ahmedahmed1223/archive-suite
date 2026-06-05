import { normalizeArabicSearchText } from "../../utils/formatting.js";

export const HELP_SECTION_ALIASES = {
  keyboard: "shortcuts",
  shortcut: "shortcuts",
  shortcuts: "shortcuts",
  archive: "dashboard-archive",
  filters: "dashboard-archive",
  navigation: "navigation-links",
  links: "navigation-links",
  backup: "backup-import",
  import: "file-import"
};

export function normalizeHelpSectionId(sectionId, fallback = "getting-started") {
  const value = String(sectionId || "").trim();
  if (!value) return fallback;
  return HELP_SECTION_ALIASES[value] || value;
}

export function filterHelpSections(sections = [], query = "") {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return sections;
  return sections.filter((section) => {
    const haystack = normalizeArabicSearchText(`${section.title || ""} ${section.id || ""} ${section.searchText || ""}`);
    return haystack.includes(normalizedQuery);
  });
}

export function filterHelpFaqItems(faqItems = [], query = "") {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return faqItems;
  return faqItems.filter((faq) => {
    const haystack = normalizeArabicSearchText(`${faq.question || ""} ${faq.answer || ""}`);
    return haystack.includes(normalizedQuery);
  });
}

export function createHelpShortcutList(shortcutActions = [], effectiveShortcuts = {}, disabledToken = "disabled") {
  return shortcutActions.map((shortcut) => {
    const value = effectiveShortcuts[shortcut.id] || shortcut.defaultKeys || disabledToken;
    const disabled = value === disabledToken;
    return {
      id: shortcut.id,
      keys: disabled ? ["معطّل"] : String(value).split("+"),
      description: shortcut.label,
      disabled,
      category: shortcut.category
    };
  });
}
