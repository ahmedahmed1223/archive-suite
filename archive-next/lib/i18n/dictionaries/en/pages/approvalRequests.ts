export const approvalRequests = {
  loadingLabel: "Loading approval requests…",
  toolbar: {
    eyebrow: "Dual approval",
    title: "Approval requests",
    description: "Sensitive bulk-macro operations wait here until at least the required number of distinct approvers -- never the submitter -- sign off.",
    refresh: "Refresh"
  },
  submit: {
    ariaLabel: "Submit a bulk macro for approval",
    title: "Submit a bulk macro for approval",
    description: "Only macros with a step type currently marked sensitive in policy can be submitted.",
    macroId: "Bulk macro ID",
    targets: "Targets (store:id, store:id)",
    submit: "Submit for approval",
    submitting: "Submitting…",
    targetsInvalidWarning: "Ignored {count} malformed target(s); each target must use the store:id format."
  },
  errors: {
    load: "Unable to load approval requests.",
    submit: "Unable to submit the approval request.",
    decide: "Unable to record the decision.",
    execute: "Unable to execute the approved request."
  },
  status: {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    executed: "Executed"
  },
  table: {
    ariaLabel: "Approval requests",
    id: "Request",
    operation: "Operation",
    status: "Status",
    approvals: "Approvals",
    requestedBy: "Requested by",
    actions: "Actions"
  },
  actions: {
    approve: "Approve",
    reject: "Reject",
    execute: "Execute",
    selfApprovalBlocked: "You submitted this request; you cannot decide it yourself.",
    alreadyDecided: "You already recorded a decision on this request.",
    confirmApproveTitle: "Approve this bulk macro?",
    confirmApproveMessage: "This approval acts on every target in the request and cannot be undone.",
    confirmRejectTitle: "Reject this bulk macro?",
    confirmRejectMessage: "This rejection acts on every target in the request and cannot be undone.",
    confirmExecuteTitle: "Execute this approved macro?",
    confirmExecuteMessage: "This runs the bulk macro against every target in the request immediately and cannot be undone."
  },
  empty: "No approval requests yet.",
  decidedCount: "{approved} approved, {rejected} rejected"
} as const;
