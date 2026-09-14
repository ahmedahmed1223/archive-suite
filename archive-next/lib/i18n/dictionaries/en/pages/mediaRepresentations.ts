export const mediaRepresentations = {
  title: "Media representations",
  description: "Only actual copies tied to the current source version are listed.",
  count: "{count} representations",
  loading: "Loading media representations...",
  error: "Could not load media representations: {message}",
  retry: "Retry",
  emptyTitle: "No representations recorded",
  emptyDescription: "Add a source or run media processing to list actual copies here.",
  listAriaLabel: "Current media representations",
  types: { source: "Current source", preservation: "Preservation copy", mezzanine: "Mezzanine", proxy: "Access proxy", thumbnail: "Thumbnail", waveform: "Waveform", text: "Text", output: "Output" },
  status: { pending: "Pending", processing: "Processing", ready: "Ready", failed: "Failed" },
} as const;
