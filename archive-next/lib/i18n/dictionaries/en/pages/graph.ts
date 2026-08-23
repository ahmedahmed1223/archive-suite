export const graph = {
  unavailableDate: "Unavailable",
  canvasAriaLabel: "Record relationship map",
  nodePanel: { emptyTitle: "Node details", emptyDescription: "Select a node in the graph to view its links and operational details.", record: "Record", connections: "{count} connections", identifier: "Identifier", lastUpdated: "Last updated", openRecord: "Open record", nearbyLinks: "Nearby links", deleteRelation: "Delete relationship", noVisibleLinks: "No links are visible under the current filters." },
  relationForm: { sourceTargetRequired: "Select the relationship source and target.", selfRelation: "A record cannot be linked to itself.", saved: "Relationship saved.", saveFailed: "Unable to save the relationship.", title: "Add a manual relationship", from: "From", sourcePlaceholder: "Select the source record", type: "Relationship type", to: "To", targetPlaceholder: "Select the target record", note: "Note", notePlaceholder: "Reason or context for the relationship", save: "Save relationship" },
  errors: { load: "Unable to load the relationship map.", save: "Unable to save the relationship.", delete: "Unable to delete the relationship." },
  deleteDialog: { title: "Delete relationship", message: "The relationship \"{label}\" will be permanently deleted. Continue?", confirm: "Delete" },
  toolbar: { eyebrow: "Relationship map", title: "Relationship map", description: "Link archive records manually and explore relationships inferred from tags and types in one place.", nodes: "{count} nodes", connections: "{count} connections", manual: "{count} manual", inferred: "{count} inferred", refresh: "Refresh", searchPlaceholder: "Search nodes", searchAriaLabel: "Search relationship map nodes", tagFilterAriaLabel: "Filter by tag", allTags: "All tags", layoutAriaLabel: "Layout mode", layoutAuto: "Automatic", layoutOrganic: "Organic", layoutConcentric: "Concentric", layoutCircle: "Circle" },
  lenses: { ariaLabel: "Relationship map grouping lenses by type", recordCount: "{count} records" },
  loading: "Loading relationship map...",
  loadErrorTitle: "Unable to load relationships",
  emptyGraph: { title: "There are not enough records to draw relationships", description: "Add records to the archive, then return to this page to see the graph.", addRecord: "Add record" },
  workspace: { ariaLabel: "Relationship map workspace", allNetwork: "Entire network", focusSelected: "Focus selected", loadMore: "Load more", filteredNodes: "{count} nodes under the current filters", noMatchingNodes: "No matching nodes", noMatchingNodesDescription: "Relax the type or tag filters to view the graph.", cannotCreate: "You do not have permission to create new relationships between records." },
} as const;
