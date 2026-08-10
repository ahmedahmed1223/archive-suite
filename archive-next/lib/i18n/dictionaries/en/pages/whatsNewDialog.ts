const englishHighlights = [
  { title: "Bilingual Help and User Guide", description: "Read Help and the user guide in Arabic or English; the guide follows the interface language." },
  { title: "Fully supported native operation", description: "Supported native packages are available for Windows and Linux alongside the canonical Docker path." },
  { title: "Choose the interface language in Settings", description: "Set Arabic or English in Settings, and your chosen language is saved for your next visit." },
] as const;

export const whatsNewDialog = {
  title: "What’s new in Archive Suite 1.1",
  description: "This release improves how you start, learn, and run Archive Suite across supported platforms.",
  highlights: englishHighlights,
  next: "What should you do next?",
  steps: ["Choose your interface language in Settings.", "Open the Help chapter for your role and use its task-based guidance.", "Use the supported native package or Docker path that fits your environment."],
  hide: "Do not show future what’s-new updates on this device",
  help: "Open What’s new in Help",
  start: "Start working",
} as const;
