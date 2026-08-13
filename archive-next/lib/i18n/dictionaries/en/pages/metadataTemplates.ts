export const metadataTemplates = {
  errors: {
    loadTemplates: "Unable to load the template library.",
    saveFieldOwners: "Unable to save field ownership.",
    invalidFields: "Template fields must be a valid JSON object.",
    saveTemplate: "Unable to save the template.",
    loadVersions: "Unable to load template versions.",
    toggleTemplate: "Unable to change the template status.",
    publishTemplate: "Unable to publish the template.",
    restorePublished: "Unable to restore the published version."
  },
  toolbar: {
    eyebrow: "Central management",
    title: "Department template library",
    description: "Reusable templates by department, with usage roles and saved versions. Editing a template does not change any previously saved item.",
    settings: "Settings",
    departmentFilter: "Filter by department",
    departmentPlaceholder: "Example: news"
  },
  form: {
    editTitle: "Edit template",
    newTitle: "New department template",
    description: "Choose the department before saving and specify who can use it.",
    newTemplate: "New template",
    name: "Name",
    owningDepartment: "Owning department",
    itemType: "Item type (optional)",
    defaultTags: "Default tags",
    tagsPlaceholder: "News, breaking",
    usageRoles: "Usage roles",
    defaultFields: "Default fields (JSON)",
    enabled: "Available for use",
    saveVersion: "Save new version",
    createTemplate: "Create template"
  },
  available: {
    title: "Available templates",
    description: "A user sees only the templates their role allows; editors also see disabled templates to manage them.",
    emptyTitle: "There are no templates for this department.",
    emptyDescription: "Change the filter or add the first department template.",
    department: "Department: {department}",
    general: "General",
    draft: "Draft {version}",
    published: "Published {version}",
    noTags: "No tags",
    tagSeparator: ", ",
    enabled: "Enabled",
    disabled: "Disabled",
    versions: "Versions",
    publishDraft: "Publish draft",
    edit: "Edit",
    disable: "Disable",
    enable: "Enable"
  },
  preview: {
    title: "Value and version preview",
    description: "The preview is read-only; it does not write any data to an item before the user's decision.",
    empty: "Choose Edit to preview the current template values.",
    version: "Version {version}",
    restore: "Restore as published"
  },
  metrics: {
    title: "Department metrics",
    templates: "{count} templates",
    published: "{count} published",
    qualityRules: "{count} quality rules",
    records: "{count} items",
    missingFields: "Missing fields: {fields}",
    noEnabledRules: "No enabled rules"
  },
  owners: {
    title: "Field ownership",
    description: "The owner is suggested in information requests; this does not prevent an authorized editor from correcting or explicitly assigning it.",
    fieldPlaceholder: "Field name, or * for all fields",
    assigneePlaceholder: "Owner",
    save: "Save owner",
    remove: "Remove"
  },
  quality: {
    loadError: "Could not load quality rules.", saveSuccess: "Quality rule saved.", saveError: "Could not save the rule.", previewError: "Preview failed.", selectDepartment: "Select a department to view its quality rules.", title: "Department quality", description: "The preview explains why a record is not ready and does not prevent editing it.", rules: "{count} rules", itemType: "Item type", requiredFields: "Required fields", requiredFieldsPlaceholder: "summary, date", previewMissing: "Preview missing fields", saveRule: "Save rule", ready: "Ready according to the rule.", notReady: "Not ready: {fields}", fieldSeparator: ", "
  }
} as const;
