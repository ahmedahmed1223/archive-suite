import { loadErrorLog } from "../features/errors/errorLogStore.js";
import { loadRecoveryQueue } from "../features/errors/recoveryQueue.js";

export function preloadStores(): void {
  void loadErrorLog();
  void loadRecoveryQueue();
}

export { loadErrorLog, loadRecoveryQueue };
