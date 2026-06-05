import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Three build targets share one source tree (ports + adapters keep feature
// code backend-agnostic):
//   spa      (default)         -> offline single-file in dist/         (local adapters)
//   cloud    (--mode cloud)    -> multi-file in dist-cloud/            (cloud adapters)
//   aistudio (--mode aistudio) -> single-file in dist-aistudio/        (local only, no backend wizard)
//
// AI Studio target = SPA built to run inside Google AI Studio "Apps". It's
// the same single-file SPA but with __VITE_AISTUDIO__ set so the boot path
// can default to local-only storage and skip the cloud-backend wizard step
// (AI Studio sandboxes the SPA in an iframe — no fetch to remote services
// during setup makes for the friendliest first-run).
//
// Use `vite build` for spa, `vite build --mode cloud`, or
// `vite build --mode aistudio` — the `--mode` flag works cross-platform.
export default defineConfig(({ mode }) => {
  const target = mode === "cloud" ? "cloud" : mode === "aistudio" ? "aistudio" : "spa";
  const isCloud = target === "cloud";
  const isAistudio = target === "aistudio";
  const inlineSingleFile = !isCloud;
  const outDir = isCloud ? "dist-cloud" : isAistudio ? "dist-aistudio" : "dist";

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Single-file inlining for SPA + AI Studio; cloud target keeps chunked assets.
      ...(inlineSingleFile ? [viteSingleFile({ removeViteModuleLoader: true })] : [])
    ],
    define: {
      __VITE_TARGET__: JSON.stringify(target),
      __VITE_AISTUDIO__: JSON.stringify(isAistudio)
    },
    build: {
      outDir,
      chunkSizeWarningLimit: 3000
    },
    server: {
      host: "127.0.0.1"
    },
    preview: {
      host: "127.0.0.1"
    }
  };
});
