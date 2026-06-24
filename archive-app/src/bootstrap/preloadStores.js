/**
 * Pre-React hydration of side-channel stores.
 *
 * Both the error log and the recovery queue persist to localStorage but are
 * plain subscribable modules — not part of the Zustand app store — so they
 * must be explicitly reloaded at boot or the Error Log page renders empty
 * until the next error is recorded, losing everything from the prior session.
 * Centralized here so main.js stays a clean wiring list.
 */
import { loadErrorLog } from "../features/errors/errorLogStore.js";
import { loadRecoveryQueue } from "../features/errors/recoveryQueue.js";

export function preloadStores() {
  loadErrorLog();
  loadRecoveryQueue();
}

export { loadErrorLog, loadRecoveryQueue };
