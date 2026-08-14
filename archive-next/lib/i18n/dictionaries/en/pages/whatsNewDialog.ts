const englishHighlights = [
  { title: "Full bilingual support", description: "Use the application in Arabic or English, including interface labels, operational messages, and workflows." },
  { title: "Consistent workflows", description: "Shortcuts, statuses, dates, and guided journeys follow the language selected in Settings." },
  { title: "Documented release details", description: "The Help page provides the complete bilingual change log for this release." },
] as const;

export const whatsNewDialog = {
  title: "What’s new in Archive Suite 1.2.1",
  description: "This release completes bilingual application support with equal feature coverage in Arabic and English.",
  highlights: englishHighlights,
  next: "Explore this release",
  steps: ["Read the release page for the complete change log.", "Choose your language from Settings.", "Use Help whenever you need more detail."],
  hide: "Do not show future what’s-new updates on this device",
  help: "View release details",
  start: "Start working",
} as const;
