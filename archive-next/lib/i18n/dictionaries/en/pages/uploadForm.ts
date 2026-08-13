export const uploadForm = {
  stepFiles: "Files",
  stepMetadata: "Metadata",
  stepReview: "Review",

  heading: "Archive intake path",
  subheading: "Multi-file upload with templates, metadata, and video fields before creating records.",

  modeGroupAriaLabel: "Intake mode",
  modeGuided: "Guided",
  modeQuick: "Quick",

  stepsAriaLabel: "Archive intake steps",

  draftRecoveredTitle: "Draft recovered",
  draftRecoveredHelper: "Only re-select the files; the archiving data and previous step are already saved on this device.",
  draftRecoveredDismiss: "OK",

  filesStepAriaLabel: "Select files",
  dropzoneLabel: "Drag files here or click to select",
  dropzoneHelper: "Video, audio, images, or documents · up to 600MB per file · video duration and resolution are read automatically",

  removeFileButton: "Remove",
  noFilesHelper: "Choose one or more files. In quick mode you can go straight to review.",

  duplicateFilesTitle: "Duplicate files in the list",
  duplicateFilesHelper: "Check before continuing: {files}",

  metadataStepAriaLabel: "Archive metadata",
  templateLabel: "Intake template",
  noTemplateOption: "No template",

  titlePrefixLabel: "Title or title prefix",
  titlePrefixPlaceholder: "Example: Archive interview",

  typeLabel: "Type",
  subtypeLabel: "Subtype",
  tagsLabel: "Tags",
  tagsPlaceholder: "archive, interviews, 2026",
  summaryLabel: "Short description",
  folderLabel: "Destination folder",

  videoFieldsHeading: "Video fields",
  videoFieldsHelper:
    "Duration and resolution are auto-filled from the file — adjust as needed. They're saved under metadata.video for use in transcription and review.",
  videoLanguageLabel: "Language",
  videoDurationLabel: "Duration in seconds",
  videoResolutionLabel: "Resolution",
  videoFrameRateLabel: "Frame rate",

  reviewStepAriaLabel: "Review intake",
  processingTimeLegend: "Processing time",
  processNowOption: "Process now",
  processScheduledOption: "Schedule processing",
  scheduleDateLabel: "Processing date",
  detectedZoneLabel: "Detected time zone",

  fileCountLabel: "File count",
  totalSizeLabel: "Total size",
  noTagsValue: "No tags",

  quickModeHelper: "Quick mode uses each file's name as the title and saves only the basic metadata.",

  previousButton: "Previous",
  nextButton: "Next",
  clearButton: "Clear",

  uploadingFile: "Uploading {file}...",
  uploadAndScheduleButton: "Upload and schedule",
  createRecordsButton: "Create records",

  completePartialTitle: "Intake partially completed",
  completeScheduledTitle: "Processing scheduled",
  completeSuccessTitle: "Intake completed",

  completeSummary: "{succeeded} of {total} succeeded.",
  nextActionSuffix: " Next step: {label}.",

  resultRecordSuffix: " - record {id}",
  resultScheduledSuffix: "{file} - scheduled",
  resultErrorFormat: "{file}: {message}",

  retryFailedButton: "Retry failed",
  viewScheduledLink: "View scheduled uploads",

  uploadMetadataError: "Upload succeeded but saving metadata failed: {error}",
  scheduleCreateError: "File uploaded but scheduling failed: {error}"
};
