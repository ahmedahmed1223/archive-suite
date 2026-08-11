export const plugins = {
  filters: {
    status: { all: "All statuses", reviewed: "Reviewed and approved", draft: "Draft", blocked: "Blocked" },
    category: { all: "All categories", metadata: "Metadata", workflow: "Workflow", ai: "Artificial intelligence", integration: "Integration" }
  },
  risk: { low: "Low", medium: "Medium", high: "High" },
  boolean: { yes: "Yes", no: "No" },
  policy: {
    unavailableTitle: "Runtime policy",
    unavailableDescription: "The runtime policy has not loaded yet.",
    ariaLabel: "Plugin runtime policy",
    title: "Runtime policy",
    remoteInstall: "Remote installation",
    codeExecution: "Code execution",
    adminReview: "Administrator review"
  },
  permissions: {
    ariaLabel: "Permission summary",
    title: "Requested permissions",
    description: "Groups the permission scopes requested by plugins so risks are visible before approval.",
    pluginCount: "{count} plugins",
    emptyTitle: "No permissions",
    emptyDescription: "Change the filters to view permissions for other plugins."
  },
  card: {
    network: "Network",
    fileSystem: "File system",
    codeExecution: "Code execution",
    dataLeavesTenant: "Data leaves tenant",
    adminApproval: "Administrator approval",
    permissionDetails: "Permission details",
    noPermissions: "No documented permissions for this plugin."
  },
  toolbar: {
    eyebrow: "Secure catalog",
    title: "Plugin marketplace and permission review",
    description: "Browse review-only plugins with a policy that prevents remote installation and code execution in this local runtime.",
    readOnlyCatalog: "Read-only catalog",
    noCodeExecution: "No code execution",
    adminReview: "Administrator review"
  },
  metrics: {
    displayed: "Displayed plugins",
    reviewed: "Reviewed and approved",
    blocked: "Blocked",
    highRiskScopes: "High-risk permission scopes"
  },
  error: {
    title: "Unable to load the plugin catalog",
    description: "{error} — the catalog is for review only; reload the page after checking your permission."
  },
  form: { ariaLabel: "Plugin filters", status: "Status", category: "Category" },
  list: {
    ariaLabel: "Plugin list",
    loadingTitle: "Loading plugins",
    loadingDescription: "Reading the local catalog and runtime policy.",
    emptyTitle: "No matching plugins",
    emptyDescription: "Try clearing the status or category filter."
  }
} as const;
