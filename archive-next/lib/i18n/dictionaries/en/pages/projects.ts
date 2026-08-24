export const projects = {
  toolbar: {
    eyebrow: "Montage",
    title: "Projects / montage",
    description: "Collect archive clips on a timeline, order them, set in and out points, then export JSON or EDL.",
    projectCount: "{count} project(s)",
    clipCount: "{count} clip(s)",
    duration: "Duration {duration}",
    workProjects: "Work projects",
    openArchive: "Open archive"
  },
  feedback: {
    title: "Projects",
    projectCreated: "Created project “{name}”.",
    projectDeleted: "Deleted project “{name}”.",
    invalidRange: "The end point must be after the start point.",
    clipAdded: "Added “{title}” to the timeline.",
    exportMp4Queued: "The MP4 export job was submitted and is processing in the background.",
    exportJson: "Downloaded the timeline JSON file.",
    exportEdl: "Downloaded the EDL (CMX3600) file.",
    exportPremiere: "Downloaded the Premiere XML file.",
    exportFcpXml: "Downloaded the FCPXML file."
  },
  dialogs: {
    deleteProjectTitle: "Delete project",
    deleteProjectMessage: "Deleting the local project cannot be undone: “{name}”. No source record will change.",
    deleteClipTitle: "Delete clip",
    deleteClipMessage: "Deleting this clip from the timeline cannot be undone: “{title}”. The source record will not change.",
    deleteConfirm: "Delete"
  },
  projectsList: {
    ariaLabel: "Projects list",
    title: "Projects",
    newNamePlaceholder: "New project name...",
    newNameAriaLabel: "New project name",
    create: "Create project",
    empty: "No projects yet. Create one to begin collecting clips. Projects are stored locally in this browser.",
    savedAriaLabel: "Saved projects",
    delete: "Delete",
    noSelectionTitle: "No project selected.",
    noSelectionDescription: "Create a project or select one from the list to open the timeline editor."
  },
  clipSearch: {
    ariaLabel: "Add clips from the archive",
    title: "Add clip from archive",
    resultsCount: "{count} result(s)",
    searchPlaceholder: "Search archive records...",
    searchAriaLabel: "Search archive records",
    inLabel: "Start (s)",
    outLabel: "End (s)",
    inAriaLabel: "Start point in seconds",
    outAriaLabel: "End point in seconds",
    searching: "Searching...",
    search: "Search",
    noResults: "No matching records.",
    unspecified: "Unspecified",
    add: "Add to timeline",
    open: "Open"
  },
  timeline: {
    ariaLabel: "Project timeline",
    title: "Timeline — {name}",
    empty: "No clips yet. Search the archive above and add clips to the timeline.",
    invalidPoints: " — invalid points",
    inLabel: "Start",
    outLabel: "End",
    inAriaLabel: "Start point for {title}",
    outAriaLabel: "End point for {title}",
    moveUpAriaLabel: "Move {title} up",
    moveDownAriaLabel: "Move {title} down",
    delete: "Delete",
    deleteNote: "Deleting the clip changes only the timeline; the source record is not affected."
  },
  export: {
    ariaLabel: "Export project",
    title: "Export",
    validCount: "{count} valid clip(s)",
    json: "Export JSON",
    edl: "Export EDL",
    premiere: "Export Premiere XML",
    fcpXml: "Export FCPXML",
    mp4: "Export MP4",
    mp4Hint: "MP4 export runs as an asynchronous server job that assembles clips with ffmpeg in the background without blocking the request.",
    pathResolutionError: "Unable to determine a file path for some clips: {titles}. Every clip must have a valid file path before continuing.",
    status: "MP4 export status: {status}",
    statusLabels: {
      queued: "Queued",
      processing: "Processing",
      completed: "Completed",
      failed: "Failed",
      canceled: "Canceled"
    },
    download: "Download MP4 file",
    failed: "Export failed: {error}",
    running: "Running in the background..."
  },
  changeImpactEntity: "project"
} as const;
