import { existsSync, readFileSync } from "node:fs";
import { dirname, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const PUBLIC_DOCUMENT_PAIRS = [
  ["README.md", "README.ar.md"],
  ["INSTALL.en.md", "INSTALL.md"],
  ["DEPLOYMENT.en.md", "DEPLOYMENT.md"],
  ["CLAUDE.md", "CLAUDE.ar.md"],
  ["docs/README.md", "docs/README.ar.md"],
  ["docs/native-installation.md", "docs/native-installation.ar.md"],
  ["docs/features-guide.en.md", "docs/features-guide.md"],
  ["docs/control-center.md", "docs/control-center.ar.md"],
  ["docs/platform-parity.md", "docs/platform-parity.ar.md"],
  ["docs/local-observability.md", "docs/local-observability.ar.md"],
  ["docs/semantic-search.md", "docs/semantic-search.ar.md"],
  ["docs/odbc-laravel-bridge.en.md", "docs/odbc-laravel-bridge.md"],
  ["docs/api/README.md", "docs/api/README.ar.md"],
  ["docs/versioning.md", "docs/versioning.ar.md"],
  ["docs/arabic-ui-glossary.en.md", "docs/arabic-ui-glossary.md"],
  ["docs/architecture/service-extraction-thresholds.en.md", "docs/architecture/service-extraction-thresholds.md"],
  ["docs/performance/README.en.md", "docs/performance/README.md"],
  ["docs/ops/rc-launch-and-support.en.md", "docs/ops/rc-launch-and-support.md"],
  ["docs/ops/acceptance-clean-host-blockers.en.md", "docs/ops/acceptance-clean-host-blockers.md"],
  ["docs/release-notes/v1.0.0.md", "docs/release-notes/v1.0.0.ar.md"],
  ["archive-laravel/README.md", "archive-laravel/README.ar.md"],
  ["archive-laravel/ARCHIVE_MIGRATION.md", "archive-laravel/ARCHIVE_MIGRATION.ar.md"],
  ["infra/deploy/hostinger-vps.en.md", "infra/deploy/hostinger-vps.md"],
  ["infra/k8s/README.md", "infra/k8s/README.ar.md"],
  ["infra/offline/README.md", "infra/offline/README.ar.md"],
];

const markdownLink = /!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g;

function isLocalTarget(target) {
  return target && !target.startsWith("#") && !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith("/");
}

function relativeTarget(from, target) {
  return normalize(resolve(ROOT, dirname(from), target.split(/[?#]/, 1)[0]));
}

export function validateDocumentation({ files, contents, pairs = PUBLIC_DOCUMENT_PAIRS }) {
  const errors = [];

  for (const [english, arabic] of pairs) {
    if (!files.has(english)) errors.push(`${english}: missing public English document.`);
    if (!files.has(arabic)) errors.push(`${arabic}: missing public Arabic document.`);

    const arabicFromEnglish = relative(dirname(english), arabic).split(sep).join("/");
    const englishFromArabic = relative(dirname(arabic), english).split(sep).join("/");
    if (files.has(english) && !contents.get(english)?.includes(`](${arabicFromEnglish})`)) {
      errors.push(`${english}: missing language switch to ${arabic}.`);
    }
    if (files.has(arabic) && !contents.get(arabic)?.includes(`](${englishFromArabic})`)) {
      errors.push(`${arabic}: missing language switch to ${english}.`);
    }
  }

  for (const [file, content] of contents) {
    for (const match of content.matchAll(markdownLink)) {
      const target = match[1] ?? match[2];
      if (!isLocalTarget(target)) continue;

      const absoluteTarget = relativeTarget(file, target);
      const repositoryRelative = relative(ROOT, absoluteTarget);
      const relativePath = normalize(repositoryRelative).split(sep).join("/");
      if (repositoryRelative.startsWith("..") || (!files.has(relativePath) && !existsSync(absoluteTarget))) {
        errors.push(`${file}: missing relative target ${relativePath}.`);
      }
    }
  }

  return { errors: [...new Set(errors)] };
}

function readPublicDocumentation() {
  const paths = new Set(PUBLIC_DOCUMENT_PAIRS.flat());
  const contents = new Map();

  for (const file of paths) {
    const absolutePath = resolve(ROOT, file);
    if (!existsSync(absolutePath)) continue;
    contents.set(file, readFileSync(absolutePath, "utf8"));
  }

  return { files: new Set(contents.keys()), contents };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateDocumentation(readPublicDocumentation());
  if (result.errors.length) {
    console.error("Public documentation validation failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Public documentation validation passed (${PUBLIC_DOCUMENT_PAIRS.length} language pairs).`);
  }
}
