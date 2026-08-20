import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function readNotesFile(path) {
  if (!existsSync(path)) throw new Error(`missing release-notes file: ${path}`);
  return readFileSync(path, "utf8").replace(/^# .+\r?\n+/u, "").trim();
}

export function buildReleaseNotes(version, root = process.cwd()) {
  if (!VERSION.test(version)) throw new Error(`invalid release version: ${version}`);
  const directory = join(root, "docs", "release-notes");
  const arabic = readNotesFile(join(directory, `v${version}.ar.md`));
  const english = readNotesFile(join(directory, `v${version}.md`));
  return `# Archive Suite v${version}\n\n> [!TIP]\n> هذا ملخص الإصدار بالعربية. ابدأ بقراءة التغييرات أدناه، ثم اختر الحزمة المناسبة من قسم **Assets** في نهاية الصفحة.\n\n## العربية\n\n${arabic}\n\n## التنزيلات والتحقق\n\n- **Windows وLinux:** اختر حزمة النظام الأصلية المناسبة من قسم **Assets**.\n- **التثبيت غير المتصل:** نزّل جميع الأجزاء التي تحمل الاسم نفسه ثم اتبع ملف \`OFFLINE-BUNDLE-README.txt\`.\n- **السلامة:** تحقق من الملفات بواسطة \`SHA256SUMS\` قبل التثبيت.\n\n<details>\n<summary>English release notes</summary>\n\n${english}\n\n</details>\n`;
}

function runCli() {
  const [version, output] = process.argv.slice(2);
  if (!version || !output) throw new Error("usage: node scripts/build-release-notes.mjs <version> <output>");
  writeFileSync(resolve(output), buildReleaseNotes(version), "utf8");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runCli();
