export const collaboration = {
  statusLabels: {
    active: "Active",
    viewing: "Viewing",
    reviewing: "Reviewing",
    editing: "Editing",
    idle: "Idle"
  },
  initial: {
    ready: "Ready",
    noLocksLoaded: "No locks have been loaded yet",
    noDocumentLoaded: "No draft has been loaded yet"
  },
  messages: {
    lastSync: "Last sync: {time}",
    manualUpdate: "Manual refresh: {time}",
    loadedLatestVersion: "Latest version loaded",
    newDraft: "New draft",
    liveUpdate: "Live update from {name}",
    anotherParticipant: "another participant",
    lockReserved: "Reserved {resource} until {expires}",
    unspecifiedTime: "an unspecified time",
    lockReleased: "Lock released.",
    noOwnedLock: "You do not have a lock on this resource.",
    savedVersion: "Version {version} saved",
    conflictKeptMine: "Save blocked: a newer version exists on the server. Your unsaved edits were kept; reload their version to continue."
  },
  errors: {
    liveCollaboration: "Unable to update live collaboration.",
    loadDocument: "Unable to load the draft.",
    refreshPresence: "Unable to refresh presence.",
    acquireLock: "Unable to reserve the resource.",
    releaseLock: "Unable to release the lock.",
    saveDocument: "Unable to save the draft."
  },
  validation: {
    selectResourceToAcquire: "Select a resource before requesting a lock.",
    selectResourceToRelease: "Select a resource before releasing a lock.",
    selectRoomAndResource: "Select a room and resource before saving the draft."
  },
  conflict: {
    title: "Save conflict",
    message: "{name} saved a newer version of this draft while you were editing. Load their version and discard your unsaved edits, or keep your edits and try saving again later?",
    someone: "Another participant",
    loadTheirs: "Load their version",
    keepMine: "Keep my edits"
  },
  toolbar: {
    syncing: "Syncing",
    activeSync: "Sync active",
    title: "Live collaboration",
    description: "An operational room for showing active presence, reserving editing resources, and saving a shared server-backed draft.",
    activeWindow: "Activity window: {seconds} seconds",
    activeParticipants: "{count} active participants",
    editingLocks: "{count} editing locks",
    safetyAction: "Review collaboration status"
  },
  room: {
    title: "Room setup",
    description: "Set the room, resource, and status, then let this page send presence heartbeats automatically.",
    roomKey: "Room key",
    resource: "Resource",
    status: "Status",
    refreshing: "Refreshing",
    refreshPresence: "Refresh presence",
    acquiring: "Reserving",
    acquireResource: "Reserve resource",
    releasing: "Releasing",
    releaseLock: "Release lock",
    lockStatus: "Lock status"
  },
  participants: {
    title: "Participants now",
    description: "The latest active presence in the current room.",
    refreshError: "Unable to refresh presence",
    connectionActive: "Connection active",
    emptyTitle: "There are no active participants yet.",
    emptyDescription: "The latest presence heartbeats will appear here when participants join the room.",
    unspecifiedResource: "No resource specified",
    noTime: "No time available"
  },
  document: {
    title: "Resource draft",
    description: "Shared text with optimistic versioning for the current resource.",
    contentLabel: "Resource draft content",
    saving: "Saving",
    save: "Save draft"
  },
  locks: {
    title: "Editing locks",
    description: "Locks prevent writing conflicts on the same resource until they expire or are released manually.",
    emptyTitle: "There are no active locks in this room.",
    emptyDescription: "Reserve a resource to prevent editing conflicts when working on the same item.",
    expiresAt: "Expires: {expires}",
    unspecified: "Unspecified"
  }
} as const;
