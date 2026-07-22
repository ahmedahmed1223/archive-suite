// Tags have no icon contract, so their icon choices remain client-only.
import { getEntityIcon, setEntityIcon } from "./entity-icons";

const NAMESPACE = "tag";

export function getTagIcon(tag: string): string | undefined {
  return getEntityIcon(NAMESPACE, tag);
}

export function setTagIcon(tag: string, iconName: string): void {
  setEntityIcon(NAMESPACE, tag, iconName);
}
