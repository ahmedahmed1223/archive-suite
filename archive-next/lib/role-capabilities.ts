import type { NavigationRole } from "@/lib/navigation";

export type Capability =
  | "records.create"
  | "records.edit"
  | "records.bulkDelete"
  | "users.manage"
  | "system.control"
  | "automation.manage"
  | "backup.manage"
  | "rights.manage"
  | "ingest.manage";

const allCapabilities: readonly Capability[] = [
  "records.create",
  "records.edit",
  "records.bulkDelete",
  "users.manage",
  "system.control",
  "automation.manage",
  "backup.manage",
  "rights.manage",
  "ingest.manage"
];

export const ROLE_CAPABILITIES: Record<NavigationRole, readonly Capability[]> = {
  admin: allCapabilities,
  editor: ["records.create", "records.edit", "records.bulkDelete", "automation.manage", "rights.manage", "ingest.manage"],
  viewer: []
};

export function can(role: NavigationRole | undefined, capability: Capability): boolean {
  if (!role) {
    return false;
  }

  const capabilities = ROLE_CAPABILITIES[role];
  return capabilities ? capabilities.includes(capability) : false;
}
