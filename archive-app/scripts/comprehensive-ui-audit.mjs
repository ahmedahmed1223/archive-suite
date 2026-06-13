import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ARGS = new Set(process.argv.slice(2));
const BASE_URL = (process.env.E2E_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const API_BASE_URL = (process.env.E2E_API_BASE_URL || BASE_URL).replace(/\/$/, "");
const E2E_MODE = ARGS.has("--server") ? "server" : (process.env.E2E_MODE || "local");
const E2E_HEADED = ARGS.has("--headed") || process.env.E2E_HEADED === "1";
const OUTPUT_DIR = path.resolve(process.env.E2E_OUTPUT_DIR || path.join("output", "playwright", "interactive-audit"));
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots");
const DB_NAME = "VideoArchiveDB";
const DB_VERSION = 5;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_USER_ID = "user_e2e_admin";
const SEED_ITEM_ID = "video_e2e_seed_1";
const SECOND_ITEM_ID = "video_e2e_seed_2";
const SEED_TYPE_ID = "type_e2e_reports";

const STORES = {
  TYPES: "content_types",
  ITEMS: "video_items",
  HISTORY: "change_history",
  SETTINGS: "app_settings",
  BACKUPS: "backups",
  BOOKMARKS: "bookmarks",
  RELATIONS: "video_relations",
  COLLECTIONS: "virtual_collections",
  VOCABULARY: "vocabulary",
  HTAGS: "hierarchical_tags",
  USERS: "users",
  AUDIT_LOGS: "audit_logs",
  PROJECTS: "projects"
};

const DATA_STORES = [
  STORES.TYPES,
  STORES.ITEMS,
  STORES.HISTORY,
  STORES.BACKUPS,
  STORES.BOOKMARKS,
  STORES.RELATIONS,
  STORES.COLLECTIONS,
  STORES.VOCABULARY,
  STORES.HTAGS,
  STORES.USERS,
  STORES.AUDIT_LOGS,
  STORES.PROJECTS
];

const PAGE_TARGETS = [
  { route: "#/dashboard", heading: "مركز التحكم" },
  { route: "#/archive", heading: "الأرشيف" },
  { route: "#/add", heading: "إضافة فيديو" },
  { route: "#/search", heading: "البحث المتقدم" },
  { route: `#/detail/${SEED_ITEM_ID}`, heading: "تفاصيل الفيديو" },
  { route: "#/collections", heading: "المجموعات" },
  { route: "#/projects", heading: "مشاريع المونتاج" },
  { route: "#/types", heading: "إدارة الأنواع والحقول" },
  { route: "#/vocabulary", heading: "القاموس" },
  { route: "#/htags", heading: "الوسوم الهرمية" },
  { route: "#/graph", heading: "خريطة العلاقات" },
  { route: "#/users", heading: "المستخدمون" },
  { route: "#/settings", heading: "الإعدادات" },
  { route: "#/history", heading: "سجل التغييرات" },
  { route: "#/help", heading: "المساعدة والدليل" },
  { route: "#/backup", heading: "مركز البيانات" },
  { route: "#/uploader", heading: "رفع الملفات" },
  { route: "#/transcriber", heading: "التفريغ الصوتي" },
  { route: "#/reports", heading: "التقارير والإحصائيات" },
  { route: "#/sync-log", heading: "سجل المزامنة" }
];

const VIEWPORTS = [
  { id: "desktop-1440", width: 1440, height: 960 },
  { id: "tablet-768", width: 768, height: 1024 },
  { id: "mobile-390", width: 390, height: 844 }
];

const report = {
  baseUrl: BASE_URL,
  apiBaseUrl: API_BASE_URL,
  mode: E2E_MODE,
  startedAt: new Date().toISOString(),
  steps: [],
  screenshots: [],
  downloads: [],
  consoleErrors: [],
  pageErrors: []
};

function routeUrl(route) {
  return `${BASE_URL}/${route}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nowIso() {
  return new Date().toISOString();
}

function markStep(name, status = "passed", detail = "") {
  report.steps.push({ name, status, detail, at: new Date().toISOString() });
  console.log(`${status === "passed" ? "ok" : "FAIL"} - ${name}${detail ? `: ${detail}` : ""}`);
}

function safeFilePart(value) {
  return String(value || "item")
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "item";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function captureScreenshot(page, label) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const fileName = `${safeFilePart(label)}.png`;
  const screenshotPath = path.join(SCREENSHOT_DIR, fileName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  report.screenshots.push({ label, path: screenshotPath });
  return screenshotPath;
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth
  }));
  const overflow = Math.max(metrics.scrollWidth - metrics.clientWidth, metrics.bodyScrollWidth - metrics.bodyClientWidth);
  if (overflow > 4) {
    throw new Error(`${label} has horizontal overflow (${overflow}px).`);
  }
}

async function assertInteractiveNames(page, label) {
  const unnamed = await page.evaluate(() => {
    const selector = "button, a[href], input, select, textarea, [role='button'], [role='link'], [tabindex]:not([tabindex='-1'])";
    return [...document.querySelectorAll(selector)]
      .filter((element) => {
        if (element.closest("[aria-hidden='true']")) return false;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const labelText = [...(element.labels || [])].map((label) => label.textContent).join(" ");
        const accessibleName = element.getAttribute("aria-label")
          || element.getAttribute("title")
          || element.getAttribute("placeholder")
          || labelText
          || element.textContent;
        return !String(accessibleName || "").trim();
      })
      .slice(0, 10)
      .map((element) => element.outerHTML.slice(0, 180));
  });
  if (unnamed.length) {
    throw new Error(`${label} has interactive elements without names: ${JSON.stringify(unnamed)}`);
  }
}

async function writeHtmlReport() {
  const passed = report.status === "passed";
  const rows = report.steps.map((step) => `
    <tr>
      <td>${escapeHtml(step.status)}</td>
      <td>${escapeHtml(step.name)}</td>
      <td>${escapeHtml(step.detail)}</td>
      <td>${escapeHtml(step.at)}</td>
    </tr>`).join("");
  const screenshots = report.screenshots.map((shot) => `
    <figure>
      <img src="${escapeHtml(path.relative(OUTPUT_DIR, shot.path).replace(/\\/g, "/"))}" alt="${escapeHtml(shot.label)}" />
      <figcaption>${escapeHtml(shot.label)}</figcaption>
    </figure>`).join("");
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>Archive Suite Interactive Audit</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:24px;background:#0f172a;color:#e5e7eb}
    .badge{display:inline-block;border-radius:999px;padding:4px 10px;background:${passed ? "#065f46" : "#7f1d1d"}}
    table{width:100%;border-collapse:collapse;margin-top:16px;background:#111827}
    td,th{border:1px solid #374151;padding:8px;text-align:start;vertical-align:top}
    figure{margin:16px 0;padding:12px;background:#111827;border:1px solid #374151}
    img{max-width:100%;height:auto;border:1px solid #334155}
    pre{white-space:pre-wrap;background:#111827;padding:12px;border:1px solid #374151}
  </style>
</head>
<body>
  <h1>Archive Suite Interactive Audit</h1>
  <p><span class="badge">${escapeHtml(report.status || "running")}</span></p>
  <p>Mode: ${escapeHtml(report.mode)} · Base: ${escapeHtml(report.baseUrl)} · Started: ${escapeHtml(report.startedAt)} · Finished: ${escapeHtml(report.finishedAt || "")}</p>
  <h2>Steps</h2>
  <table><thead><tr><th>Status</th><th>Step</th><th>Detail</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>Screenshots</h2>
  ${screenshots || "<p>No screenshots captured.</p>"}
  <h2>Browser Errors</h2>
  <pre>${escapeHtml(JSON.stringify({ consoleErrors: report.consoleErrors, pageErrors: report.pageErrors, failure: report.failure }, null, 2))}</pre>
</body>
</html>`;
  await writeFile(path.join(OUTPUT_DIR, "report.html"), html, "utf8");
}

function makeSettings(timestamp) {
  return {
    key: "app_settings",
    theme: "dark",
    accentColor: "emerald",
    numberSystem: "latn",
    dateFormat: "gregorian",
    backupSchedule: "manual",
    lastBackupAt: null,
    keyboardShortcuts: {},
    ui: {
        v1OnboardingCompleted: true,
        v1TourCompleted: true,
        v1TourVersion: "2026-06-05-media-workstation",
        onboardingCompleted: true,
      onboardingSkippedAt: timestamp,
      lastOnboardingStep: "daily-start",
      onboardingSecurityMode: "quick",
      onboardingThemeChoice: "dark",
      visualDensity: "comfortable",
      startupMode: "balanced",
      lastSettingsTab: "general",
      lastDataCenterTab: "export",
      lastImportMode: "merge",
      transferLastMode: "merge",
      firstTaskChoice: "dashboard",
      firstTaskChoiceUsed: false,
      deviceId: "device_e2e_main",
      deviceName: "جهاز فحص شامل",
      themeVersion: "v4",
      motionLevel: "off"
    },
    notifications: {
      durationMs: 1200,
      persistImportant: false,
      desktopEnabled: false
    },
    systemHealth: {
      lastCheckAt: timestamp,
      startupLastStatus: "ok"
    },
    syncPeers: {},
    onboardingRequired: false,
    initialAdminPassword: null,
    masterPasswordHash: ""
  };
}

function makeSeedData(timestamp) {
  const contentType = {
    id: SEED_TYPE_ID,
    name: "تقارير ميدانية",
    nameEn: "field_reports",
    icon: "R",
    iconSpec: { type: "text", value: "R" },
    color: "#059669",
    coverImage: null,
    coverFit: "cover",
    coverSourceName: "",
    coverUpdatedAt: null,
    subtypes: [
      { id: "subtype_e2e_daily", name: "يومي", order: 0, createdAt: timestamp, updatedAt: timestamp }
    ],
    fields: [
      { id: "field_e2e_source", label: "المصدر", storageKey: "source", type: "text", order: 0, required: false },
      { id: "field_e2e_status", label: "حالة المراجعة", storageKey: "reviewStatus", type: "select", options: ["مسودة", "معتمد"], order: 1, required: false }
    ],
    order: 0,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const baseItem = {
    type: contentType.id,
    subtype: "subtype_e2e_daily",
    thumbnail: "",
    isDeleted: false,
    version: 1,
    syncVersion: 1,
    lastModifiedBy: { userId: ADMIN_USER_ID, deviceId: "device_e2e_main", at: timestamp },
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const videoItems = [
    {
      ...baseItem,
      id: SEED_ITEM_ID,
      title: "لقطة اختبار ميدانية",
      path: "C:/archive/e2e/field-shot.mp4",
      metadata: {
        source: "فريق الاختبار",
        reviewStatus: "مسودة",
        localFile: {
          name: "field-shot.mp4",
          path: "C:/archive/e2e/field-shot.mp4",
          relativePath: "",
          size: 10485760,
          type: "video/mp4",
          lastModified: timestamp,
          extension: "mp4"
        }
      },
      tags: ["اختبار", "ميداني"],
      notes: "عنصر ثابت لفحص التفاصيل والأرشيف والمجموعات."
    },
    {
      ...baseItem,
      id: SECOND_ITEM_ID,
      title: "لقطة ثانية للمونتاج",
      path: "C:/archive/e2e/second-shot.mp4",
      metadata: { source: "فريق الاختبار", reviewStatus: "معتمد" },
      tags: ["مونتاج"],
      notes: "عنصر إضافي لفحص المشاريع والتصدير.",
      isFavorite: true
    }
  ];

  return {
    settings: makeSettings(timestamp),
    contentType,
    videoItems,
    user: {
      id: ADMIN_USER_ID,
      username: "admin",
      displayName: "مدير الفحص",
      passwordHash: "",
      role: "admin",
      customPermissions: undefined,
      isActive: true,
      lastLoginAt: timestamp,
      mustChangePassword: false,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    history: videoItems.map((item, index) => ({
      id: `history_e2e_${index + 1}`,
      itemId: item.id,
      action: "create",
      title: item.title,
      timestamp
    })),
    collection: {
      id: "collection_e2e_existing",
      name: "مجموعة موجودة",
      description: "مجموعة أولية لفحص صفحة المجموعات.",
      type: "manual",
      icon: "C",
      color: "#10b981",
      itemIds: [SEED_ITEM_ID],
      createdAt: timestamp,
      updatedAt: timestamp
    },
    vocabulary: {
      id: "vocab_e2e_1",
      term: "لقطة تأسيسية",
      aliases: ["افتتاحية"],
      category: "عام",
      definition: "مصطلح اختبار للقاموس.",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    htag: {
      id: "htag_e2e_1",
      name: "اختبار شامل",
      path: "اختبار شامل",
      fullPath: "اختبار شامل",
      parentId: null,
      color: "#22c55e",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    auditLog: {
      id: "audit_e2e_1",
      userId: ADMIN_USER_ID,
      username: "admin",
      eventType: "seed.e2e",
      targetId: SEED_ITEM_ID,
      targetType: "video",
      details: { source: "comprehensive-ui-audit" },
      timestamp
    }
  };
}

async function seedLocalArchive(page) {
  const timestamp = nowIso();
  const seed = makeSeedData(timestamp);
  const payload = {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stores: Object.values(STORES),
    dataStores: DATA_STORES,
    sessionUserId: ADMIN_USER_ID,
    sessionExpiresAt: Date.now() + SESSION_TTL_MS,
    ...seed
  };

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (data) => {
    const openDb = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(data.dbName, data.dbVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const storeName of data.stores) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: storeName === "app_settings" ? "key" : "id" });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
    });

    const transact = (db, storeNames, mode, run) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      run(tx);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
    });

    localStorage.clear();
    localStorage.setItem("va_session", `s_e2e:${data.sessionUserId}:${data.sessionExpiresAt}`);
    localStorage.setItem("videoArchive:theme", "dark");
    localStorage.setItem("videoArchive:themeVersion", "v4");
    localStorage.setItem("videoArchive:addVideoSidePanel", "1");

    const db = await openDb();
    await transact(db, data.dataStores, "readwrite", (tx) => {
      for (const storeName of data.dataStores) tx.objectStore(storeName).clear();
    });
    await transact(db, ["app_settings"], "readwrite", (tx) => {
      tx.objectStore("app_settings").clear();
    });
    await transact(db, ["app_settings"], "readwrite", (tx) => {
      tx.objectStore("app_settings").put(data.settings);
    });
    await transact(db, data.dataStores, "readwrite", (tx) => {
      tx.objectStore("content_types").put(data.contentType);
      for (const item of data.videoItems) tx.objectStore("video_items").put(item);
      tx.objectStore("users").put(data.user);
      for (const record of data.history) tx.objectStore("change_history").put(record);
      tx.objectStore("virtual_collections").put(data.collection);
      tx.objectStore("vocabulary").put(data.vocabulary);
      tx.objectStore("hierarchical_tags").put(data.htag);
      tx.objectStore("audit_logs").put(data.auditLog);
    });
    db.close();
  }, payload);
  await page.reload({ waitUntil: "domcontentloaded" });
}

function makeSnapshotFromSeed(seed) {
  return {
    exportedAt: nowIso(),
    version: "2.0",
    contentTypes: [seed.contentType],
    videoItems: seed.videoItems,
    changeHistory: seed.history,
    bookmarks: [],
    relations: [],
    virtualCollections: [seed.collection],
    vocabulary: [seed.vocabulary],
    hierarchicalTags: [seed.htag],
    users: [seed.user],
    auditLogs: [seed.auditLog],
    projects: [],
    settings: seed.settings
  };
}

async function loginServer() {
  const username = process.env.E2E_ADMIN_USERNAME || "";
  const password = process.env.E2E_ADMIN_PASSWORD || "";
  if (!username || !password) {
    throw new Error("server mode requires E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD.");
  }
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok || !payload?.token) {
    throw new Error(payload?.error || `server login failed (${response.status}).`);
  }
  return { token: payload.token, user: payload.user || { username } };
}

async function serverRpc(token, method, args = []) {
  const response = await fetch(`${API_BASE_URL}/api/rpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ method, args })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `RPC ${method} failed (${response.status}).`);
  }
  return payload.result;
}

async function seedServerArchive(page) {
  if (process.env.E2E_ALLOW_SERVER_MUTATION !== "1") {
    throw new Error("server mode mutates test data and requires E2E_ALLOW_SERVER_MUTATION=1.");
  }
  const { token, user } = await loginServer();
  const originalSnapshot = await serverRpc(token, "snapshot", []);
  const timestamp = nowIso();
  const seed = makeSeedData(timestamp);
  await serverRpc(token, "replaceAll", [makeSnapshotFromSeed(seed)]);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ token: jwt, user: cloudUser, baseUrl, expiresAt }) => {
    localStorage.clear();
    localStorage.setItem("va.backendChoice.v1", JSON.stringify({
      backend: "postgres",
      url: baseUrl,
      localEngine: "indexeddb"
    }));
    localStorage.setItem("va.cloudToken.v1", jwt);
    localStorage.setItem("va.cloudUser.v1", JSON.stringify(cloudUser));
    localStorage.setItem("va_session", `s_e2e_cloud:${cloudUser?.id || "admin"}:${expiresAt}`);
    localStorage.setItem("videoArchive:theme", "dark");
    localStorage.setItem("videoArchive:themeVersion", "v4");
  }, {
    token,
    user: user || seed.user,
    baseUrl: API_BASE_URL === BASE_URL ? "" : API_BASE_URL,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  return async () => {
    await serverRpc(token, "replaceAll", [originalSnapshot]);
  };
}

async function navigateAndAssert(page, route, heading) {
  await page.goto(routeUrl(route), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: new RegExp(escapeRegExp(heading)) }).first().waitFor({ state: "visible" });
  const snapshot = await page.evaluate(() => ({
    textLength: document.body.innerText.trim().length,
    busyCount: document.querySelectorAll("[aria-busy='true']").length
  }));
  if (snapshot.textLength < 20) {
    throw new Error(`Blank or near-blank page at ${route}`);
  }
  await assertNoHorizontalOverflow(page, route);
  await assertInteractiveNames(page, route);
}

async function clickConfirm(page, label) {
  let dialog = page.locator("role=dialog").first();
  if ((await dialog.count()) === 0) {
    dialog = page.locator("role=alertdialog").first();
  }
  await dialog.waitFor({ state: "visible" });

  const input = dialog.locator("input").first();
  if ((await input.count()) > 0) {
    const placeholder = (await input.getAttribute("placeholder")) || label;
    await input.fill(placeholder);
  }

  await dialog.getByRole("button", { name: label }).last().click();
}

async function expectDownload(page, label, action) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    action()
  ]);
  const fileName = download.suggestedFilename();
  const savePath = path.join(OUTPUT_DIR, fileName);
  await download.saveAs(savePath);
  report.downloads.push({ label, fileName, path: savePath });
  return fileName;
}

async function runPageMatrix(page) {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const target of PAGE_TARGETS) {
      await navigateAndAssert(page, target.route, target.heading);
      await captureScreenshot(page, `${viewport.id}-${target.route}`);
    }
  }
  markStep("فتح كل صفحات التطبيق", "passed", `${PAGE_TARGETS.length} صفحة × ${VIEWPORTS.length} أحجام`);
}

async function runDashboardMobileTouchFlow(browser) {
  if (E2E_MODE !== "local") {
    markStep("فحص ضغط أزرار لوحة التحكم على الجوال", "passed", "يعمل في local mode فقط لأن server mode يستخدم جلسة خادم مشتركة");
    return;
  }

  const mobileContext = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "ar-EG"
  });
  const mobilePage = await mobileContext.newPage();
  mobilePage.setDefaultTimeout(15_000);
  try {
    await seedLocalArchive(mobilePage);
    await navigateAndAssert(mobilePage, "#/dashboard", "مركز التحكم");
    await mobilePage.getByRole("button", { name: "تخصيص ترتيب لوحة التحكم" }).tap();
    await mobilePage.locator(".va-command-center-hero").getByRole("button", { name: /إضافة فيديو/ }).tap();
    await mobilePage.getByRole("heading", { name: /إضافة فيديو/ }).first().waitFor({ state: "visible" });
    markStep("فحص ضغط أزرار لوحة التحكم على الجوال أثناء التخصيص");
  } catch (error) {
    await captureScreenshot(mobilePage, "mobile-touch-dashboard-failure").catch(() => {});
    const diagnostics = await mobilePage.evaluate(() => ({
      hash: window.location.hash,
      activeText: (document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute?.("aria-label") || "").slice(0, 200),
      topHeading: document.querySelector("h1,h2")?.textContent?.trim() || ""
    })).catch(() => ({}));
    throw new Error(`${error.message} Mobile diagnostics: ${JSON.stringify(diagnostics)}`);
  } finally {
    await mobileContext.close().catch(() => {});
  }
}

async function runTypeFlow(page) {
  const typeName = "نوع فحص شامل";
  await navigateAndAssert(page, "#/types", "إدارة الأنواع والحقول");
  await page.getByRole("button", { name: /نوع جديد/ }).click();
  await page.getByLabel("الأيقونة").fill("E");
  await page.getByLabel("اسم النوع").fill(typeName);
  await page.getByLabel("اسم داخلي/إنجليزي").fill("e2e_comprehensive");
  await page.getByRole("button", { name: "التالي" }).click();
  await page.getByLabel("اسم الفرع الجديد").fill("فرع تجريبي");
  await page.getByLabel("اسم الفرع الجديد").press("Enter");
  await page.getByRole("button", { name: "التالي" }).click();
  await page.getByLabel("اسم الحقل المخصص").fill("الجهة المنتجة");
  await page.getByRole("button", { name: "إضافة الحقل" }).click();
  await page.getByRole("button", { name: "التالي" }).click();
  await page.getByRole("button", { name: "إنشاء النوع" }).click();
  await page.getByText(typeName).first().waitFor({ state: "visible" });
  markStep("إنشاء نوع محتوى مع فرع وحقل مخصص");
  return typeName;
}

async function runAddVideoFlow(page, typeName) {
  const itemTitle = "فيديو فحص شامل جديد";
  await navigateAndAssert(page, "#/add", "إضافة فيديو");
  await page.getByLabel("العنوان").fill(itemTitle);
  await page.getByLabel("الرابط أو المسار").fill("C:/archive/e2e/new-comprehensive-video.mp4");
  await page.getByLabel("الصورة المصغرة").fill("https://example.com/thumb.jpg");
  await page.getByLabel("ملاحظات").fill("ملاحظات تجريبية أضيفت من فحص Playwright الشامل.");
  await page.getByRole("button", { name: /التالي/ }).click();
  await page.getByLabel("نوع المحتوى").selectOption({ label: typeName });
  await page.getByLabel("الوسوم").fill("اختبار شامل, واجهة, حذف");
  await page.getByRole("button", { name: /التالي/ }).click();
  await page.getByLabel("الجهة المنتجة").fill("فريق ضمان الجودة");
  await page.getByRole("button", { name: /التالي/ }).click();
  await page.getByRole("button", { name: "حفظ وفتح التفاصيل" }).click();
  await page.getByRole("heading", { name: /تفاصيل الفيديو/ }).first().waitFor({ state: "visible" });
  await page.getByText(itemTitle).first().waitFor({ state: "visible" });
  markStep("إضافة فيديو جديد وفتح التفاصيل");

  await page.getByRole("button", { name: /^حذف$/ }).first().click();
  await clickConfirm(page, "نقل للسلة");
  await page.getByRole("button", { name: "استعادة" }).first().waitFor({ state: "visible" });
  await page.getByRole("button", { name: "استعادة" }).first().click();
  await page.getByRole("button", { name: /^حذف$/ }).first().waitFor({ state: "visible" });
  markStep("حذف فيديو واستعادته من التفاصيل");
}

async function runUsersFlow(page) {
  const displayName = "مستخدم تجربة شامل";
  await navigateAndAssert(page, "#/users", "المستخدمون");
  await page.getByRole("button", { name: /مستخدم جديد/ }).click();
  await page.getByLabel("اسم المستخدم").fill("e2e_editor");
  await page.getByLabel("الاسم المعروض").fill(displayName);
  await page.getByLabel("البريد الإلكتروني").fill("e2e-editor@example.com");
  await page.getByLabel("كلمة المرور الأولية").fill("TestPass1!");
  await page.getByRole("radio", { name: /محرر|Editor/i }).click().catch(async () => {
    await page.getByRole("radio").nth(1).click();
  });
  await page.getByRole("button", { name: "إنشاء المستخدم" }).click();
  const userCard = page.locator("article").filter({ hasText: displayName }).first();
  await userCard.waitFor({ state: "visible" });
  markStep("إنشاء مستخدم تجريبي");

  await userCard.getByRole("button", { name: "تعطيل" }).click();
  await userCard.getByText("معطل").waitFor({ state: "visible" });
  markStep("تعطيل مستخدم تجريبي مباشرة");

  await userCard.getByRole("button", { name: "تفعيل" }).click();
  await userCard.getByRole("button", { name: "تعطيل" }).waitFor({ state: "visible" });
  await userCard.getByRole("button", { name: new RegExp(`حذف ${escapeRegExp(displayName)}`) }).click();
  await clickConfirm(page, "تعطيل");
  await userCard.getByText("معطل").waitFor({ state: "visible" });
  markStep("تعطيل مستخدم تجريبي عبر تأكيد الحذف");
}

async function runCollectionsFlow(page) {
  const collectionName = "مجموعة فحص شاملة";
  await navigateAndAssert(page, "#/collections", "المجموعات");
  await page.getByRole("button", { name: /مجموعة جديدة/ }).click();
  await page.getByLabel("اسم المجموعة").fill(collectionName);
  await page.getByLabel("الوصف").fill("مجموعة مؤقتة لفحص الإضافة والحذف.");
  await page.getByRole("button", { name: "إنشاء المجموعة" }).click();
  await page.getByText(collectionName).first().waitFor({ state: "visible" });
  markStep("إنشاء مجموعة يدوية");

  const addList = page.getByRole("listbox", { name: "العناصر المتاحة للإضافة" });
  await addList.getByRole("option", { name: /لقطة اختبار ميدانية/ }).click();
  await page.getByRole("button", { name: /إضافة 1/ }).click();
  await page.getByText("تمت إضافة العناصر للمجموعة").waitFor({ state: "visible" }).catch(() => {});
  markStep("إضافة عنصر إلى مجموعة");

  await page.getByRole("button", { name: /إزالة لقطة اختبار ميدانية من المجموعة/ }).click();
  await page.getByText("المجموعة فارغة").first().waitFor({ state: "visible" });
  markStep("إزالة عنصر من مجموعة");

  await page.getByRole("button", { name: new RegExp(`حذف ${escapeRegExp(collectionName)}`) }).click();
  await clickConfirm(page, "حذف");
  await page.getByText(collectionName).first().waitFor({ state: "detached" }).catch(() => {});
  markStep("حذف مجموعة تجريبية");
}

async function runProjectsFlow(page) {
  const projectName = "مشروع فحص شامل";
  await navigateAndAssert(page, "#/projects", "مشاريع المونتاج");
  await page.getByRole("button", { name: /مشروع جديد/ }).click();
  await page.getByLabel("اسم المشروع").fill(projectName);
  await page.getByLabel("الوصف (اختياري)").fill("مشروع مؤقت لفحص الخط الزمني والتصدير.");
  await page.getByRole("button", { name: "إنشاء المشروع" }).click();
  await page.getByText(projectName).first().waitFor({ state: "visible" });
  await page.getByLabel("بداية (ث)").fill("0");
  await page.getByLabel("نهاية (ث)").fill("12");
  await page.getByLabel("وصف القصاصة (اختياري)").fill("لقطة افتتاح");
  await page.getByRole("button", { name: /إضافة للخطّ الزمني/ }).click();
  await page.getByText("لقطة افتتاح").first().waitFor({ state: "visible" });
  markStep("إنشاء مشروع وإضافة قصاصة");

  await expectDownload(page, "project-json", () => page.getByRole("button", { name: /تصدير JSON/ }).click());
  await expectDownload(page, "project-edl", () => page.getByRole("button", { name: /تصدير EDL/ }).click());
  markStep("تصدير مشروع JSON و EDL");

  await page.getByRole("button", { name: new RegExp(`حذف ${escapeRegExp(projectName)}`) }).click();
  await clickConfirm(page, "حذف");
  markStep("حذف مشروع تجريبي");
}

async function runDataCenterFlow(page) {
  await navigateAndAssert(page, "#/backup", "مركز البيانات");
  await expectDownload(page, "data-json", () => page.getByRole("button", { name: "تنزيل الآن" }).click());
  await page.getByRole("button", { name: /Excel متعدد الأوراق/ }).click();
  await expectDownload(page, "data-excel", () => page.getByRole("button", { name: "تنزيل الآن" }).click());
  await page.getByRole("button", { name: /CSV/ }).click();
  await expectDownload(page, "data-csv", () => page.getByRole("button", { name: "تنزيل الآن" }).click());
  await page.getByRole("button", { name: /ملف نقل/ }).click();
  await expectDownload(page, "data-transfer", () => page.getByRole("button", { name: "تنزيل الآن" }).click());
  markStep("تصدير البيانات JSON وExcel وCSV وملف نقل");

  await page.getByRole("button", { name: /نسخ احتياطي/ }).click();
  await page.getByRole("button", { name: "إنشاء نسخة" }).click();
  await page.getByText("تم إنشاء نسخة احتياطية جديدة.").first().waitFor({ state: "visible" });
  markStep("إنشاء نسخة احتياطية");

  await page.getByRole("button", { name: "حذف" }).first().click();
  await clickConfirm(page, "حذف");
  await page.getByText("تم حذف النسخة الاحتياطية.").first().waitFor({ state: "visible" });
  markStep("حذف نسخة احتياطية");
}

async function runVocabularyAndTagsSmoke(page) {
  await navigateAndAssert(page, "#/vocabulary", "القاموس");
  await page.getByText("لقطة تأسيسية").first().waitFor({ state: "visible" });
  await navigateAndAssert(page, "#/htags", "الوسوم الهرمية");
  await page.getByText("اختبار شامل").first().waitFor({ state: "visible" });
  markStep("فحص بيانات القاموس والوسوم الهرمية");
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !E2E_HEADED });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 960 },
    locale: "ar-EG"
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  let restoreServerSnapshot = null;

  page.on("console", (message) => {
    if (message.type() === "error") {
      report.consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  page.on("pageerror", (error) => {
    report.pageErrors.push({ message: error.message, stack: error.stack });
  });

  try {
    if (E2E_MODE === "server") {
      restoreServerSnapshot = await seedServerArchive(page);
      markStep("زرع جلسة وبيانات اختبار على الخادم", "passed", API_BASE_URL);
    } else {
      await seedLocalArchive(page);
      markStep("زرع جلسة وبيانات اختبار محلية");
    }
    await runPageMatrix(page);
    await runDashboardMobileTouchFlow(browser);
    await page.setViewportSize({ width: 1440, height: 960 });
    const typeName = await runTypeFlow(page);
    await runAddVideoFlow(page, typeName);
    await runUsersFlow(page);
    await runCollectionsFlow(page);
    await runProjectsFlow(page);
    await runDataCenterFlow(page);
    await runVocabularyAndTagsSmoke(page);

    if (report.consoleErrors.length || report.pageErrors.length) {
      throw new Error(`Browser errors detected: console=${report.consoleErrors.length}, page=${report.pageErrors.length}`);
    }

    report.finishedAt = new Date().toISOString();
    report.status = "passed";
    await writeFile(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2), "utf8");
    await writeHtmlReport();
    console.log(`\nComprehensive UI audit passed. Report: ${path.join(OUTPUT_DIR, "report.json")}`);
    console.log(`HTML report: ${path.join(OUTPUT_DIR, "report.html")}`);
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.status = "failed";
    report.failure = { message: error.message, stack: error.stack };
    const screenshotPath = path.join(SCREENSHOT_DIR, "failure.png");
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    report.screenshots.push({ label: "failure", path: screenshotPath });
    await writeFile(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2), "utf8");
    await writeHtmlReport().catch(() => {});
    console.error(`\nComprehensive UI audit failed: ${error.message}`);
    console.error(`Report: ${path.join(OUTPUT_DIR, "report.json")}`);
    console.error(`HTML report: ${path.join(OUTPUT_DIR, "report.html")}`);
    console.error(`Screenshot: ${screenshotPath}`);
    process.exitCode = 1;
  } finally {
    if (restoreServerSnapshot) {
      await restoreServerSnapshot().catch((error) => {
        console.error(`Failed to restore server snapshot: ${error?.message || error}`);
      });
    }
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

await main();
