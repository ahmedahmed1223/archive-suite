/**
 * Getting-Started Checklist — pure model.
 * Computes real done/not-done state from app data.
 * ponytail: dismissed state piggybacks on settings.ui.dismissedBanners ("checklist-done")
 * rather than a new field — avoids touching the settings schema.
 */

export interface ChecklistStep {
  id: string;
  label: string;
  done: boolean;
}

type AnyRecord = Record<string, any>;

export function buildGettingStartedChecklist({
  videoItems = [],
  contentTypes = [],
  virtualCollections = [],
  uploads = [],
  settings = {}
}: {
  videoItems?: AnyRecord[];
  contentTypes?: AnyRecord[];
  virtualCollections?: AnyRecord[];
  uploads?: AnyRecord[];
  settings?: AnyRecord;
} = {}): ChecklistStep[] {
  const activeItems = videoItems.filter((item) => !item.isDeleted);
  const hasItem = activeItems.length > 0;
  const hasType = contentTypes.length > 0;
  const hasCollection = virtualCollections.length > 0;
  const hasUpload = uploads.length > 0 || activeItems.some((item) =>
    item.metadata?.fileSize || item.metadata?.filePath || item.filePath || item.fileUrl
  );
  const hasBackup = !!settings.lastBackupAt;
  const hasPassword = !!settings.ui?.onboardingSecurityMode && settings.ui.onboardingSecurityMode !== "quick";

  return [
    { id: "create-type", label: "أنشئ نوعًا أول", done: hasType },
    { id: "add-item", label: "أضف أول مادة أرشيفية", done: hasItem },
    { id: "upload-file", label: "ارفع ملفًا إلى مادة", done: hasUpload },
    { id: "create-collection", label: "أنشئ مجموعة", done: hasCollection },
    { id: "backup", label: "أنشئ نسخة احتياطية أولى", done: hasBackup },
    { id: "security", label: "فعّل حماية كلمة المرور", done: hasPassword }
  ];
}

export function isChecklistComplete(steps: ChecklistStep[]): boolean {
  return steps.length > 0 && steps.every((s) => s.done);
}

/** Uses the existing dismissedBanners list to avoid a new settings field. */
export const CHECKLIST_BANNER_ID = "checklist-done";

export function isChecklistDismissed(settings: AnyRecord = {}): boolean {
  return !!(settings.ui?.dismissedBanners || []).includes(CHECKLIST_BANNER_ID);
}

/** Returns the updated dismissedBanners array to pass into updateSettings. */
export function dismissChecklist(settings: AnyRecord = {}): string[] {
  const existing: string[] = settings.ui?.dismissedBanners || [];
  if (existing.includes(CHECKLIST_BANNER_ID)) return existing;
  return [...existing, CHECKLIST_BANNER_ID];
}
