/**
 * Shared IndexedDB seed helper for E2E tests.
 * Seeds a minimal authenticated session so tests can skip the login/onboarding screens.
 *
 * Usage:
 *   import { seedLocalArchive } from './helpers/seed';
 *   await seedLocalArchive(page);
 *   await page.goto('/#/dashboard', { waitUntil: 'domcontentloaded' });
 *   await page.reload({ waitUntil: 'domcontentloaded' });
 */

import type { Page } from '@playwright/test';

export const DB_NAME = 'VideoArchiveDB';
export const DB_VERSION = 5;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const TEST_USER_ID = 'user_e2e_admin';
export const TEST_ITEM_ID = 'video_e2e_1';

const STORES = [
  'content_types',
  'video_items',
  'change_history',
  'app_settings',
  'backups',
  'bookmarks',
  'video_relations',
  'virtual_collections',
  'vocabulary',
  'hierarchical_tags',
  'users',
  'audit_logs',
  'projects',
] as const;

const DATA_STORES = STORES.filter((s) => s !== 'app_settings');

function nowIso() {
  return new Date().toISOString();
}

function makeSettings(timestamp: string) {
  return {
    key: 'app_settings',
    theme: 'dark',
    accentColor: 'teal',
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
      deviceId: 'e2e-device',
      deviceName: 'E2E Runner',
      themeVersion: 'v3',
    },
    notifications: {
      durationMs: 5500,
      persistImportant: true,
      desktopEnabled: false,
    },
    systemHealth: {
      lastCheckAt: timestamp,
      startupLastStatus: 'ok',
    },
    syncPeers: {},
    onboardingRequired: false,
    initialAdminPassword: null,
    masterPasswordHash: '',
  };
}

function makeSeedData(timestamp: string) {
  const contentType = {
    id: 'type_e2e_news',
    name: 'أخبار',
    nameEn: 'news',
    icon: '📰',
    iconSpec: { type: 'emoji', value: '📰' },
    color: '#059669',
    coverImage: null,
    coverFit: 'cover',
    coverSourceName: '',
    coverUpdatedAt: null,
    subtypes: [],
    fields: [],
    order: 0,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const videoItem = {
    id: TEST_ITEM_ID,
    type: contentType.id,
    subtype: null,
    title: 'فيديو اختبار E2E',
    path: 'C:/archive/e2e/test.mp4',
    thumbnail: '',
    metadata: {
      localFile: {
        name: 'test.mp4',
        path: 'C:/archive/e2e/test.mp4',
        relativePath: '',
        size: 1048576,
        type: 'video/mp4',
        lastModified: timestamp,
        extension: 'mp4',
      },
    },
    tags: ['اختبار'],
    notes: 'عنصر اختبار E2E.',
    isFavorite: false,
    isDeleted: false,
    version: 1,
    syncVersion: 1,
    lastModifiedBy: { userId: TEST_USER_ID, deviceId: 'e2e-device', at: timestamp },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const user = {
    id: TEST_USER_ID,
    username: 'admin',
    displayName: 'المدير',
    passwordHash: '',
    role: 'admin',
    isActive: true,
    lastLoginAt: timestamp,
    mustChangePassword: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return { contentType, videoItem, user };
}

export async function seedLocalArchive(page: Page) {
  const timestamp = nowIso();
  const seed = makeSeedData(timestamp);
  const payload = {
    dbName: DB_NAME,
    dbVersion: DB_VERSION,
    stores: [...STORES],
    dataStores: [...DATA_STORES],
    sessionUserId: TEST_USER_ID,
    sessionExpiresAt: Date.now() + SESSION_TTL_MS,
    settings: makeSettings(timestamp),
    ...seed,
  };

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async (data) => {
    const openDb = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(data.dbName, data.dbVersion);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const storeName of data.stores) {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, {
                keyPath: storeName === 'app_settings' ? 'key' : 'id',
              });
            }
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
      });

    const transact = (
      db: IDBDatabase,
      storeNames: string[],
      mode: IDBTransactionMode,
      run: (tx: IDBTransaction) => void,
    ): Promise<void> =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeNames, mode);
        run(tx);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IDB transaction failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
      });

    localStorage.setItem(
      'va_session',
      `s_e2e:${data.sessionUserId}:${data.sessionExpiresAt}`,
    );
    localStorage.setItem('videoArchive:theme', 'dark');
    localStorage.setItem('videoArchive:themeVersion', 'v3');

    const db = await openDb();
    await transact(db, data.dataStores, 'readwrite', (tx) => {
      for (const storeName of data.dataStores) tx.objectStore(storeName).clear();
    });
    await transact(db, ['app_settings'], 'readwrite', (tx) => {
      tx.objectStore('app_settings').put(data.settings);
    });
    await transact(
      db,
      ['content_types', 'video_items', 'users'],
      'readwrite',
      (tx) => {
        tx.objectStore('content_types').put(data.contentType);
        tx.objectStore('video_items').put(data.videoItem);
        tx.objectStore('users').put(data.user);
      },
    );
    db.close();
  }, payload);
}

/** Navigate to a seeded page and wait for the sidebar nav to appear. */
export async function goToPage(page: Page, route: string) {
  await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
}
