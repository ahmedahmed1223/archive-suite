import { mountVideoArchive } from "./App.jsx";
import { detectShareToken } from "../features/share/shareClient.js";

export function startVideoArchive(rootId: string = "root") {
  const rootElement = document.getElementById(rootId);

  if (!rootElement) {
    throw new Error(`Unable to start Video Archive: #${rootId} was not found.`);
  }

  // Public share viewer: when opened with ?share=<token>, render the standalone
  // read-only viewer instead of the full app (no auth, no store). Loaded lazily
  // so the share code never weighs on the normal app's first paint.
  const shareToken = detectShareToken(typeof location !== "undefined" ? location : null);
  if (shareToken) {
    return import("../features/share/SharedView.jsx").then(({ mountSharedView }) =>
      mountSharedView(rootElement, shareToken)
    );
  }

  return mountVideoArchive(rootElement);
}
