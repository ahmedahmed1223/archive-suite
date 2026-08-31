import { loadDependencySources } from "./manifest.mjs";

const EXPECTED_IDS = [
  "windows-postgres",
  "windows-pgvector",
  "windows-redis",
  "linux-postgres",
  "linux-pgvector",
  "linux-redis",
];

function prefixForId(id) {
  const [platform, service] = id.split("-");
  if (!platform || !service) throw new Error(`Invalid dependency source id: ${id}`);
  return `${platform.toUpperCase()}_${service.toUpperCase()}`;
}

export function variableNamesForAssets(ids) {
  return ids.flatMap((id) => {
    const prefix = prefixForId(id);
    return [`${prefix}_URL`, `${prefix}_SHA256`];
  });
}

export function releaseAssetUrl({ repo, tag, archive }) {
  if (!repo || !tag || !archive) throw new Error("repo, tag, and archive are required to build a release asset URL.");
  return `https://github.com/${repo}/releases/download/${tag}/${archive}`;
}

// Reuses the manifest loader, which already asserts the six-entry closed
// set — a manifest with a missing, extra, or renamed source fails to load.
export function loadClosedManifest(path) {
  const sources = loadDependencySources(path);
  const variableNames = variableNamesForAssets(sources.map(({ id }) => id));
  if (variableNames.length !== EXPECTED_IDS.length * 2) {
    throw new Error(`Expected ${EXPECTED_IDS.length * 2} dependency release variables, found ${variableNames.length}.`);
  }
  return sources;
}
