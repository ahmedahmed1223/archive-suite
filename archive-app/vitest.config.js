import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Ensure JSX is transformed with the automatic React runtime so component
    // files that don't import React explicitly still work in tests.
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    // Non-DOM tests keep the node environment; jsdom is set per-file using
    // the @vitest-environment docblock where needed. The a11y component tests
    // declare `// @vitest-environment jsdom` at the top of each file.
    environment: "node",
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    globals: false,
    environmentMatchGlobs: [
      // Any test under __tests__/a11y/ runs in jsdom automatically
      ["src/__tests__/a11y/**", "jsdom"],
    ],
    setupFiles: ["./src/test-setup.js"],
  },
});
