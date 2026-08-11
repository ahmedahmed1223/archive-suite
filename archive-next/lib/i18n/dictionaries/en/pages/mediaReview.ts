export const mediaReview = {
  errors: {
    loadComments: "Unable to load review comments.",
    addComment: "Unable to add the comment.",
    updateComment: "Unable to update the comment.",
    operationFailed: "Unable to complete the operation"
  },
  toolbar: {
    eyebrow: "Shot review",
    title: "Visual review with timed comments",
    description: "Play the media, jump to a specific timecode, and draw a rectangle over the frame when needed to document the note precisely.",
    commentCount: "{count} comments",
    drawingMode: "Drawing mode",
    reviewMode: "Viewing comments"
  },
  safetyAction: "Add a review comment",
  media: {
    ariaLabel: "Player and comment form",
    sourceLabel: "Media path or review-session ID",
    sourcePlaceholder: "media/file.mp4",
    sourceDescription: "The same field is used to play the media and link its review comments.",
    stopDrawing: "Stop drawing",
    drawAnnotation: "Draw a note on the frame",
    clearDrawing: "Clear drawing ({count})",
    emptyTitle: "Enter a media path to start the review.",
    emptyDescription: "Use the same field above to play the media and link its review comments."
  },
  form: {
    title: "Add comment",
    playbackTime: "From playback time",
    manualTime: "Manual time",
    currentPlaybackTime: "Use the current playback time",
    timecodeSeconds: "Timecode in seconds",
    comment: "Comment",
    commentPlaceholder: "Write the note here",
    adding: "Adding",
    addComment: "Add comment"
  },
  comments: {
    ariaLabel: "Review comments",
    title: "Comments",
    loadingDescription: "Loading comments...",
    orderedDescription: "Ordered by time within the media.",
    errorDescription: "Unable to load comments.",
    emptyDescription: "No comments yet.",
    retry: "Try again",
    emptyTitle: "No comments yet.",
    emptyStateDescription: "Start by adding the first comment from the form beside the player.",
    reopen: "Reopen",
    resolve: "Resolve"
  }
} as const;
