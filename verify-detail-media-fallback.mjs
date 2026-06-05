import { chromium } from "./archive-ux-detail-media-fallback/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";

const root = "D:/archiveaq/Arch_App/archive-ux-detail-media-fallback";
const profile = path.join(root, "..", "detail-media-fallback-profile");
const outDir = path.join(root, "..", "detail-media-fallback-screens");
mkdirSync(outDir, { recursive: true });

const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
  locale: "ar"
});

const page = context.pages()[0] || await context.newPage();
await page.goto("http://127.0.0.1:8942/", { waitUntil: "domcontentloaded" });

await page.evaluate(async () => {
  localStorage.clear();
  const dbName = "VideoArchiveDB";
  const dbVersion = 5;
  const stores = {
    app_settings: "key",
    users: "id",
    video_items: "id",
    content_types: "id",
    change_history: "id",
    bookmarks: "id",
    video_relations: "id",
    virtual_collections: "id",
    vocabulary: "id",
    hierarchical_tags: "id",
    audit_logs: "id",
    backups: "id"
  };

  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      Object.entries(stores).forEach(([name, keyPath]) => {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name, { keyPath });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const done = (tx) => new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  const now = new Date().toISOString();
  const tx = db.transaction(["app_settings", "users", "video_items"], "readwrite");
  const settingsStore = tx.objectStore("app_settings");
  const usersStore = tx.objectStore("users");
  const itemStore = tx.objectStore("video_items");
  settingsStore.clear();
  usersStore.clear();
  itemStore.clear();
  settingsStore.put({
    key: "app_settings",
    theme: "dark",
    accentColor: "teal",
    numberSystem: "latn",
    onboardingRequired: false,
    initialAdminPassword: null,
    ui: {
      onboardingCompleted: true,
      v1OnboardingCompleted: true,
      v1TourCompleted: true,
      onboardingSecurityMode: "quick",
      firstTaskChoice: "archive",
      firstTaskChoiceUsed: true,
      routingMode: "hash",
      visualDensity: "comfortable",
      themeVersion: "v2"
    }
  });
  usersStore.put({
    id: "admin",
    username: "admin",
    displayName: "المدير",
    role: "admin",
    isActive: true,
    passwordHash: "",
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now
  });

  const base = {
    type: "programs",
    tags: ["معاينة", "اختبار"],
    notes: "00:03 نقطة زمنية في الملاحظات.",
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    metadata: { checksum: "sha256:abcdef1234567890" }
  };

  itemStore.put({ ...base, id: "blocked-local", title: "مسار محلي محجوب", path: "D:/archive/raw clip.mp4" });
  itemStore.put({ ...base, id: "unsupported", title: "صيغة غير مدعومة", path: "D:/archive/audio-master.wav" });
  itemStore.put({ ...base, id: "missing", title: "بدون مسار", path: "" });
  await done(tx);
  db.close();
});

const cases = [
  ["blocked-local", "detail-blocked-local.png", "المسار المحلي محجوب"],
  ["unsupported", "detail-unsupported-format.png", "صيغة غير مدعومة"],
  ["missing", "detail-missing-path.png", "لا يوجد مسار"]
];

const results = [];
for (const [id, file, expectedText] of cases) {
  await page.goto(`http://127.0.0.1:8942/#/detail/${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  if (!(await page.getByText(expectedText).first().isVisible().catch(() => false))) {
    await page.screenshot({ path: path.join(outDir, `debug-${file}`), fullPage: false });
    const bodyText = await page.locator("body").innerText().catch(() => "");
    throw new Error(`Expected "${expectedText}" for ${id}. Body: ${bodyText.slice(0, 700)}`);
  }
  const actionCount = await page.locator("button", { hasText: "تعديل المسار" }).count();
  const bodyText = await page.locator("body").innerText();
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  results.push({
    id,
    expectedText,
    actionCount,
    hasCopy: bodyText.includes("نسخ المسار"),
    hasMetadataOnly: bodyText.includes("البيانات فقط")
  });
}

console.log(JSON.stringify(results, null, 2));
await context.close();
