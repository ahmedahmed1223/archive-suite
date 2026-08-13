export const timeline = {
  eyebrow: "Chronological view", title: "Timeline", description: "View records by creation or update date, grouped by day, month, or year.",
  day: "Day", month: "Month", year: "Year", refresh: "Refresh", granularity: "Grouping granularity", loading: "Loading records", loadingDescription: "Records are being fetched from the server and prepared for the timeline.", loadError: "Could not load the timeline", unknownError: "Unknown error", loadFailed: "Could not load records: {message}",
  noRecords: "No records yet", noRecordsDescription: "Add records to the archive to see them arranged on the timeline.", openArchive: "Open archive", totalRecords: "Total records", periods: "Periods", displayGranularity: "Display granularity", groups: "Timeline groups", record: "record", records: "records", untitledType: "No type", range: "Range: {value}", recordCount: "{count} records", periodCount: "{count} periods",
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;
