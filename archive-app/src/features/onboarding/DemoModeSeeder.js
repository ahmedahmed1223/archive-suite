/**
 * DemoModeSeeder — seeds a handful of realistic sample items so new users can
 * explore the archive immediately without importing real content (§1246).
 *
 * All demo items carry `_isDemo: true` so they can be identified and removed
 * later (e.g., when the user completes the full cloud setup or explicitly
 * requests cleanup via Settings → Demo Data).
 *
 * Usage
 * -----
 *   import { seedDemoData, clearDemoData } from "./DemoModeSeeder.js";
 *   await seedDemoData(addVideoItem);
 *   await clearDemoData(videoItems, deleteVideoItemPermanently);
 */

export const DEMO_FLAG = "_isDemo";

const DEMO_ITEMS = [
  {
    title: "مقابلة المدير التنفيذي — Q4 2024",
    type: "interview",
    tags: ["مقابلة", "إدارة", "Q4"],
    description: "مقابلة موسعة مع المدير التنفيذي حول خطط النمو وأبرز إنجازات الربع الرابع.",
    duration: 2580,
    fileSize: 1234567890,
    thumbnailUrl: null,
  },
  {
    title: "تقرير المؤتمر السنوي 2025",
    type: "report",
    tags: ["مؤتمر", "تقرير", "2025"],
    description: "تغطية كاملة لفعاليات المؤتمر السنوي مع مقاطع مختارة من الجلسات الرئيسية.",
    duration: 5400,
    fileSize: 2876543210,
    thumbnailUrl: null,
  },
  {
    title: "كليب ترويجي — منتج جديد",
    type: "promo",
    tags: ["ترويج", "منتج", "إعلان"],
    description: "كليب قصير للإعلان عن المنتج الجديد ضمن الحملة الترويجية لموسم الربيع.",
    duration: 90,
    fileSize: 156789012,
    thumbnailUrl: null,
  },
  {
    title: "ورشة عمل: التحرير الاحترافي",
    type: "workshop",
    tags: ["تدريب", "تحرير", "ورشة"],
    description: "سلسلة تدريبية متكاملة تغطي أساليب التحرير الاحترافي وتقنيات المونتاج الحديثة.",
    duration: 7200,
    fileSize: 3456789012,
    thumbnailUrl: null,
  },
  {
    title: "لقطات خلف الكواليس — حفل التكريم",
    type: "event",
    tags: ["حفل", "خلف الكواليس", "تكريم"],
    description: "لقطات غير رسمية من كواليس حفل التكريم السنوي تظهر التحضيرات والأجواء.",
    duration: 1800,
    fileSize: 987654321,
    thumbnailUrl: null,
  },
];

/**
 * Seeds demo items using the store's addVideoItem action.
 *
 * @param {Function} addVideoItem   — store action (item) => Promise<void>
 * @returns {Promise<string[]>}     — IDs of created demo items
 */
export async function seedDemoData(addVideoItem) {
  if (!addVideoItem) return [];
  const ids = [];
  for (const partial of DEMO_ITEMS) {
    try {
      const item = { ...partial, [DEMO_FLAG]: true };
      const created = await addVideoItem(item);
      if (created?.id) ids.push(created.id);
    } catch {
      /* non-fatal: best-effort seeding */
    }
  }
  return ids;
}

/**
 * Removes all demo items from the store.
 *
 * @param {object[]} videoItems                   — current archive items array
 * @param {Function} deleteVideoItemPermanently   — store action (id) => Promise<void>
 * @returns {Promise<number>}                     — count of removed items
 */
export async function clearDemoData(videoItems = [], deleteVideoItemPermanently) {
  if (!deleteVideoItemPermanently) return 0;
  const demoItems = videoItems.filter((item) => item?.[DEMO_FLAG]);
  for (const item of demoItems) {
    try {
      await deleteVideoItemPermanently(item.id);
    } catch {
      /* non-fatal */
    }
  }
  return demoItems.length;
}

/**
 * Returns true if the item was created by the demo seeder.
 * @param {object} item
 */
export function isDemoItem(item) {
  return Boolean(item?.[DEMO_FLAG]);
}
