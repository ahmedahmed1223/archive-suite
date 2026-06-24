// Route barrel — re-exports all route handlers for use in api/server.js.
// Each handler returns true if it handled the request, false to fall through.

export { handleAuthRoute } from "./authRoutes.js";
export { handleMediaRoute } from "./mediaRoutes.js";
export { handleShareRoute } from "./shareRoutes.js";
export { handleBackupRoute } from "./backupRoutes.js";
export { handleAdminRoute } from "./adminRoutes.js";
export { handleUserDataRoute } from "./userDataRoutes.js";
export { handleIngestRoute } from "./ingestRoutes.js";
export { handleBroadcastRoute, storeBroadcastMeta, getBroadcastMeta } from "./broadcastRoutes.js";
