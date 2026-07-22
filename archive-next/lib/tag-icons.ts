// ponytail: same client-only limitation as type-icons.ts — see entity-icons.ts.
import { getEntityIcon, setEntityIcon } from "./entity-icons";

const NAMESPACE = "tag";

export function getTagIcon(tag: string): string | undefined {
  return getEntityIcon(NAMESPACE, tag);
}

export function setTagIcon(tag: string, iconName: string): void {
  setEntityIcon(NAMESPACE, tag, iconName);
}
