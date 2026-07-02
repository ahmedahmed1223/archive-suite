// ponytail: tiny localStorage store for minted links; no re-renders, read/write via functions
export interface MintedLink {
  token: string;
  url: string;
  itemLabel?: string;
  createdAt: string;
  expiresAt?: string;
}

const STORAGE_KEY = "masar.minted-shares";

function getStorage(): MintedLink[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStorage(links: MintedLink[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function listMintedLinks(): MintedLink[] {
  return getStorage();
}

export function addMintedLink(link: MintedLink): void {
  const links = getStorage();
  links.push(link);
  setStorage(links);
}

export function removeMintedLink(token: string): void {
  const links = getStorage().filter((l) => l.token !== token);
  setStorage(links);
}

export function clearAllMintedLinks(): void {
  setStorage([]);
}
