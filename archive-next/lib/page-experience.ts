// V14-UX-007 (Task 7): every navigable page belongs to one experience
// group. The group decides which interaction contract the page follows
// (primary action, disclosure of secondary tools, state surface).
// Routes stay the source of truth in e2e/fixtures/route-inventory.ts.

export type PageExperienceGroup =
  | "daily"
  | "library"
  | "media"
  | "collaboration"
  | "administration"
  | "public";

export const PAGE_EXPERIENCE_GROUPS: Readonly<
  Record<PageExperienceGroup, readonly string[]>
> = {
  daily: [
    "/",
    "/activity",
    "/daily",
    "/inbox",
    "/work-inbox",
    "/notifications",
    "/uploads",
    "/uploads/scheduled",
    "/copilot"
  ],
  library: [
    "/archive",
    "/archive/[id]",
    "/search",
    "/search/saved",
    "/collections",
    "/tags",
    "/types",
    "/vocabulary",
    "/metadata-templates",
    "/favorites",
    "/reading-lists",
    "/discover",
    "/files",
    "/trash",
    "/duplicates",
    "/graph",
    "/map",
    "/timeline"
  ],
  media: [
    "/media/studio",
    "/media/jobs",
    "/media/play",
    "/media/review",
    "/media/compare",
    "/transcriber",
    "/ingest"
  ],
  collaboration: [
    "/projects",
    "/project-tasks",
    "/project-groups",
    "/kanban",
    "/collaboration",
    "/shares",
    "/shares/with-me",
    "/approval-requests",
    "/delegations",
    "/rights",
    "/broadcast"
  ],
  administration: [
    "/settings",
    "/settings/users",
    "/status",
    "/system/control",
    "/data-center",
    "/backup",
    "/sync",
    "/automation",
    "/plugins",
    "/reports",
    "/analytics",
    "/errors"
  ],
  public: [
    "/login",
    "/first-run",
    "/catalog",
    "/share/[token]",
    "/review/[token]",
    "/help",
    "/help/releases/[version]",
    "/safety-preview"
  ]
};

export function getPageExperienceGroup(route: string): PageExperienceGroup | null {
  return (
    (Object.entries(PAGE_EXPERIENCE_GROUPS) as Array<[PageExperienceGroup, readonly string[]]>).find(
      ([, routes]) => routes.includes(route)
    )?.[0] ?? null
  );
}
