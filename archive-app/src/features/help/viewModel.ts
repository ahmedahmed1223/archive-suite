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
} as const;

type HelpSectionAlias = keyof typeof HELP_SECTION_ALIASES;

interface HelpSection {
  id?: string;
  title?: string;
  searchText?: string;
}

interface HelpFaqItem {
  question?: string;
  answer?: string;
}

interface PageManifestEntry {
  id?: string;
  group?: string;
  heavy?: boolean;
  meta?: {
    title?: string;
    breadcrumb?: string;
    hint?: string;
    helpSection?: string;
  };
}

interface HelpContextCard {
  id: string;
  title: string;
  breadcrumb: string;
  hint: string;
  helpSection: string;
  group: string;
  heavy: boolean;
  keywords: string;
}

interface ShortcutAction {
  id: string;
  label?: string;
  category?: string;
  defaultKeys?: string;
}

type EffectiveShortcuts = Record<string, string | undefined>;

export function normalizeHelpSectionId(sectionId: unknown, fallback = "getting-started"): string {
  const value = String(sectionId || "").trim();
  if (!value) return fallback;
  return HELP_SECTION_ALIASES[value as HelpSectionAlias] || value;
}

export function filterHelpSections<TSection extends HelpSection>(sections: TSection[] = [], query = ""): TSection[] {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return sections;
  return sections.filter((section) => {
    const haystack = normalizeArabicSearchText(`${section.title || ""} ${section.id || ""} ${section.searchText || ""}`);
    return haystack.includes(normalizedQuery);
  });
}

export function filterHelpFaqItems<TFaqItem extends HelpFaqItem>(faqItems: TFaqItem[] = [], query = ""): TFaqItem[] {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return faqItems;
  return faqItems.filter((faq) => {
    const haystack = normalizeArabicSearchText(`${faq.question || ""} ${faq.answer || ""}`);
    return haystack.includes(normalizedQuery);
  });
}

export function createHelpContextCards(pageManifest: PageManifestEntry[] = []): HelpContextCard[] {
  return pageManifest
    .filter((page): page is PageManifestEntry & { id: string; meta: { title: string; helpSection: string } } =>
      Boolean(page?.id && page?.meta?.title && page?.meta?.helpSection)
    )
    .map((page) => {
      const title = page.meta.title;
      const breadcrumb = page.meta.breadcrumb || title;
      const hint = page.meta.hint || "";
      const helpSection = normalizeHelpSectionId(page.meta.helpSection);
      return {
        id: page.id,
        title,
        breadcrumb,
        hint,
        helpSection,
        group: page.group || "general",
        heavy: Boolean(page.heavy),
        keywords: [title, breadcrumb, hint, helpSection].filter(Boolean).join(" ")
      };
    });
}

export function filterHelpContextCards<TCard extends Pick<HelpContextCard, "keywords">>(
  cards: TCard[] = [],
  query = ""
): TCard[] {
  const normalizedQuery = normalizeArabicSearchText(query);
  if (!normalizedQuery) return cards;
  return cards.filter((card) => normalizeArabicSearchText(card.keywords || "").includes(normalizedQuery));
}

export function createHelpShortcutList(
  shortcutActions: ShortcutAction[] = [],
  effectiveShortcuts: EffectiveShortcuts = {},
  disabledToken = "disabled"
) {
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
