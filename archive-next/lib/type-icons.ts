// ponytail: the `/types` API (backend-owned JSON blob, see TypesController)
// has no `icon` column yet, so the picked icon is scoped to this browser
// until that contract gains one. See entity-icons.ts for the shared store.
import { getEntityIcon, setEntityIcon } from "./entity-icons";

const NAMESPACE = "type";

export function getTypeIcon(typeId: string): string | undefined {
  return getEntityIcon(NAMESPACE, typeId);
}

export function setTypeIcon(typeId: string, iconName: string): void {
  setEntityIcon(NAMESPACE, typeId, iconName);
}
