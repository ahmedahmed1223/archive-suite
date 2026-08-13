const englishHighlights = [
  { title: "Guided first use", description: "Follow a clear setup path step by step, then resume where you left off when you return." },
  { title: "A more flexible Arabic interface", description: "Mobile navigation is improved and date, time, and time-zone display can now be managed centrally." },
  { title: "Live media-processing status", description: "See media-job progress, queue status, and connection state with a safe fallback when live updates drop." },
] as const;

export const whatsNewDialog = {
  title: "What’s new in Archive Suite 1.2",
  description: "This release brings practical improvements to first use, display preferences, and media-job tracking.",
  highlights: englishHighlights,
  next: "Explore this release",
  steps: ["Read the release page for the complete change log.", "Adjust date and time display from Settings when needed.", "Follow media jobs from the active-jobs list."],
  hide: "Do not show future what’s-new updates on this device",
  help: "View release details",
  start: "Start working",
} as const;
