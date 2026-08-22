const englishHighlights = [
  { title: "Stable daily navigation", description: "Every team starts its day from four consistent destinations that respect permissions, with the work inbox as the archivist’s entry point." },
  { title: "Unified states and filters", description: "Loading, empty, error, and retry follow one contract across pages, while advanced filters wait behind a clear disclosure." },
  { title: "Documented release details", description: "The Help page provides the complete bilingual change log for this release." },
] as const;

export const whatsNewDialog = {
  title: "What’s new in Archive Suite 1.4.0",
  description: "This release completes bilingual application support with equal feature coverage in Arabic and English.",
  highlights: englishHighlights,
  next: "Explore this release",
  steps: ["Read the release page for the complete change log.", "Choose your language from Settings.", "Use Help whenever you need more detail."],
  hide: "Do not show future what’s-new updates on this device",
  help: "View release details",
  start: "Start working",
} as const;
