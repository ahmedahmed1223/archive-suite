export type ArchiveBackend = "local" | "postgres" | "pocketbase" | "firebase";

export type LocalStorageEngine = "indexeddb" | "sqlite";

export type ArchiveRouteSource = "hash" | "history";

export interface ArchiveRouteState {
  page: string;
  selectedItemId: string | null;
  section?: string | null;
}

export interface RuntimeBuildTarget {
  target: "spa" | "cloud";
  isAstroShell?: boolean;
}
