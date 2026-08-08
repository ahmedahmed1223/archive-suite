import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "docs/public-docs.manifest.json";
const markdownLink = /!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g;
const internalStageLanguage = /\b(?:cutover|cutoff|cut-off|next phase|remaining steps|not implemented yet|V1-\d+)\b|المرحلة التالية|الخطوات المتبقية|مهام متبقية|غير منفذ بعد|قيد التنفيذ/iu;

function posix(path) {
  return normalize(path).split(sep).join("/");
}

export function loadPublicManifest(root = ROOT) {
  const path = resolve(root, MANIFEST_PATH);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.schemaVersion !== "1.0" || !Array.isArray(manifest.documents)) {
    throw new Error(`${MANIFEST_PATH}: unsupported or incomplete manifest.`);
  }
  return manifest;
}

function relativeTarget(from, target) {
  return normalize(resolve(ROOT, dirname(from), target.split(/[?#]/, 1)[0]));
}

function headingAnchors(content) {
  const anchors = new Set();
  const occurrences = new Map();
  for (const match of content.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gmu)) {
    const base = match[1]
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_~]/g, "")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-");
    const count = occurrences.get(base) ?? 0;
    occurrences.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function pairDocuments(pairs) {
  return pairs.map(([english, arabic], index) => ({ id: `legacy-pair-${index + 1}`, english, arabic, lifecycle: "living" }));
}

function isExcluded(file, excludedTrees, excludedFiles) {
  return excludedFiles.some((entry) => entry.path === file)
    || excludedTrees.some((entry) => file.startsWith(entry.path));
}

export function validateDocumentation({
  files,
  contents,
  pairs,
  documents = pairs ? pairDocuments(pairs) : loadPublicManifest().documents,
  excludedTrees = [],
  excludedFiles = [],
}) {
  const errors = [];
  const publicPaths = new Set();

  for (const document of documents) {
    const { english, arabic, id } = document;
    if (!english || !arabic) {
      errors.push(`${id ?? "document"}: living public documents require English and Arabic paths.`);
      continue;
    }
    if (document.lifecycle === "living" && english.endsWith(".en.md")) {
      errors.push(`${id}: living public English path must not end in .en.md.`);
    }
    if (document.lifecycle === "living" && !arabic.endsWith(".ar.md")) {
      errors.push(`${id}: living public Arabic path must end in .ar.md.`);
    }
    if (publicPaths.has(english) || publicPaths.has(arabic)) {
      errors.push(`${id}: public document path is classified more than once.`);
    }
    publicPaths.add(english);
    publicPaths.add(arabic);

    if (!files.has(english)) errors.push(`${english}: missing public English document.`);
    if (!files.has(arabic)) errors.push(`${arabic}: missing public Arabic document.`);

    const arabicFromEnglish = posix(relative(dirname(english), arabic));
    const englishFromArabic = posix(relative(dirname(arabic), english));
    if (files.has(english) && !contents.get(english)?.includes(`](${arabicFromEnglish})`)) {
      errors.push(`${english}: missing language switch to ${arabic}.`);
    }
    if (files.has(arabic) && !contents.get(arabic)?.includes(`](${englishFromArabic})`)) {
      errors.push(`${arabic}: missing language switch to ${english}.`);
    }

    if (document.lifecycle === "living") {
      for (const file of [english, arabic]) {
        if (internalStageLanguage.test(contents.get(file) ?? "")) {
          errors.push(`${file}: contains internal delivery-stage language.`);
        }
      }
    }

    for (const section of document.sections ?? []) {
      if (!contents.get(english)?.includes(`## ${section.english}`)) {
        errors.push(`${english}: missing English section ${section.id}.`);
      }
      if (!contents.get(arabic)?.includes(`## ${section.arabic}`)) {
        errors.push(`${arabic}: missing Arabic section ${section.id}.`);
      }
    }

    for (const source of document.sourceOfTruth ?? []) {
      if (!files.has(source) && !existsSync(resolve(ROOT, source))) {
        errors.push(`${id}: missing source of truth ${source}.`);
      }
    }
  }

  if (!pairs) {
    for (const file of files) {
      if (!/\.mdx?$/i.test(file)) continue;
      const publicDocument = publicPaths.has(file);
      const excluded = isExcluded(file, excludedTrees, excludedFiles);
      if (publicDocument && excluded) errors.push(`${file}: overlaps public and excluded classifications.`);
      if (!publicDocument && !excluded) errors.push(`${file}: unclassified Markdown document.`);
    }
  }

  for (const [file, content] of contents) {
    if (!publicPaths.has(file)) continue;
    for (const match of content.matchAll(markdownLink)) {
      const target = match[1] ?? match[2];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) continue;

      const anchorOnly = target.startsWith("#");
      const absoluteTarget = anchorOnly ? resolve(ROOT, file) : relativeTarget(file, target);
      const repositoryRelative = relative(ROOT, absoluteTarget);
      const relativePath = anchorOnly ? file : posix(repositoryRelative);
      if (repositoryRelative.startsWith("..") || (!files.has(relativePath) && !existsSync(absoluteTarget))) {
        errors.push(`${file}: missing relative target ${relativePath}.`);
      } else if (isExcluded(relativePath, excludedTrees, excludedFiles)) {
        errors.push(`${file}: links to excluded documentation ${relativePath}.`);
      }

      const hashIndex = target.indexOf("#");
      if (hashIndex >= 0 && contents.has(relativePath)) {
        let anchor = target.slice(hashIndex + 1);
        try { anchor = decodeURIComponent(anchor); } catch { /* report the literal value */ }
        if (anchor && !headingAnchors(contents.get(relativePath)).has(anchor.toLocaleLowerCase())) {
          errors.push(`${file}: missing heading anchor #${anchor} in ${relativePath}.`);
        }
      }
    }
  }

  return { errors: [...new Set(errors)] };
}

function trackedMarkdown(root = ROOT) {
  const output = execFileSync("git", ["-c", `safe.directory=${posix(root)}`, "ls-files", "*.md", "*.mdx"], {
    cwd: root,
    encoding: "utf8",
  });
  return output.split(/\r?\n/).filter(Boolean).map(posix);
}

function readRepositoryDocumentation(root = ROOT) {
  const manifest = loadPublicManifest(root);
  const tracked = trackedMarkdown(root);
  const files = new Set(tracked);
  const contents = new Map();

  for (const document of manifest.documents) {
    for (const file of [document.english, document.arabic]) {
      const absolutePath = resolve(root, file);
      if (existsSync(absolutePath)) {
        files.add(file);
        contents.set(file, readFileSync(absolutePath, "utf8"));
      }
    }
  }

  return { files, contents, ...manifest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = readRepositoryDocumentation();
  const result = validateDocumentation(input);
  if (result.errors.length) {
    console.error("Public documentation validation failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Public documentation validation passed (${input.documents.length} classified language pairs).`);
  }
}
