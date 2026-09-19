const englishHighlights = [
  { title: "Media versioning", description: "Media representations are version-pinned; a stale derivative is never presented as current or streamable." },
  { title: "Time-aware search", description: "Search results open transcripts and descriptions at their recorded moments, not from an assumed frame rate." },
  { title: "Rights management in-product", description: "External review links re-check live public rights on every media request; decisions are recorded in the audit trail." },
] as const;

export const whatsNewDialog = {
  title: "What's new in Archive Suite 2.0.0",
  description: "This release adds media versioning, time-aware search, and in-product rights management.",
  highlights: englishHighlights,
  next: "Explore this release",
  steps: [
    "Read the release page for the complete change log.",
    "Try time-aware search on a media asset.",
    "Check rights status on any media request.",
  ],
  hide: "Do not show future what's-new updates on this device",
  help: "View release details",
  start: "Start working",
} as const;
