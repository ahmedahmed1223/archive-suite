import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DB_NAME = 'VideoArchiveDB';
const DB_VERSION = 5;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const TEST_USER_ID = 'user_a11y_v4_admin';
const TEST_ITEM_ID = 'video_a11y_v4_1';

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

const ROUTES = [
  { route: '#/dashboard', heading: 'مركز التحكم' }, // gloss: Control Center
  { route: '#/archive', heading: 'الأرشيف' },        // gloss: Archive
  { route: '#/settings', heading: 'الإعدادات' }      // gloss: Settings
];

type SeedTheme = 'dark' | 'light';
type SeedMotionLevel = 'full' | 'reduced' | 'off';
type SeedThemeVersion = 'v3' | 'v4';
type SeedOptions = {
  theme?: SeedTheme;
  motionLevel?: SeedMotionLevel;
  themeVersion?: SeedThemeVersion;
};

function nowIso() {
  return new Date().toISOString();
}

function makeSettings(timestamp: string, {
  theme = 'dark',
  motionLevel = 'off',
  themeVersion = 'v4'
}: SeedOptions = {}) {
  return {
    key: 'app_settings',
    theme,
    accentColor: 'emerald',
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
      onboardingThemeChoice: theme,
      visualDensity: 'comfortable',
      startupMode: 'balanced',
      lastSettingsTab: 'appearance',
      lastDataCenterTab: 'export',
      lastImportMode: 'merge',
      transferLastMode: 'merge',
      firstTaskChoice: 'dashboard',
      firstTaskChoiceUsed: true,
      deviceId: 'a11y-v4-device',
      deviceName: 'A11y V4 Matrix',
      themeVersion,
      motionLevel
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
    id: 'type_a11y_v4_reports',
    name: 'تقارير',
    nameEn: 'reports',
    icon: 'T',
    iconSpec: { type: 'text', value: 'T' },
    color: '#059669',
    coverImage: null,
    coverFit: 'cover',
    coverSourceName: '',
    coverUpdatedAt: null,
    subtypes: [
      { id: 'type_a11y_v4_reports_subtype_1', name: 'تحقيقي', order: 0, createdAt: timestamp, updatedAt: timestamp }
    ],
    fields: [
      { id: 'field_a11y_v4_source', label: 'المصدر', storageKey: 'source', type: 'text', order: 0 }
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
      subtype: 'type_a11y_v4_reports_subtype_1',
      title: 'Q4_report_FINAL_v2.mp4',
      path: 'C:/archive/seed/Q4_report_FINAL_v2.mp4',
      thumbnail: '',
      metadata: {
        source: 'فريق الأرشيف',
        localFile: {
          name: 'Q4_report_FINAL_v2.mp4',
          path: 'C:/archive/seed/Q4_report_FINAL_v2.mp4',
          relativePath: '',
          size: 12582912,
          type: 'video/mp4',
          lastModified: timestamp,
          extension: 'mp4'
        }
      },
      tags: ['فحص الوصول', 'مراجعة'],
      notes: 'عنصر ثابت لاختبار تباين v4.',
      isFavorite: true,
      isDeleted: false,
      version: 1,
      syncVersion: 1,
      lastModifiedBy: { userId: TEST_USER_ID, deviceId: 'a11y-v4-device', at: timestamp },
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
        id: 'history_a11y_v4_1',
        itemId: TEST_ITEM_ID,
        action: 'create',
        title: 'Q4_report_FINAL_v2.mp4',
        timestamp
      }
    ],
    collection: {
      id: 'collection_a11y_v4_1',
      name: 'مراجعة الوصول',
      description: 'مجموعة اختبار صغيرة لبوابة تباين v4.',
      type: 'manual',
      itemIds: [TEST_ITEM_ID],
      createdAt: timestamp,
      updatedAt: timestamp
    },
    auditLog: {
      id: 'audit_a11y_v4_1',
      action: 'seed.a11y.v4',
      targetId: TEST_ITEM_ID,
      targetType: 'video',
      meta: { source: 'playwright' },
      timestamp
    }
  };
}

async function seedV4Archive(page: Page, options: SeedOptions = {}) {
  const timestamp = nowIso();
  const seed = makeSeedRecords(timestamp);
  const settings = makeSettings(timestamp, options);
  const payload = {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stores: Object.values(STORES),
    dataStores: DATA_STORES,
    sessionUserId: TEST_USER_ID,
    sessionExpiresAt: Date.now() + SESSION_TTL_MS,
    settings,
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

    localStorage.setItem('va_session', `s_a11y_v4:${data.sessionUserId}:${data.sessionExpiresAt}`);
    localStorage.setItem('videoArchive:theme', data.settings.theme);
    localStorage.setItem('videoArchive:themeVersion', data.settings.ui.themeVersion);
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

async function openSeededV4Page(page: Page, route: string, heading: string, expectedVersion: SeedThemeVersion = 'v4') {
  await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (route === '#/dashboard') {
    await expect(page.getByRole('navigation', { name: 'القائمة الجانبية' }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^مركز التحكم$/ }).first().click();
  }
  await expect(page.getByRole('heading', { name: new RegExp(heading) }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme-version', expectedVersion);
  await page.waitForTimeout(350);
}

async function readVisualSnapshot(page: Page) {
  return page.evaluate(() => {
    const styleValue = (element: Element | null, property: string) =>
      element ? getComputedStyle(element).getPropertyValue(property).trim() : null;
    const surface = document.querySelector(
      '.va-card, .va-surface, .va-surface-muted, .va-metric-card, .va-action-card, .va-control-surface, .va-filter-surface, .va-tab-surface, .va-preview-panel, .va-data-card, .va-video-card'
    );
    const sidebar = document.querySelector('.va-sidebar');
    const contextBar = document.querySelector('.va-context-bar');
    const primaryButton = document.querySelector('.va-primary-button');

    return {
      htmlTheme: document.documentElement.dataset.themeVersion,
      htmlClass: document.documentElement.className,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      shellMotion: document.querySelector('.va-app-shell')?.getAttribute('data-motion') ?? null,
      sidebarBlur: styleValue(sidebar, 'backdrop-filter') || styleValue(sidebar, '-webkit-backdrop-filter'),
      contextBlur: styleValue(contextBar, 'backdrop-filter') || styleValue(contextBar, '-webkit-backdrop-filter'),
      surfaceExists: Boolean(surface),
      surfaceBackground: styleValue(surface, 'background-color'),
      surfaceBlur: styleValue(surface, 'backdrop-filter') || styleValue(surface, '-webkit-backdrop-filter'),
      primaryButtonExists: Boolean(primaryButton),
      primaryButtonBackgroundImage: styleValue(primaryButton, 'background-image'),
      primaryButtonBackgroundColor: styleValue(primaryButton, 'background-color')
    };
  });
}

function expectBlurredChrome(value: string | null) {
  expect(value ?? '').toContain('blur(');
}

async function expectV4VisualFoundation(page: Page, theme: SeedTheme) {
  const snapshot = await readVisualSnapshot(page);
  expect(snapshot.htmlTheme).toBe('v4');
  expect(snapshot.htmlClass).toContain(theme);
  expect(snapshot.bodyBackground).toBe(theme === 'dark' ? 'rgb(6, 11, 18)' : 'rgb(238, 242, 247)');
  expect(snapshot.shellMotion).toBe('full');
  expectBlurredChrome(snapshot.sidebarBlur);
  expectBlurredChrome(snapshot.contextBlur);
  expect(snapshot.surfaceExists).toBe(true);
  expect(snapshot.surfaceBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(snapshot.surfaceBlur).toBe('none');
  if (snapshot.primaryButtonExists) {
    expect(snapshot.primaryButtonBackgroundImage).toBe('none');
    expect(snapshot.primaryButtonBackgroundColor).toBe(theme === 'dark' ? 'rgb(6, 78, 59)' : 'rgb(4, 120, 87)');
  }
}

for (const target of ROUTES) {
  test(`v4 contrast: ${target.route}`, async ({ page }) => {
    await seedV4Archive(page);
    await openSeededV4Page(page, target.route, target.heading);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .withRules(['color-contrast'])
      .include('body')
      .analyze();
    const violations = results.violations.filter((violation) => violation.id === 'color-contrast');
    expect(violations, JSON.stringify(violations.map((violation) => ({
      nodes: violation.nodes.map((node) => ({ target: node.target, html: node.html }))
    })), null, 2)).toEqual([]);
  });
}

for (const theme of ['dark', 'light'] as const) {
  for (const target of ROUTES) {
    test(`v4 visual foundation ${theme}: ${target.route}`, async ({ page }) => {
      await seedV4Archive(page, { theme, motionLevel: 'full' });
      await openSeededV4Page(page, target.route, target.heading);
      await page.waitForTimeout(700);
      await expectV4VisualFoundation(page, theme);
    });
  }
}

test('theme version rollback: v3 remains available', async ({ page }) => {
  await seedV4Archive(page, { theme: 'dark', motionLevel: 'full', themeVersion: 'v3' });
  await openSeededV4Page(page, '#/dashboard', 'مركز التحكم', 'v3');
  const snapshot = await readVisualSnapshot(page);
  expect(snapshot.htmlTheme).toBe('v3');
});
