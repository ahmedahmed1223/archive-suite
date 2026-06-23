// Ingest pipeline barrel — re-exports all public ingest APIs.

export { createWatchFolderService, computeChecksum } from "./watchFolder.js";
export { pullFromFtp } from "./ftpIngest.js";
export { pullFromSmb } from "./smbIngest.js";
