export const projectGroups = {
  loadingLabel: "Loading projects…",
  errors: {
    projectsLoad: "Unable to load work projects.",
    recordsLoad: "Unable to load project materials.",
    create: "Unable to create the project.",
    saveNotes: "Unable to save the notes.",
    linkRecord: "Unable to link the material.",
    saveOrder: "Unable to save the order."
  },
  feedback: {
    created: "The work project was created.",
    notesSaved: "Project notes were saved.",
    recordLinked: "The material was linked to the project.",
    orderSaved: "Material order was saved."
  },
  toolbar: { title: "Work projects", description: "Independent work packages that gather materials with notes and an order stored on the server.", projectCount: "{count} projects" },
  form: { projectName: "Project name", projectNotes: "Project notes", create: "Create project", saveNotes: "Save notes", recordIdPlaceholder: "Material ID", linkRecord: "Link material" },
  empty: { title: "There are no work projects", description: "Create a project to gather and arrange materials." },
  content: { projectsTitle: "Projects", materialsTitle: "Project materials", noMaterials: "There are no linked materials yet." }
} as const;
