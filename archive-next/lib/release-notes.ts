import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ReleaseNotes = {
  version: string;
  ar: string;
  en: string;
};

const RELEASE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const RELEASE_FILE = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(\.ar)?\.md$/;

function releaseNotesDirectory() {
  const fromWorkspace = join(process.cwd(), "docs", "release-notes");
  return existsSync(fromWorkspace)
    ? fromWorkspace
    : join(process.cwd(), "..", "docs", "release-notes");
}

function releaseNotesPath(version: string, locale: "ar" | "en") {
  return join(releaseNotesDirectory(), `v${version}${locale === "ar" ? ".ar" : ""}.md`);
}

export function getReleaseNotes(version: string): ReleaseNotes | null {
  if (!RELEASE_VERSION.test(version)) return null;

  const arabicPath = releaseNotesPath(version, "ar");
  const englishPath = releaseNotesPath(version, "en");
  if (!existsSync(arabicPath) || !existsSync(englishPath)) return null;

  return {
    version,
    ar: readFileSync(arabicPath, "utf8"),
    en: readFileSync(englishPath, "utf8"),
  };
}

export function listReleaseVersions(): string[] {
  const versions = new Set<string>();
  for (const file of readdirSync(releaseNotesDirectory())) {
    const match = RELEASE_FILE.exec(file);
    if (match) versions.add(match[1]);
  }
  return [...versions].sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
}
