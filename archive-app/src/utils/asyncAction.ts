export function createAsyncActionGuard<T>() {
  let running = false;

  return {
    isRunning: () => running,
    run: async (operation: () => Promise<T> | T): Promise<T | undefined> => {
      if (running) return undefined;
      running = true;
      try {
        return await operation();
      } finally {
        running = false;
      }
    }
  };
}
