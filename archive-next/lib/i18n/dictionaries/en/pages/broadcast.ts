export const broadcast = {
  errors:{ refresh:"Unable to refresh the broadcast room.", lock:"Unable to update the control lock.", save:"Unable to save the rundown.", operation:"Unable to complete the operation" },
  messages:{ rundownUnloaded:"The rundown has not been loaded yet", ready:"Ready", lastHeartbeat:"Last heartbeat: {time}", latestRundown:"Latest rundown loaded", newRundown:"New rundown", lockReleased:"Control lock released.", lockReserved:"Control lock reserved for this item.", saved:"Saved: {time}" },
  toolbar:{ eyebrow:"Local simulation", title:"Operational broadcast and review room", description:"Broadcast clock, presence, control lock, shared rundown, and timed notes over the same collaboration and review APIs.", participants:"{count} participants", safetyAction:"Review broadcast simulation" },
  settings:{ aria:"Broadcast room settings", room:"Room", mediaPath:"Media path/ID", status:"Status", viewing:"Viewing", reviewing:"Reviewing", editing:"Editing" },
  player:{ aria:"Player and broadcast simulation", title:"Player", refresh:"Refresh", mediaTitle:"Local broadcast source", emptyTitle:"Enter a media path to begin", emptyDescription:"The simulation uses the file path as the resource for review and locking.", playback:"Playback status", playing:"Playing", stopped:"Stopped", controlLock:"Control lock", available:"Available", releaseLock:"Release control lock", reserveLock:"Reserve control lock" },
  presence:{ aria:"Presence and rundown", title:"Presence", description:"Works through heartbeats with Reverb when available.", empty:"There is no active presence yet." },
  rundown:{ title:"Rundown", placeholder:"00:00 Opening\n00:30 Main shot\n01:15 Edit note", saving:"Saving...", save:"Save rundown" },
  notes:{ aria:"Timed notes", title:"Operational notes", description:"A note is attached to the current player time.", label:"Note", time:"Time", add:"Add note", empty:"There are no notes yet." }
} as const;
