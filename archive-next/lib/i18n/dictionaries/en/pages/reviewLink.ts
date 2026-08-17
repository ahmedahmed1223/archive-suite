export const reviewLink = {
  sectionAriaLabel: "Public review link",
  eyebrow: "Public review",
  title: "Public review link",
  description: "Shows only the review details and comments allowed for this link, while the server continues to enforce its token and permissions.",
  protectedCommentsBadge: "Protected comments",
  limitedPublicAccessBadge: "Limited public access",
  contentTitle: "Review content",
  contentDescription: "View comments and notes for this record in a secure context.",
  viewer: {
    loading: "Loading review link",
    loadingDescription: "Retrieving the comments and data allowed by this link.",
    error: "Could not load the review link",
    content: "Review link content",
    notice: "This public review link does not allow asset management or permission changes.",
    asset: "Asset",
    permission: "Permission",
    expires: "Expires",
    expiryEstimate: "Access estimate",
    expiryHint: "A local estimate based on the stated date; enforcement is handled by the server.",
    empty: "There are no comments available through this link.",
    expiryLabels: {
      noExpiry: "No expiry",
      unavailable: "Date unavailable",
      expired: "Expired",
      soon: "Expires soon",
      active: "Active"
    },
    media: {
      title: "Reviewed media",
      unavailable: "No media is available through this link yet.",
      watermarkBanner: "Watermarked review copy — not for distribution",
      downloadLabel: "Download"
    },
    decision: {
      title: "Your decision",
      reviewerNameLabel: "Your name",
      reviewerNamePlaceholder: "Enter your name",
      reviewerEmailLabel: "Your email (optional)",
      notesLabel: "Notes (optional)",
      notesPlaceholder: "Add context for your decision",
      approve: "Approve",
      requestChanges: "Request changes",
      submitting: "Submitting…",
      submitted: "Decision recorded",
      approvedFull: "Approved — required approvals reached",
      approvalsProgress: "Approvals received: {received} of {required}",
      changesRequested: "Changes requested",
      reviewerNameRequired: "Enter your name before submitting a decision.",
      errorGeneric: "Could not submit your decision. The link may have expired.",
      sessionState: "Review status"
    }
  }
} as const;
