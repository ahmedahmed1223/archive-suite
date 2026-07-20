import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
