import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DB_NAME = 'VideoArchiveDB';
const DB_VERSION = 5;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TEST_USER_ID = 'user_a11y_admin';
const TEST_ITEM_ID = 'video_a11y_1';

const STORES = {
  TYPES: 'content_types',
  ITEMS: 'video_items',
  HISTORY: 'change_history',
  SETTINGS: 'app_settings',
  BACKUPS: 'backups',
  BOOKMARKS: 'bookmarks',
  RELATIONS: 'video_relations',
  COLLECTIONS: 'virtual_collections',
  VOCABULARY: 'vocabulary',
  HTAGS: 'hierarchical_tags',
  USERS: 'users',
  AUDIT_LOGS: 'audit_logs',
  PROJECTS: 'projects'
} as const;

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
  { id: 'dashboard', label: 'dashboard', route: '#/dashboard', heading: 'مركز التحكم' },
  { id: 'archive', label: 'archive', route: '#/archive', heading: 'الأرشيف' },
  { id: 'add', label: 'add', route: '#/add', heading: 'إضافة فيديو' },
  { id: 'search', label: 'search', route: '#/search', heading: 'البحث' },
  { id: 'detail', label: 'detail', route: `#/detail/${TEST_ITEM_ID}`, heading: 'تفاصيل' },
  { id: 'backup', label: 'data-center', route: '#/backup', heading: 'مركز البيانات' },
  { id: 'reports', label: 'reports', route: '#/reports', heading: 'التقارير' },
  { id: 'settings', label: 'settings', route: '#/settings', heading: 'الإعدادات' }
];

function nowIso() {
  return new Date().toISOString();
}

function makeSettings(timestamp: string) {
  return {
    key: 'app_settings',
    theme: 'dark',
    accentColor: 'blue',
    numberSystem: 'arabic',
    dateFormat: 'gregorian',
    backupSchedule: 'manual',
    lastBackupAt: timestamp,
    keyboardShortcuts: {},
    ui: {
      v1OnboardingCompleted: true,
      v1TourCompleted: true,
      onboardingCompleted: true,
      onboardingSkippedAt: null,
      lastOnboardingStep: 'daily-start',
      onboardingSecurityMode: 'quick',
      onboardingThemeChoice: 'dark',
      visualDensity: 'comfortable',
      startupMode: 'balanced',
      lastSettingsTab: 'general',
      lastDataCenterTab: 'export',
      lastImportMode: 'merge',
      transferLastMode: 'merge',
      firstTaskChoice: 'dashboard',
      firstTaskChoiceUsed: true,
      deviceId: 'a11y-device',
      deviceName: 'A11y Matrix',
      themeVersion: 'v3'
    },
    notifications: {
      durationMs: 5500,
      persistImportant: true,
      desktopEnabled: false
    },
    systemHealth: {
      lastCheckAt: timestamp,
      startupLastStatus: 'ok'
    },
    syncPeers: {},
    onboardingRequired: false,
    initialAdminPassword: null,
    masterPasswordHash: ''
  };
}

function makeSeedRecords(timestamp: string) {
  const contentType = {
    id: 'type_a11y_reports',
    name: 'تقارير',
    nameEn: 'reports',
    icon: '🧾',
    iconSpec: { type: 'emoji', value: '🧾' },
    color: '#2563eb',
    coverImage: null,
    coverFit: 'cover',
    coverSourceName: '',
    coverUpdatedAt: null,
    subtypes: [
      { id: 'type_a11y_reports_subtype_1', name: 'تحقيقي', order: 0, createdAt: timestamp, updatedAt: timestamp },
      { id: 'type_a11y_reports_subtype_2', name: 'أرشيفي', order: 1, createdAt: timestamp, updatedAt: timestamp }
    ],
    fields: [
      { id: 'field_a11y_source', label: 'المصدر', storageKey: 'source', type: 'text', order: 0 },
      { id: 'field_a11y_status', label: 'حالة المراجعة', storageKey: 'reviewStatus', type: 'select', options: ['يحتاج مراجعة', 'معتمد'], order: 1 }
    ],
    order: 0,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const videoItems = [
    {
      id: TEST_ITEM_ID,
      type: contentType.id,
      subtype: 'type_a11y_reports_subtype_1',
      title: 'تقرير تجريبي لفحص الوصول',
      path: 'C:/archive/seed/report-a11y.mp4',
      thumbnail: '',
      metadata: {
        source: 'فريق الأرشيف',
        reviewStatus: 'يحتاج مراجعة',
        localFile: {
          name: 'report-a11y.mp4',
          path: 'C:/archive/seed/report-a11y.mp4',
          relativePath: '',
          size: 12582912,
          type: 'video/mp4',
          lastModified: timestamp,
          extension: 'mp4'
        }
      },
      tags: ['فحص الوصول', 'مراجعة'],
      notes: 'عنصر صغير ثابت لاختبار صفحات الأرشيف والتفاصيل.',
      isFavorite: true,
      isDeleted: false,
      version: 1,
      syncVersion: 1,
      lastModifiedBy: { userId: TEST_USER_ID, deviceId: 'a11y-device', at: timestamp },
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];

  return {
    contentType,
    videoItems,
    user: {
      id: TEST_USER_ID,
      username: 'admin',
      displayName: 'المدير',
      passwordHash: '',
      role: 'admin',
      customPermissions: undefined,
      isActive: true,
      lastLoginAt: timestamp,
      mustChangePassword: false,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    history: [
      {
        id: 'history_a11y_1',
        itemId: TEST_ITEM_ID,
        action: 'create',
        title: 'تقرير تجريبي لفحص الوصول',
        timestamp
      }
    ],
    collection: {
      id: 'collection_a11y_1',
      name: 'مراجعة الوصول',
      description: 'مجموعة اختبار صغيرة لمصفوفة UX.',
      type: 'manual',
      itemIds: [TEST_ITEM_ID],
      createdAt: timestamp,
      updatedAt: timestamp
    },
    auditLog: {
      id: 'audit_a11y_1',
      action: 'seed.a11y',
      targetId: TEST_ITEM_ID,
      targetType: 'video',
      meta: { source: 'playwright' },
      timestamp
    }
  };
}

async function seedLocalArchive(page: Page) {
  const timestamp = nowIso();
  const seed = makeSeedRecords(timestamp);
  const payload = {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stores: Object.values(STORES),
    dataStores: DATA_STORES,
    sessionUserId: TEST_USER_ID,
    sessionExpiresAt: Date.now() + SESSION_TTL_MS,
    settings: makeSettings(timestamp),
    ...seed
  };

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (data) => {
    const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(data.dbName, data.dbVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const storeName of data.stores) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: storeName === 'app_settings' ? 'key' : 'id' });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });

    const transact = (db: IDBDatabase, storeNames: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction) => void) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeNames, mode);
        run(tx);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      });

    localStorage.setItem('va_session', `s_a11y:${data.sessionUserId}:${data.sessionExpiresAt}`);
    localStorage.setItem('videoArchive:theme', 'dark');
    localStorage.setItem('videoArchive:themeVersion', 'v3');
    const db = await openDb();
    await transact(db, data.dataStores, 'readwrite', (tx) => {
      for (const storeName of data.dataStores) tx.objectStore(storeName).clear();
    });
    await transact(db, ['app_settings'], 'readwrite', (tx) => {
      tx.objectStore('app_settings').put(data.settings);
    });
    await transact(db, ['content_types', 'video_items', 'users', 'change_history', 'virtual_collections', 'audit_logs'], 'readwrite', (tx) => {
      tx.objectStore('content_types').put(data.contentType);
      for (const item of data.videoItems) tx.objectStore('video_items').put(item);
      tx.objectStore('users').put(data.user);
      for (const record of data.history) tx.objectStore('change_history').put(record);
      tx.objectStore('virtual_collections').put(data.collection);
      tx.objectStore('audit_logs').put(data.auditLog);
    });
    db.close();
  }, payload);
}

async function openSeededPage(page: Page, route: string, heading: string) {
  await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (route === '#/dashboard') {
    const nav = page.getByRole('navigation', { name: 'القائمة الجانبية' }).first();
    const menuButton = page.getByRole('button', { name: /^(فتح القائمة الجانبية|إغلاق القائمة الجانبية)$/ });
    if (await menuButton.count()) {
      await menuButton.first().click();
    }
    await expect(nav).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^مركز التحكم$/ }).first().click();
  }
  await expect(page.getByRole('heading', { name: new RegExp(heading) }).first()).toBeVisible({ timeout: 15_000 });
}

async function expectNoSeriousAxeViolations(page: Page, testInfo: TestInfo, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    // Contrast is tracked by the token migration work; this matrix gates structural serious/critical regressions.
    .disableRules(['color-contrast'])
    .analyze();

  const serious = results.violations.filter((violation) =>
    violation.impact === 'serious' || violation.impact === 'critical'
  );

  if (serious.length > 0) {
    await testInfo.attach(`a11y-${label}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png'
    });
  }

  expect(serious, JSON.stringify(serious.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target)
  })), null, 2)).toEqual([]);
}

for (const target of PAGE_TARGETS) {
  test(`a11y matrix: ${target.label}`, async ({ page }, testInfo) => {
    await seedLocalArchive(page);
    await openSeededPage(page, target.route, target.heading);
    await expectNoSeriousAxeViolations(page, testInfo, target.label);
  });
}
