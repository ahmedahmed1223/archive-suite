export const safetyPreview = {
  operationLabels: { delete: "Test deletion", restore: "Test restoration" },
  errors: {
    loadScenarios: "Unable to load simulation scenarios.",
    noIdentifiers: "Enter at least one test identifier.",
    runPreview: "Unable to run the simulation."
  },
  results: {
    conflict: "Conflict",
    notFound: "Not found",
    simulated: "Simulated",
    unchanged: "No change",
    conflictDetail: "The identifier cannot be restored because a live copy exists in the synthetic environment.",
    notFoundDetail: "The identifier does not exist in the synthetic simulation data.",
    simulatedDetail: "The simulation completed without affecting production."
  },
  toolbar: {
    eyebrow: "Test simulation",
    title: "Safety preview workspace",
    description: "A protected simulation that uses synthetic data only; no production data is deleted or restored.",
    refresh: "Refresh scenarios",
    safetyAction: "Run a deletion or restoration simulation"
  },
  controls: {
    ariaLabel: "Safety simulation controls",
    title: "Simulation controls",
    description: "All identifiers and results are in a temporary synthetic environment.",
    unauthorizedTitle: "You do not have permission to run the simulation",
    unauthorizedDescription: "Viewers can review the policy only; running is available to Editors and Administrators.",
    scenario: "Scenario",
    operation: "Operation",
    identifiers: "Test identifiers",
    loading: "Loading...",
    running: "Running simulation...",
    run: "Run simulation"
  },
  metrics: {
    ariaLabel: "Synthetic counter comparison",
    liveBefore: "Live before",
    liveAfter: "Live after",
    trashBefore: "Trash before",
    trashAfter: "Trash after"
  },
  table: {
    sectionAriaLabel: "Synthetic simulation results",
    title: "Simulation results",
    expiresAt: "Preview expires at {time}",
    tableAriaLabel: "Simulation item results",
    identifier: "Identifier",
    result: "Result",
    details: "Details"
  }
} as const;
