export const mediaStudio = {
  eyebrow: "Unified studio",
  title: "Media studio",
  description: "Player, transcript, comments, versions, and task context for one record's media, in a single workspace.",
  missingRecordTitle: "No record selected",
  missingRecordDescription: "Open the studio from a record's detail page so it has a real record to load.",
  browseArchive: "Browse the archive to pick a record",
  openMediaJobs: "Media jobs",
  loadingRecord: "Loading the record…",
  loadErrorTitle: "Could not load this record",
  attachmentNotFoundTitle: "Attachment not found",
  attachmentNotFoundDescription: "This attachment is no longer listed on the record. It may have been removed.",
  noSourceTitle: "No playable media file",
  noSourceDescription: "This record has no file path recorded in its metadata, so there is nothing to stream.",
  recordLabel: "Record",
  attachmentLabel: "Attachment",
  shortcutsHint: "Space to play or pause · Left/Right arrow to seek 5 seconds — disabled while typing.",
  mobileNotice: "Simplified view: player, transcript, and comments. Open on a wider screen for versions and tasks.",
  techSpec: {
    title: "Technical specifications",
    dimensionsLabel: "Dimensions",
    aspectRatioLabel: "Aspect ratio",
    durationLabel: "Duration",
    bitrateLabel: "Bitrate",
    estimatedBadge: "Estimated",
    unavailable: "Play the file to measure its technical specifications."
  },
  transcript: {
    title: "Timed transcript",
    empty: "This record has no saved transcript yet.",
    ariaLabel: "Synchronized transcript"
  },
  comments: {
    title: "Comments",
    description: "Notes visible to the team working on this record.",
    countLabel: "comments",
    newCommentLabel: "New comment",
    bodyPlaceholder: "Write a comment…",
    postButton: "Post comment",
    postingButton: "Posting…",
    postError: "Could not post the comment.",
    loadError: "Could not load comments.",
    loadingLabel: "Loading comments…",
    empty: "No comments yet.",
    anonymousAuthor: "Unknown",
    deleteAriaLabel: "Delete comment",
    deleteConfirm: "Delete this comment?"
  },
  versions: {
    title: "Versions & derivatives"
  },
  timeline: {
    title: "Timeline",
    description: "Point-in-time and range markers, visible to the team working on this media.",
    liveLabel: "Live",
    pollingLabel: "Polling",
    loadingLabel: "Loading timeline comments…",
    loadError: "Could not load timeline comments.",
    durationUnavailable: "Play the file once to enable the marker strip.",
    typeLabel: "Type",
    types: {
      issue: "Issue",
      suggestion: "Suggestion",
      highlight: "Highlight",
      chapter: "Chapter"
    },
    markRangeButton: "Mark range start",
    clearRangeButton: "Clear range",
    bodyLabel: "New marker",
    bodyPlaceholder: "Describe what happens at this point…",
    postButton: "Add marker",
    postingButton: "Adding…",
    postError: "Could not add the marker.",
    empty: "No timeline markers yet.",
    jumpAriaLabel: "Jump to this marker's timestamp",
    resolvedLabel: "Resolved",
    resolveButton: "Resolve",
    reopenButton: "Reopen",
    deleteAriaLabel: "Delete marker",
    deleteConfirm: "Delete this marker?",
    stripAriaLabel: "Timeline marker strip"
  },
  tasks: {
    title: "Tasks",
    comingSoonTitle: "Task linking is not available yet",
    comingSoonDescription: "Linked work tasks ship in a later update."
  }
} as const;
