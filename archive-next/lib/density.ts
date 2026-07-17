// ponytail: density is a lightweight UI preference (comfortable/compact
// spacing for tables and grids), persisted through the shared per-user
// view-state store rather than a bespoke storage key.
import { readPersistedViewState, writePersistedViewState } from "./persisted-view-state";

export type Density = "comfortable" | "compact";

const DENSITY_PAGE = "ui-density";

interface DensityState {
  density?: Density;
}

export function getDensity(userId: string | null | undefined = null): Density {
  const saved = readPersistedViewState<DensityState>(userId, DENSITY_PAGE);
  return saved.density === "compact" ? "compact" : "comfortable";
}

export function setDensity(density: Density, userId: string | null | undefined = null): void {
  writePersistedViewState<DensityState>(userId, DENSITY_PAGE, { density });
}
