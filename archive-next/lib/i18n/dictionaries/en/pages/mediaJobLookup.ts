export const mediaJobLookup = {
  validation: { jobIdRequired: "Enter a job ID before checking.", reviewData: "Review the check data." },
  operations: { thumbnail: "Thumbnail", transcode: "Transcode", transcription: "Transcription", ocr: "OCR text extraction", montageExport: "Montage export" },
  statuses: { queued: "Queued", processing: "Processing", completed: "Completed", failed: "Failed", canceled: "Canceled" },
  form: {
    ariaLabel: "Media-job lookup",
    title: "Check a specific job",
    description: "Quickly verify a media job's status and result from the server.",
    directCheck: "Direct check",
    jobId: "Job ID",
    jobIdPlaceholder: "Media-job ID",
    advancedOptions: "Advanced administrator options",
    accessTokenDescription: "Use an alternate access token only when checking a job in a different session or environment.",
    accessToken: "Access token",
    accessTokenPlaceholder: "Optional Bearer token",
    checking: "Checking...",
    submit: "Check job status",
    found: "The job was found. Current status: {status}; operation: {operation}.",
    idle: "Enter a job ID to view its status from the server."
  }
} as const;
