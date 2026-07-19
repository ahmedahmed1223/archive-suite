export const MIN_NODE_VERSION = "26.5.0";

export function parseNodeVersion(version = process.version) {
  const [major = 0, minor = 0, patch = 0] = String(version).replace(/^v/, "").split(".").map(Number);
  return { major, minor, patch };
}

export function isSupportedNodeVersion(version = process.version) {
  const current = parseNodeVersion(version);
  const minimum = parseNodeVersion(MIN_NODE_VERSION);
  if (current.major !== minimum.major) return false;
  if (current.minor !== minimum.minor) return current.minor > minimum.minor;
  return current.patch >= minimum.patch;
}
