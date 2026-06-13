import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const srcRoot = join(root, "src");
const runtimePath = join(srcRoot, "runtime", "videoArchiveRuntime.js");
const pageDir = join(srcRoot, "pages");
const componentDir = join(srcRoot, "components");

function getFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      getFiles(fullPath, files);
    } else if (/\.(js|jsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function countLines(path) {
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8").split(/\r?\n/).length;
}

const runtimeLines = countLines(runtimePath);
const runtimeRemoved = !existsSync(runtimePath) && runtimeLines === 0;
const pageFiles = readdirSync(pageDir)
  .filter((file) => /Page\.jsx$/.test(file))
  .map((file) => {
    const path = join(pageDir, file);
    const content = readFileSync(path, "utf8");
    return {
      file,
      wrapper: content.includes("createLegacyPage("),
      directReExport: /^export\s+\{/.test(content.trim())
    };
  });
const componentWrapperFiles = getFiles(componentDir)
  .filter((file) => !file.endsWith("legacyComponentAdapter.js") && !file.endsWith("legacyComponentFactory.js"))
  .map((path) => {
    const content = readFileSync(path, "utf8");
    return {
      file: relative(root, path),
      wrapper: content.includes("createLegacyComponent("),
      directReExport: /^export\s+\{/.test(content.trim()) && content.includes("legacyComponentAdapter")
    };
  });

const sourceFiles = getFiles(srcRoot);
const legacyImports = sourceFiles
  .map((path) => ({
    file: relative(root, path),
    count: (readFileSync(path, "utf8").match(/legacyAdapter|legacyPageAdapter|legacyComponentAdapter|runtime\/videoArchiveRuntime/g) || []).length
  }))
  .filter((item) => item.count > 0)
  .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));

const wrappedPages = pageFiles.filter((page) => page.wrapper).length;
const wrappedComponents = componentWrapperFiles.filter((component) => component.wrapper).length;
const directPageReExports = pageFiles.filter((page) => page.directReExport).length;
const directComponentReExports = componentWrapperFiles.filter((component) => component.directReExport).length;

const report = {
  runtimeRemoved,
  runtimeLines,
  wrappedPages,
  legacyImportFiles: legacyImports.length,
  pages: {
    total: pageFiles.length,
    wrapped: wrappedPages,
    directReExports: directPageReExports
  },
  components: {
    wrapped: wrappedComponents,
    directReExports: directComponentReExports
  },
  topLegacyImportFiles: legacyImports.slice(0, 12)
};

console.log(JSON.stringify(report, null, 2));

if (!runtimeRemoved || wrappedPages > 0 || wrappedComponents > 0 || legacyImports.length > 0 || directPageReExports > 0 || directComponentReExports > 0) {
  process.exitCode = 1;
}
