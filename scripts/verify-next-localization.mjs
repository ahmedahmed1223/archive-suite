import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arabic = /[\u0600-\u06ff]/u;
const sourceRoots = ["archive-next/app", "archive-next/components", "archive-next/lib"];
const approvedSources = new Set([
  "archive-next/lib/brand.ts",
  // These modules intentionally hold paired Arabic/English messages while the
  // shared dictionary is being completed. Their tests assert both locales.
  "archive-next/lib/admin-action-summary.ts",
  "archive-next/lib/archive-api.ts",
  "archive-next/lib/change-impact.ts",
  "archive-next/lib/cleanup-center.ts",
  "archive-next/lib/contextual-tips.ts",
  "archive-next/lib/copilot-chat.ts",
  "archive-next/lib/default-taxonomy.ts",
  "archive-next/lib/first-run-tour.ts",
  "archive-next/lib/geotag.ts",
  "archive-next/lib/guide-content.ts",
  "archive-next/lib/graph-lenses.ts",
  "archive-next/lib/handoff-report.ts",
  "archive-next/lib/in-app-guide.ts",
  "archive-next/lib/intake-journey.ts",
  "archive-next/lib/local-enrichment.ts",
  "archive-next/lib/onboarding-progress.ts",
  "archive-next/lib/offline-manager.ts",
  "archive-next/lib/record-duplicate.ts",
  "archive-next/lib/scheduled-upload.ts",
  "archive-next/lib/setup-journey.ts",
  "archive-next/lib/use-notifications.ts",
  "archive-next/lib/work-lists.ts",
  "archive-next/lib/onboarding.ts",
  "archive-next/lib/operational-safety.ts",
  "archive-next/lib/record-export.ts",
  "archive-next/lib/record-safety-alerts.ts",
  "archive-next/lib/record-status.ts",
  "archive-next/lib/record-timeline.ts",
  "archive-next/lib/share-checklist.ts",
  "archive-next/lib/storage-capacity-alert.ts",
  "archive-next/lib/type-field-visibility.ts",
  "archive-next/lib/workspace-preferences.ts",
  "archive-next/lib/chunked-upload.ts",
]);

function isApproved(file) {
  return file.includes("/lib/i18n/") || approvedSources.has(file) || file === "archive-next/app/api/guide/route.ts" || file === "archive-next/app/api/v1/[...path]/route.ts" || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file);
}

function interfaceLiterals(source) {
  const literals = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const withoutLineComment = line.replace(/\/\/.*$/, "");
    const matches = withoutLineComment.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g);
    for (const match of matches) {
      const arabicLetters = match[2].match(/[\u0621-\u064A]/gu) ?? [];
      if (arabicLetters.length >= 2) literals.push({ line: index + 1, literal: match[2] });
    }
  }
  return literals;
}

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

export function collectArabicInterfaceLiterals({ files } = {}) {
  const entries = files
    ? Object.entries(files)
    : sourceRoots
      .flatMap((path) => sourceFiles(resolve(root, path)))
      .map((path) => [relative(root, path).replaceAll("\\", "/"), readFileSync(path, "utf8")]);

  return entries.flatMap(([file, source]) => {
    const normalized = file.replaceAll("\\", "/");
    if (isApproved(normalized)) return [];
    return interfaceLiterals(source).map(({ line, literal }) => ({ file: normalized, line, literal }));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = collectArabicInterfaceLiterals();
  if (findings.length) {
    for (const { file, line, literal } of findings) process.stderr.write(`${file}:${line} untranslated Arabic interface literal: ${literal}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Next.js English localization coverage is complete.\n");
  }
}
