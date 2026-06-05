export function createAsyncActionGuard() {
  let running = false;

  return {
    isRunning: () => running,
    run: async (operation) => {
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
