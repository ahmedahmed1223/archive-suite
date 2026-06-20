import {
  useTheme
} from "../theme/useTheme.js";
import {
  formatDateTime,
  formatNumber
} from "../utils/formatting.js";
import {
  useAppStore,
  useAuthStore
} from "../stores/index.js";
import {
  Archive,
  Bell,
  Bot,
  CircleQuestionMark,
  Database,
  HardDrive,
  Keyboard,
  LayoutGrid,
  Lightbulb,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Tags,
  TriangleAlert,
  Users,
  Video
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { MotionPage, PageHero, SaveIndicator } from "../components/ui/index.js";
import { RoleSelectionStep } from "../components/onboarding/RoleSelectionStep.jsx";
import { useFormSaveState } from "../components/common/useFormSaveState.js";
import { resolveBackendChoice } from "../bootstrap/backendChoice.js";

import {
  createSettingsTabUiPatch,
  getSettingsTabState,
  normalizeSettingsTab
} from "../features/settings/viewModel.js";
import {
  DENSITY_OPTIONS,
  THEME_OPTIONS,
  VIEW_OPTIONS,
  ColorChoices,
  SegmentedChoices,
  SelectRow,
  SettingsCard,
  SettingsTabs,
  ShortcutManager,
  TextInputRow,
  ToggleRow,
  cx
} from "../features/settings/SettingsControls.jsx";
import { DatabaseSettings } from "../features/settings/DatabaseSettings.jsx";
import { FileStoreSettings } from "../features/settings/FileStoreSettings.jsx";
import { FirebaseBackendSettings } from "../features/settings/FirebaseBackendSettings.jsx";
import { LocalStorageEngineSettings } from "../features/settings/LocalStorageEngineSettings.jsx";
import { ServerStatusBadge } from "../features/server-status/ServerStatusBadge.jsx";
import { WebhooksSettings } from "../components/settings/WebhooksSettings.jsx";
import { ApiKeysSettings } from "../components/settings/ApiKeysSettings.jsx";
import { FieldPermissionsSettings } from "../components/settings/FieldPermissionsSettings.jsx";
import { NotificationPreferences } from "../components/settings/NotificationPreferences.jsx";
import { TwoFactorSettings } from "../components/settings/TwoFactorSettings.jsx";
import { ThemeGallery } from "../components/settings/ThemeGallery.jsx";
import { LiveThemeEditor } from "../components/settings/LiveThemeEditor.jsx";
import {
  getDefaultSettings,
  mergeAppSettings
} from "../utils/settings.js";
import {
  DEFAULT_DAISY_THEME,
  applyDaisyTheme,
  normalizeDaisyTheme,
  storeDaisyTheme
} from "../features/theme/daisyThemes.js";
import {
  applyCustomDaisyTheme,
  getStoredCustomDaisyTheme,
  normalizeCustomDaisyTheme,
  storeCustomDaisyTheme
} from "../features/theme/customDaisyTheme.js";
import { getAppearancePreviewModel } from "../features/theme/appearancePreview.js";
import {
  getStoredSchedule,
  normalizeSchedule,
  resolveScheduledTheme,
  storeSchedule,
  systemPrefersDark
} from "../features/theme/themeSchedule.js";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS
} from "../features/notifications/viewModel.js";
import { resolveSidebarLayoutMode } from "../features/navigation/sidebarLayoutModel.js";
import { reportError } from "../utils/errorReporting.js";
import { normalizeRoleProfileId } from "../features/onboarding/roleProfiles.js";
import { CloudControlTab } from "../features/settings/CloudControlTab.jsx";

const NOTIFICATION_TYPE_LABELS = {
  info: "معلومات",
  success: "نجاح",
  warning: "تحذير",
  error: "أخطاء"
};

const APPEARANCE_PRESETS = [
  {
    id: "daily-editor",
    name: "محرر يومي كثيف",
    detail: "قائمة مضغوطة، عناصر أكثر، حركة مخففة.",
    settings: { defaultView: "list", itemsPerPage: 48, accentColor: "emerald" },
    ui: { visualDensity: "compact", sidebarLayout: { mode: "collapsed" }, fontScale: "normal", motionLevel: "reduced", cardStyle: "outlined" }
  },
  {
    id: "reports-manager",
    name: "مدير تقارير",
    detail: "قراءة أوسع، أرقام لاتينية، واجهة هادئة.",
    settings: { defaultView: "details", itemsPerPage: 24, accentColor: "blue", numberSystem: "latn" },
    ui: { visualDensity: "comfortable", sidebarLayout: { mode: "expanded" }, fontScale: "normal", motionLevel: "full", cardStyle: "filled" }
  },
  {
    id: "mobile-review",
    name: "مراجعة موبايل",
    detail: "بطاقات، خط أكبر، حركة مخففة.",
    settings: { defaultView: "grid", itemsPerPage: 12, accentColor: "teal" },
    ui: { visualDensity: "comfortable", sidebarLayout: { mode: "collapsed" }, fontScale: "large", motionLevel: "reduced", cardStyle: "filled" }
  },
  {
    id: "light-review",
    name: "عرض خفيف",
    detail: "نهاري، بطاقات بسيطة، مساحة قراءة.",
    settings: { theme: "light", defaultView: "grid", itemsPerPage: 24, accentColor: "slate" },
    ui: { visualDensity: "comfortable", sidebarLayout: { mode: "expanded" }, fontScale: "normal", motionLevel: "off", cardStyle: "minimal" }
  }
];

function createAppearanceDraft(settings = {}, fallbackTheme = "dark") {
  const themeSchedule = normalizeSchedule({
    ...getStoredSchedule(),
    theme: settings.ui?.daisyTheme || DEFAULT_DAISY_THEME
  });
  const customDaisyTheme = normalizeCustomDaisyTheme(settings.ui?.customDaisyTheme || getStoredCustomDaisyTheme());
  return {
    daisyTheme: normalizeDaisyTheme(settings.ui?.daisyTheme || DEFAULT_DAISY_THEME),
    themeSchedule,
    customDaisyTheme,
    theme: settings.theme || fallbackTheme || "dark",
    accentColor: settings.accentColor || "teal",
    visualDensity: settings.ui?.visualDensity || "comfortable",
    fontScale: settings.ui?.fontScale || "normal",
    motionLevel: settings.ui?.motionLevel || "full",
    cardStyle: settings.ui?.cardStyle || "filled",
    sidebarMode: resolveSidebarLayoutMode(settings.ui?.sidebarLayout)
  };
}

function AppearanceStudioPreview({ draft, numberSystem = "latn" }) {
  const preview = getAppearancePreviewModel(draft);
  const customTheme = normalizeCustomDaisyTheme(draft.customDaisyTheme);
  return jsxs("div", {
    "data-theme": draft.daisyTheme,
    style: customTheme.enabled ? customTheme.vars : undefined,
    className: "rounded-2xl border border-base-300 bg-base-100 p-3 text-base-content shadow-sm",
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "flex items-center justify-between gap-3",
        children: [
          jsxs("div", {
            children: [
              jsx("p", { className: "text-xs text-base-content/60", children: "معاينة حيّة" }),
              jsx("h3", { className: "mt-1 text-base font-bold text-base-content", children: "محطة أرشيف مصغّرة" })
            ]
          }),
          jsx("span", { className: "badge badge-accent badge-sm", children: preview.densityLabel })
        ]
      }),
      jsxs("div", {
        className: "mt-3 grid gap-2 sm:grid-cols-[0.7fr_1fr]",
        children: [
          jsx("aside", {
            className: `rounded-xl border p-2 ${preview.cardClass}`,
            children: ["الأرشيف", "البحث", "المركز"].map((item, index) => jsxs("div", {
              className: `mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${index === 0 ? "bg-accent text-accent-content" : "text-base-content/55"}`,
              children: [
                jsx("span", { className: "h-2 w-2 rounded-full bg-current opacity-80" }),
                item
              ]
            }, item))
          }),
          jsxs("main", {
            className: `rounded-xl border p-3 ${preview.cardClass}`,
            children: [
              jsxs("div", {
                className: "flex items-center justify-between gap-2",
                children: [
                  jsx("p", { className: "text-sm font-semibold text-base-content", children: "مادة قيد المراجعة" }),
                  jsx("span", { className: "badge badge-primary badge-sm", children: `${formatNumber(82, numberSystem)}%` })
                ]
              }),
              jsx("div", { className: "mt-3 h-2 overflow-hidden rounded-full bg-base-300", children: jsx("div", { className: "h-full w-4/5 rounded-full bg-primary" }) }),
              jsx("p", { className: "mt-3 text-xs leading-5 text-base-content/60", children: preview.summary }),
              jsxs("div", {
                className: "mt-3 flex gap-2",
                children: [
                  jsx("span", { className: "btn btn-primary btn-xs", children: "فتح" }),
                  jsx("span", { className: "btn btn-ghost btn-xs", children: "تعديل" })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

export function SettingsPage() {
  const {
    settings: rawSettings = {},
    updateSettings,
    setMasterPassword,
    isPasswordSet,
    unlockApp,
    lockApp,
    runSystemHealthCheck,
    sqliteError,
    showToast,
    showNotification,
    setCurrentPage
  } = useAppStore();
  const authStore = useAuthStore();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const settings = React.useMemo(() => mergeAppSettings(getDefaultSettings(), rawSettings), [rawSettings]);
  const currentUser = authStore.currentUser;
  const isAdmin = currentUser?.role === "admin";
  const [activeTab, setActiveTabState] = React.useState(normalizeSettingsTab(settings.ui?.lastSettingsTab || "general"));
  const [appearanceDraft, setAppearanceDraft] = React.useState(() => createAppearanceDraft(settings, theme));
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [healthRunning, setHealthRunning] = React.useState(false);
  const appearanceImportRef = React.useRef(null);
  const passwordSave = useFormSaveState();
  const healthSave = useFormSaveState({ successTimeoutMs: 4000 });
  const tabState = getSettingsTabState(activeTab);
  const isDark = resolvedTheme === "dark";
  const backendChoice = React.useMemo(() => resolveBackendChoice(), [rawSettings]);
  React.useEffect(() => {
    setAppearanceDraft(createAppearanceDraft(settings, theme));
  }, [
    settings.accentColor,
    settings.theme,
    settings.ui?.cardStyle,
    settings.ui?.fontScale,
    settings.ui?.daisyTheme,
    settings.ui?.motionLevel,
    settings.ui?.sidebarLayout?.collapsed,
    settings.ui?.sidebarLayout?.mode,
    settings.ui?.visualDensity,
    theme
  ]);
  const aiStatus = React.useMemo(() => {
    if (backendChoice.forced) {
      return {
        tone: "amber",
        label: "محلي إجباري",
        title: "AI Studio يستخدم التخزين المحلي فقط",
        detail: "لا يتم ربط مزود ذكاء خارجي داخل هذا التشغيل."
      };
    }
    if (backendChoice.backend === "local") {
      return {
        tone: "amber",
        label: "غير متاح محلياً",
        title: "مزود الذكاء المحلي غير مفعّل",
        detail: "النسخة المحلية تستخدم مزوداً وهمياً، لذلك لا تُرسل مفاتيح أو طلبات AI من المتصفح."
      };
    }
    return {
      tone: "emerald",
      label: "Cloud AI",
      title: "مزود الذكاء يمر عبر الخادم",
      detail: backendChoice.url ? `الخادم: ${backendChoice.url}` : "الخادم: نفس أصل التطبيق"
    };
  }, [backendChoice]);
  const aiCloudEnabled = backendChoice.backend !== "local" && !backendChoice.forced;

  const saveSettings = React.useCallback(async (patch, successMessage) => {
    const ok = await updateSettings?.(patch);
    if (ok !== false && successMessage) showToast?.(successMessage, "success");
    return ok;
  }, [showToast, updateSettings]);

  const patchUi = (uiPatch, message) => saveSettings({ ui: { ...(settings.ui || {}), ...uiPatch } }, message);
  const patchNotifications = (patch, message = "تم تحديث الإشعارات") => saveSettings({ notifications: { ...(settings.notifications || {}), ...patch } }, message);
  const toggleMutedCategory = (category, muted) => {
    const current = new Set(settings.notifications?.mutedCategories || []);
    if (muted) current.add(category);
    else current.delete(category);
    return patchNotifications({ mutedCategories: [...current] });
  };
  const toggleToastType = (type, enabled) => patchNotifications({
    toastByType: {
      ...(settings.notifications?.toastByType || {}),
      [type]: enabled
    }
  });
  const patchAppearanceDraft = (patch) => setAppearanceDraft((current) => ({
    ...current,
    ...(typeof patch === "function" ? patch(current) : patch)
  }));
  const selectDaisyTheme = (value) => {
    const daisyTheme = normalizeDaisyTheme(value);
    // 1) Apply live so the change is visible immediately.
    applyDaisyTheme(daisyTheme);
    // 2) Keep the appearance draft consistent for the rest of the form.
    patchAppearanceDraft((current) => ({
      daisyTheme,
      themeSchedule: normalizeSchedule({ ...(current.themeSchedule || {}), theme: daisyTheme })
    }));
    // 3) Persist immediately (§19.7) so the pick survives reload and is the
    //    source of truth for AppRouter's theme effect — previously the theme
    //    only stuck after an explicit "save appearance", so selecting from the
    //    gallery appeared not to apply.
    storeDaisyTheme(daisyTheme);
    patchUi({ daisyTheme });
  };
  const patchLiveThemeEditor = (patch) => {
    if (patch.daisyTheme) {
      selectDaisyTheme(patch.daisyTheme);
      return;
    }
    if (patch.themeSchedule) {
      const themeSchedule = normalizeSchedule(patch.themeSchedule);
      applyDaisyTheme(resolveScheduledTheme(themeSchedule, systemPrefersDark()));
      applyCustomDaisyTheme(appearanceDraft.customDaisyTheme);
      patchAppearanceDraft({ themeSchedule });
      return;
    }
    if (patch.customDaisyTheme) {
      const customDaisyTheme = normalizeCustomDaisyTheme(patch.customDaisyTheme);
      applyCustomDaisyTheme(customDaisyTheme);
      patchAppearanceDraft({ customDaisyTheme });
      return;
    }
    patchAppearanceDraft(patch);
  };
  const applyAppearanceDraft = () => {
    const themeSchedule = normalizeSchedule(appearanceDraft.themeSchedule);
    const customDaisyTheme = normalizeCustomDaisyTheme(appearanceDraft.customDaisyTheme);
    const scheduledDaisyTheme = resolveScheduledTheme(themeSchedule, systemPrefersDark());
    setTheme?.(appearanceDraft.theme);
    if (typeof document !== "undefined") {
      applyDaisyTheme(scheduledDaisyTheme);
      applyCustomDaisyTheme(customDaisyTheme);
    }
    storeDaisyTheme(appearanceDraft.daisyTheme);
    storeSchedule(themeSchedule);
    storeCustomDaisyTheme(customDaisyTheme);
    return saveSettings({
      theme: appearanceDraft.theme,
      accentColor: appearanceDraft.accentColor,
      ui: {
        ...(settings.ui || {}),
        daisyTheme: appearanceDraft.daisyTheme,
        visualDensity: appearanceDraft.visualDensity,
        fontScale: appearanceDraft.fontScale,
        motionLevel: appearanceDraft.motionLevel,
        cardStyle: appearanceDraft.cardStyle,
        customDaisyTheme,
        sidebarLayout: {
          ...(settings.ui?.sidebarLayout || {}),
          mode: appearanceDraft.sidebarMode,
          collapsed: appearanceDraft.sidebarMode === "collapsed"
        }
      }
    }, "تم تطبيق إعدادات المظهر");
  };
  const resetAppearanceDraft = () => setAppearanceDraft(createAppearanceDraft(getDefaultSettings(), "dark"));
  const applyAppearanceForAll = () => {
    if (!isAdmin) return;
    return saveSettings({
      ui: {
        ...(settings.ui || {}),
        globalAppearancePreset: {
          ...appearanceDraft,
          appliedAt: new Date().toISOString(),
          appliedBy: currentUser?.username || currentUser?.id || "admin"
        }
      }
    }, "تم تجهيز هذا المظهر كافتراضي لكل المستخدمين");
  };
  const applyAppearancePreset = async (preset) => {
    const uiPatch = { ...(settings.ui || {}), ...(preset.ui || {}) };
    if (preset.ui?.sidebarLayout) {
      const sidebarMode = resolveSidebarLayoutMode(preset.ui.sidebarLayout);
      uiPatch.sidebarLayout = {
        ...(settings.ui?.sidebarLayout || {}),
        ...preset.ui.sidebarLayout,
        mode: sidebarMode,
        collapsed: sidebarMode === "collapsed"
      };
    }
    await saveSettings({ ...(preset.settings || {}), ui: uiPatch }, `تم تطبيق قالب "${preset.name}"`);
    setAppearanceDraft(createAppearanceDraft({ ...settings, ...(preset.settings || {}), ui: uiPatch }, theme));
  };
  const exportAppearanceProfile = () => {
    const profile = {
      kind: "video-archive-appearance-profile",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        theme: settings.theme,
        accentColor: settings.accentColor,
        numberSystem: settings.numberSystem,
        defaultView: settings.defaultView,
        itemsPerPage: settings.itemsPerPage,
        ui: {
          daisyTheme: settings.ui?.daisyTheme,
          visualDensity: settings.ui?.visualDensity,
          sidebarLayout: settings.ui?.sidebarLayout,
          fontScale: settings.ui?.fontScale,
          motionLevel: settings.ui?.motionLevel,
          cardStyle: settings.ui?.cardStyle,
          customDaisyTheme: getStoredCustomDaisyTheme(),
          themeSchedule: getStoredSchedule()
        }
      }
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `appearance-profile-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importAppearanceProfile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const profile = JSON.parse(await file.text());
      if (profile.kind !== "video-archive-appearance-profile" || !profile.settings) throw new Error("ملف المظهر غير صالح");
      const next = profile.settings;
      const importedSchedule = normalizeSchedule(next.ui?.themeSchedule);
      const importedCustomTheme = normalizeCustomDaisyTheme(next.ui?.customDaisyTheme);
      const nextUi = { ...(next.ui || {}) };
      delete nextUi.themeSchedule;
      delete nextUi.customDaisyTheme;
      storeSchedule(importedSchedule);
      storeCustomDaisyTheme(importedCustomTheme);
      applyCustomDaisyTheme(importedCustomTheme);
      await saveSettings({
        theme: next.theme || settings.theme,
        accentColor: next.accentColor || settings.accentColor,
        numberSystem: next.numberSystem || settings.numberSystem,
        defaultView: next.defaultView || settings.defaultView,
        itemsPerPage: Number(next.itemsPerPage) || settings.itemsPerPage,
        ui: {
          ...(settings.ui || {}),
          ...nextUi,
          daisyTheme: normalizeDaisyTheme(next.ui?.daisyTheme || settings.ui?.daisyTheme),
          customDaisyTheme: importedCustomTheme
        }
      }, "تم استيراد ملف المظهر");
    } catch (error) {
      reportError(showNotification, error, { context: "استيراد ملف المظهر" });
    }
  };

  const setActiveTab = (tabId) => {
    const normalized = normalizeSettingsTab(tabId);
    setActiveTabState(normalized);
    updateSettings?.(createSettingsTabUiPatch(settings, normalized));
  };

  const updateTheme = (value) => {
    setTheme?.(value);
    saveSettings({
      theme: value,
      ui: { ...(settings.ui || {}), onboardingThemeChoice: value }
    }, "تم تحديث المظهر");
  };

  const updateAutocompleteTrigger = (key, value) => {
    const nextValue = String(value || "").trim().slice(0, 2) || (key === "vocabulary" ? "@" : "#");
    const nextTriggers = { ...(settings.autocompleteTriggers || {}), [key]: nextValue };
    if (nextTriggers.vocabulary === nextTriggers.tags) {
      showToast?.("لا يمكن استخدام نفس الرمز للقاموس والوسوم.", "warning");
      return;
    }
    saveSettings({ autocompleteTriggers: nextTriggers }, "تم تحديث الاستدعاء الذكي");
  };

  const openOnboardingWizard = () => {
    patchUi({ onboardingReplayRequestedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent("videoarchive:onboarding-open", { detail: { mode: "replay" } }));
    showToast?.("تم فتح معالج البداية للمراجعة.", "info");
  };

  const handlePasswordSave = async () => {
    setPasswordError("");
    if (isPasswordSet) {
      if (!oldPassword) {
        setPasswordError("أدخل كلمة المرور الحالية أولاً.");
        return;
      }
      const oldOk = await unlockApp?.(oldPassword);
      if (!oldOk) {
        setPasswordError("كلمة المرور الحالية غير صحيحة.");
        return;
      }
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("كلمة المرور وتأكيدها غير متطابقين.");
      return;
    }
    // Policy validation happens inside setMasterPassword; surface its toast in addition.
    try {
      await passwordSave.run(async () => {
        await setMasterPassword?.(newPassword);
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast?.("تم تحديث كلمة مرور المدير.", "success");
    } catch (error) {
      setPasswordError(error?.message || "تعذر تحديث كلمة المرور.");
    }
  };

  const runHealth = async () => {
    setHealthRunning(true);
    healthSave.begin();
    try {
      await runSystemHealthCheck?.();
      healthSave.succeed();
      showToast?.("اكتمل فحص النظام.", "success");
    } catch (error) {
      healthSave.fail(error);
      reportError(showNotification, error, { context: "فحص صحة النظام", recovery: { label: "إعادة الفحص", run: runHealth } });
    } finally {
      setHealthRunning(false);
    }
  };

  const renderGeneral = () => jsxs("div", {
    className: "space-y-4",
    children: [
      jsx(SettingsCard, {
        title: "بداية الإصدار الأول",
        description: "شغّل المعالج من جديد لتدريب مستخدم جديد أو مراجعة الحماية والمظهر وشرح الواجهة.",
        icon: jsx(Sparkles, { className: "h-5 w-5 va-accent-text" }),
        aside: jsx("span", { className: "rounded-full border va-accent-border va-accent-bg-soft px-3 py-1 text-xs va-accent-text-on-soft", children: settings.ui?.v1OnboardingCompleted ? "مكتمل" : "لم يكتمل" }),
        children: jsxs("div", {
          className: "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]",
          children: [
            jsxs("div", {
              className: "rounded-xl va-surface-subtle border p-3",
              children: [
                jsx("p", { className: "text-sm text-[var(--va-text-2)]", children: settings.ui?.onboardingSecurityMode === "quick" ? "الحماية مؤجلة عبر البدء السريع." : "الإعداد الآمن هو المسار الحالي." }),
                jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", children: settings.ui?.onboardingCoreUiSeenAt ? `شوهد شرح الواجهة: ${formatDateTime(settings.ui.onboardingCoreUiSeenAt)}` : "شرح الواجهة لم يسجل بعد." })
              ]
            }),
            jsxs("button", { type: "button", onClick: openOnboardingWizard, className: "btn btn-primary gap-2", children: [jsx(RefreshCw, { className: "h-4 w-4" }), "تشغيل معالج البداية"] })
          ]
        })
      }),
      jsx(SettingsCard, {
        title: "الإعدادات اليومية",
        description: "اختيارات عامة تؤثر على طريقة فتح الأرشيف والتعامل مع البيانات.",
        icon: jsx(Archive, { className: "h-5 w-5 va-accent-text" }),
        children: jsxs("div", {
          className: "space-y-3",
          children: [
            jsxs("div", {
              className: "grid gap-3 md:grid-cols-2",
              children: [
                jsx(SegmentedChoices, { label: "العرض الافتراضي للأرشيف", value: settings.defaultView || "grid", options: VIEW_OPTIONS, onChange: (value) => saveSettings({ defaultView: value }, "تم تحديث العرض الافتراضي") }),
                jsx(SelectRow, {
                  label: "عدد العناصر الافتراضي",
                  value: String(settings.itemsPerPage || 24),
                  onChange: (value) => saveSettings({ itemsPerPage: Number(value) }, "تم تحديث عدد العناصر"),
                  options: [12, 24, 48, 96].map((value) => ({ value: String(value), label: `${formatNumber(value)} عنصر` })),
                  description: "يستخدم كنقطة بداية للصفحات الجديدة."
                })
              ]
            }),
            jsx(ToggleRow, {
              label: "التعديل السريع في اللوحة الجانبية",
              description: "عند التفعيل، تفتح عملية التعديل لوحة جانبية منزلقة بدلاً من الانتقال لصفحة التفاصيل الكاملة.",
              checked: !!settings.ui?.editInSidePanel,
              onChange: (checked) => patchUi({ editInSidePanel: checked }, "تم تحديث وضع التعديل")
            })
          ]
        })
      }),
      jsx(SettingsCard, {
        title: "نمط الاستخدام الموجّه",
        description: "غيّر ترتيب المسارات والتوصيات حسب طريقة عملك اليومية. لا يغير هذا صلاحيات الحساب.",
        icon: jsx(Users, { className: "h-5 w-5 va-accent-text" }),
        aside: jsx("span", {
          className: "badge badge-soft badge-info",
          children: "تخصيص واجهي"
        }),
        children: jsx(RoleSelectionStep, {
          compact: true,
          value: normalizeRoleProfileId(settings.ui?.roleProfile || currentUser?.role || "editor"),
          onChange: (value) => patchUi({ roleProfile: value }, "تم تحديث نمط الاستخدام")
        })
      })
    ]
  });

  const renderInterface = () => jsxs("div", {
    className: "space-y-4",
    children: [
      jsx(SettingsCard, {
        title: "استوديو المظهر",
        description: "عدّل الثيم واللون والكثافة والخط والبطاقات والشريط الجانبي داخل مسودة واحدة، ثم طبّقها عند الرضا عن المعاينة.",
        icon: jsx(Sparkles, { className: "h-5 w-5 va-accent-text" }),
        aside: jsxs("div", {
          className: "flex flex-wrap gap-2",
          children: [
            jsx("button", { type: "button", onClick: resetAppearanceDraft, className: "rounded-xl border border-[var(--va-border-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: "استعادة الافتراضي" }),
            isAdmin && jsx("button", { type: "button", onClick: applyAppearanceForAll, className: "rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/15", children: "تطبيق على كل المستخدمين" }),
            jsx("button", { type: "button", onClick: applyAppearanceDraft, className: "btn btn-primary btn-xs", children: "تطبيق المظهر" })
          ]
        }),
        children: jsxs("div", {
          className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]",
          children: [
            jsxs("div", {
              className: "space-y-4",
              children: [
                jsx(ThemeGallery, {
                  value: appearanceDraft.daisyTheme,
                  onChange: selectDaisyTheme
                }),
                jsx(LiveThemeEditor, {
                  draft: appearanceDraft,
                  onPatch: patchLiveThemeEditor
                }),
                jsx(SegmentedChoices, { label: "المظهر", value: appearanceDraft.theme, options: THEME_OPTIONS, onChange: (value) => patchAppearanceDraft({ theme: value }) }),
                jsx(ColorChoices, { value: appearanceDraft.accentColor, onChange: (value) => patchAppearanceDraft({ accentColor: value }) }),
                jsx(SegmentedChoices, {
                  label: "كثافة الواجهة",
                  value: appearanceDraft.visualDensity,
                  options: DENSITY_OPTIONS,
                  columns: "sm:grid-cols-2",
                  onChange: (value) => patchAppearanceDraft({ visualDensity: value })
                }),
                jsx(SegmentedChoices, {
                  label: "حجم الخط",
                  value: appearanceDraft.fontScale,
                  options: [
                    { value: "small", label: "صغير", detail: "14px" },
                    { value: "normal", label: "عادي", detail: "16px" },
                    { value: "large", label: "كبير", detail: "17px" },
                    { value: "xlarge", label: "كبير جدًا", detail: "18px" }
                  ],
                  columns: "sm:grid-cols-4",
                  onChange: (value) => patchAppearanceDraft({ fontScale: value })
                }),
                jsx(SegmentedChoices, {
                  label: "مستوى الحركة",
                  value: appearanceDraft.motionLevel,
                  options: [
                    { value: "full", label: "كامل", detail: "حركات سلسة" },
                    { value: "reduced", label: "مخفّف", detail: "حركات أسرع" },
                    { value: "off", label: "متوقّف", detail: "بدون حركة" }
                  ],
                  columns: "sm:grid-cols-3",
                  onChange: (value) => patchAppearanceDraft({ motionLevel: value })
                }),
                jsx(SegmentedChoices, {
                  label: "أسلوب البطاقات",
                  value: appearanceDraft.cardStyle,
                  options: [
                    { value: "filled", label: "ممتلئة", detail: "خلفية ودرجة عمق" },
                    { value: "outlined", label: "مُحدّدة", detail: "إطار فقط" },
                    { value: "minimal", label: "بسيطة", detail: "بدون إطار" }
                  ],
                  columns: "sm:grid-cols-3",
                  onChange: (value) => patchAppearanceDraft({ cardStyle: value })
                }),
                jsx(SegmentedChoices, {
                  label: "الشريط الجانبي",
                  value: appearanceDraft.sidebarMode,
                  options: [
                    { value: "expanded", label: "مفتوح", detail: "أسماء الصفحات ظاهرة" },
                    { value: "collapsed", label: "مضغوط", detail: "أيقونات أكثر" },
                    { value: "hidden", label: "مخفي", detail: "للعمل المركز" }
                  ],
                  columns: "sm:grid-cols-3",
                  onChange: (value) => patchAppearanceDraft({ sidebarMode: value })
                }),
                jsx("p", { className: "rounded-xl va-surface-subtle border p-3 text-xs text-[var(--va-text-muted)]", children: `المظهر المطبّق الآن: ${isDark ? "ليلي" : "نهاري"}. المعاينة تتغير قبل الحفظ الفعلي.` })
              ]
            }),
            jsx(AppearanceStudioPreview, { draft: appearanceDraft, numberSystem: settings.numberSystem })
          ]
        })
      }),
      jsx(SettingsCard, {
        title: "ملفات مظهر وقوالب جاهزة",
        description: "قوالب شخصية لا تحتوي أسراراً: العرض الافتراضي، عدد العناصر، الكثافة، الشريط، الخط، واللون.",
        icon: jsx(LayoutGrid, { className: "h-5 w-5 va-accent-text" }),
        aside: jsxs("div", { className: "flex flex-wrap gap-2", children: [
          jsx("button", { type: "button", onClick: exportAppearanceProfile, className: "rounded-xl border border-[var(--va-border-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: "تصدير JSON" }),
          jsx("button", { type: "button", onClick: () => appearanceImportRef.current?.click(), className: "rounded-xl border border-[var(--va-border-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: "استيراد JSON" }),
          jsx("input", { ref: appearanceImportRef, type: "file", accept: "application/json,.json", onChange: importAppearanceProfile, className: "sr-only" })
        ] }),
        children: jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-4", children: APPEARANCE_PRESETS.map((preset) => jsxs("button", {
          type: "button",
          onClick: () => applyAppearancePreset(preset),
          className: "min-h-28 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3 text-right transition-colors hover:border-emerald-500/25 hover:bg-emerald-500/10",
          children: [
            jsx("span", { className: "block text-sm font-bold text-[var(--va-text)]", children: preset.name }),
            jsx("span", { className: "mt-1 block text-xs leading-6 text-[var(--va-text-muted)]", children: preset.detail })
          ]
        }, preset.id)) })
      }),
      jsx(SettingsCard, {
        title: "الأرقام واللغة",
        description: "العربية وRTL هما الأساس، ويمكن اختيار شكل الأرقام في التقارير والسجلات.",
        icon: jsx(Video, { className: "h-5 w-5 va-accent-text" }),
        children: jsxs("div", {
          className: "grid gap-3 md:grid-cols-2",
          children: [
            jsx(SegmentedChoices, {
              label: "نظام الأرقام",
              value: settings.numberSystem || "latn",
              options: [
                { value: "latn", label: "لاتيني", detail: formatNumber(1234, "latn") },
                { value: "arab", label: "هندي", detail: formatNumber(1234, "arab") }
              ],
              columns: "sm:grid-cols-2",
              onChange: (value) => saveSettings({ numberSystem: value }, "تم تحديث نظام الأرقام")
            }),
            jsx(SelectRow, {
              label: "اللغة",
              value: settings.language || "ar",
              onChange: (value) => saveSettings({ language: value }, "تم تحديث اللغة"),
              options: [{ value: "ar", label: "العربية" }],
              description: "خيارات اللغات الأخرى ستضاف لاحقاً بدون عرض خيار وهمي."
            })
          ]
        })
      })
    ]
  });

  const renderIcons = () => jsx(SettingsCard, {
    title: "الأيقونات والأغلفة",
    description: "الأيقونات المدمجة والرموز والنصوص والصور الخارجية مدعومة في مدير الأنواع والمجموعات.",
    icon: jsx(LayoutGrid, { className: "h-5 w-5 va-accent-text" }),
    children: jsxs("div", {
      className: "grid gap-3 md:grid-cols-2",
      children: [
        jsx(SelectRow, {
          label: "آخر تبويب في منتقي الأيقونات",
          value: settings.ui?.iconPickerLastTab || "builtin",
          onChange: (value) => patchUi({ iconPickerLastTab: value }, "تم تحديث تفضيل منتقي الأيقونات"),
          options: [
            { value: "builtin", label: "أيقونات مدمجة" },
            { value: "emoji", label: "إيموجي / نص" },
            { value: "upload", label: "صورة مرفوعة" },
            { value: "url", label: "رابط خارجي" }
          ],
          description: "يُستخدم عند فتح منتقي الأيقونات في الشاشات التي تدعمه."
        }),
        jsxs("div", {
          className: "rounded-xl va-surface-subtle border p-3",
          children: [
            jsx("p", { className: "text-sm font-semibold text-[var(--va-text)]", children: "إدارة الأيقونات الفعلية" }),
            jsx("p", { className: "mt-1 text-xs leading-relaxed text-[var(--va-text-muted)]", children: "انتقل إلى إدارة الأنواع لإضافة أيقونة أو غلاف لكل نوع وفرع." }),
            jsx("button", { type: "button", onClick: () => setCurrentPage?.("types"), className: "btn btn-primary mt-3", children: "فتح إدارة الأنواع" })
          ]
        })
      ]
    })
  });

  const renderSmart = () => jsx(SettingsCard, {
    title: "الاستدعاء الذكي",
    description: "رموز محلية داخل حقول الوسوم والنصوص: القاموس عبر @ والوسوم الهرمية عبر #.",
    icon: jsx(Tags, { className: "h-5 w-5 va-accent-text" }),
    children: jsxs("div", {
      className: "space-y-3",
      children: [
        jsxs("div", {
          className: "grid gap-3 sm:grid-cols-2",
          children: [
            jsx(TextInputRow, {
              label: "رمز القاموس",
              value: settings.autocompleteTriggers?.vocabulary || "@",
              onChange: (value) => updateAutocompleteTrigger("vocabulary", value),
              dir: "ltr",
              description: "اكتب الرمز ثم جزءاً من المصطلح.",
              placeholder: "@"
            }),
            jsx(TextInputRow, {
              label: "رمز الوسوم",
              value: settings.autocompleteTriggers?.tags || "#",
              onChange: (value) => updateAutocompleteTrigger("tags", value),
              dir: "ltr",
              description: "يعرض الوسوم الجذرية والفرعية بمسارها.",
              placeholder: "#"
            })
          ]
        }),
        jsxs("p", {
          className: "rounded-xl va-surface-subtle border p-3 text-sm text-[var(--va-text-muted)]",
          children: [
            "مثال: ",
            jsx("span", { className: "font-mono va-accent-text-on-soft", dir: "ltr", children: `${settings.autocompleteTriggers?.vocabulary || "@"}م` }),
            " أو ",
            jsx("span", { className: "font-mono va-accent-text-on-soft", dir: "ltr", children: `${settings.autocompleteTriggers?.tags || "#"}رياض` })
          ]
        })
      ]
    })
  });

  const renderAppearance = () => jsxs("div", {
    className: "space-y-4",
    children: [
      renderInterface(),
      renderIcons(),
      renderSmart()
    ]
  });

  const renderAi = () => jsxs("div", {
    className: "space-y-4",
    children: [
      jsx(SettingsCard, {
        title: "حالة مزود الذكاء",
        description: "الحالة هنا توضّح أين تُنفّذ طلبات الذكاء وما الذي يتوقعه المستخدم قبل تشغيل أي إجراء AI.",
        icon: jsx(Bot, { className: "h-5 w-5 va-accent-text" }),
        aside: jsx("span", {
          className: cx("rounded-full border px-3 py-1 text-xs", aiStatus.tone === "emerald" ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-amber-500/20 bg-amber-500/10 text-amber-200"),
          children: aiStatus.label
        }),
        children: jsxs("div", {
          className: "space-y-3",
          children: [
            jsxs("div", {
              className: "rounded-xl va-surface-subtle border p-3",
              children: [
                jsx("p", { className: "text-sm font-semibold text-[var(--va-text)]", children: aiStatus.title }),
                jsx("p", { className: "mt-1 text-xs leading-6 text-[var(--va-text-muted)]", dir: backendChoice.url ? "ltr" : "rtl", children: aiStatus.detail })
              ]
            }),
            jsx("div", {
              className: "grid gap-3 md:grid-cols-3",
              children: [
                ["الخلفية", backendChoice.backend === "local" ? "محلي" : backendChoice.backend],
                ["التخزين", backendChoice.forced ? "إجباري محلي" : "حسب اختيار الخادم"],
                ["التفويض", backendChoice.backend === "local" ? "لا يوجد JWT" : "Bearer token عبر جلسة cloud"]
              ].map(([label, value]) => jsxs("div", {
                className: "rounded-xl va-surface-subtle border p-3",
                children: [
                  jsx("p", { className: "text-xs text-[var(--va-text-muted)]", children: label }),
                  jsx("p", { className: "mt-1 text-sm font-semibold text-[var(--va-text)]", dir: /token|http|pocketbase|postgres/i.test(value) ? "ltr" : "rtl", children: value })
                ]
              }, label))
            }),
            !aiCloudEnabled && jsxs("div", {
              className: "rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-50",
              children: [
                jsx("p", { className: "text-sm font-semibold", children: "لتفعيل أزرار AI داخل الأرشيف اربط التطبيق بخادم Cloud مضبوط عليه AI_PROVIDER وAI_API_KEY." }),
                jsxs("div", {
                  className: "mt-3 flex flex-wrap gap-2",
                  children: [
                    jsx("button", {
                      type: "button",
                      onClick: openOnboardingWizard,
                      className: "rounded-xl border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-200/15",
                      children: "تشغيل معالج الربط"
                    }),
                    jsx("button", {
                      type: "button",
                      onClick: () => setActiveTab("maintenance"),
                      className: "rounded-xl border border-[var(--va-border-soft)] px-3 py-2 text-xs font-semibold text-[var(--va-text)] hover:bg-[var(--va-surface-2)]",
                      children: "فتح تبويب الصيانة"
                    })
                  ]
                })
              ]
            })
          ]
        })
      }),
      jsx(SettingsCard, {
        title: "إجراءات AI المدعومة الآن",
        description: "هذه القدرات موجودة في منفذ AiProvider، لكنها تعمل فعلياً عندما يكون backend سحابياً ومزوّد الخادم مضبوطاً.",
        icon: jsx(Sparkles, { className: "h-5 w-5 va-accent-text" }),
        children: jsx("div", {
          className: "grid gap-2 sm:grid-cols-2 xl:grid-cols-3",
          children: [
            ["summarize", "تلخيص المواد والنصوص"],
            ["suggestTags", "اقتراح وسوم"],
            ["proofread", "مراجعة صياغة"],
            ["autocompleteFields", "إكمال حقول النوع"],
            ["chat", "محادثة مساعدة"],
            ["rankSearch", "ترتيب نتائج البحث"]
          ].map(([method, detail]) => jsxs("div", {
            className: cx(
              "rounded-xl border p-3",
              aiCloudEnabled
                ? "va-accent-border va-accent-bg-soft"
                : "border-amber-400/25 bg-amber-500/10"
            ),
            children: [
              jsx("p", { className: cx("font-mono text-xs", aiCloudEnabled ? "va-accent-text-on-soft" : "text-amber-50"), dir: "ltr", children: method }),
              jsx("p", { className: cx("mt-1 text-xs leading-5", aiCloudEnabled ? "va-accent-text-on-soft" : "text-amber-50/85"), children: detail }),
              jsx("p", {
                className: cx("mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", aiCloudEnabled ? "va-accent-border va-accent-text-on-soft" : "border-amber-200/30 text-amber-50"),
                children: aiCloudEnabled ? "متاح عبر Cloud" : "يتطلب Cloud AI"
              })
            ]
          }, method))
        })
      }),
      jsx(SettingsCard, {
        title: "التفريغ الصوتي",
        description: "التفريغ يختلف عن JSON-RPC لأنه يرفع ملفاً صوتياً خاماً إلى مسار مخصص.",
        icon: jsx(CircleQuestionMark, { className: "h-5 w-5 text-cyan-300" }),
        children: jsxs("div", {
          className: "space-y-3",
          children: [
            jsx("p", { className: "rounded-xl va-surface-subtle border p-3 text-sm leading-7 text-[var(--va-text-muted)]", children: "في cloud، يستدعي التطبيق /api/ai/transcribe ويرسل الصوت كـ blob. في المحلي لا يوجد adapter صوت مستقل بعد، لذلك تظهر الحالة كتوجيه وليس كزر تشغيل وهمي." }),
            jsx("div", {
              className: "grid gap-3 md:grid-cols-2",
              children: [
                ["503", "الخادم يعمل لكن مزود AI غير مضبوط في env. الرسالة تظهر للمستخدم كإرشاد إعداد واضح."],
                ["401", "الجلسة غير مصرح بها أو منتهية، ويجب تسجيل الدخول للسحابة من جديد."]
              ].map(([code, detail]) => jsxs("div", {
                className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3",
                children: [
                  jsx("p", { className: "font-mono text-sm text-amber-100", dir: "ltr", children: code }),
                  jsx("p", { className: "mt-1 text-xs leading-5 text-amber-100/80", children: detail })
                ]
              }, code))
            })
          ]
        })
      })
    ]
  });

  const renderData = () => jsx(SettingsCard, {
    title: "النسخ والبيانات",
    description: "خيارات الحفظ والنسخ. إجراءات الاستيراد والتصدير الفعلية داخل مركز البيانات.",
    icon: jsx(HardDrive, { className: "h-5 w-5 va-accent-text" }),
    children: jsxs("div", {
      className: "space-y-3",
      children: [
        jsx(ToggleRow, { label: "الحفظ التلقائي", checked: !!settings.autoSave, onChange: (checked) => saveSettings({ autoSave: checked }, "تم تحديث الحفظ التلقائي"), description: "يحفظ التغييرات اليومية بدون خطوة إضافية." }),
        jsx(ToggleRow, { label: "النسخ الاحتياطي التلقائي", checked: !!settings.autoBackup, onChange: (checked) => saveSettings({ autoBackup: checked }, "تم تحديث النسخ التلقائي"), description: "ينشئ نسخاً احتياطية حسب الجدولة المحددة." }),
        jsxs("div", {
          className: "grid gap-3 md:grid-cols-2",
          children: [
            jsx(SelectRow, {
              label: "جدولة النسخ الاحتياطي",
              value: settings.backupSchedule || "manual",
              onChange: (value) => saveSettings({ backupSchedule: value }, "تم تحديث جدولة النسخ"),
              options: [
                { value: "manual", label: "يدوي فقط" },
                { value: "hourly", label: "كل ساعة" },
                { value: "daily", label: "يومياً" },
                { value: "weekly", label: "أسبوعياً" }
              ]
            }),
            jsx(TextInputRow, {
              label: "فاصل النسخ بالدقائق",
              value: String(settings.backupInterval || 60),
              onChange: (value) => saveSettings({ backupInterval: Math.max(5, Number(value) || 60) }),
              dir: "ltr",
              description: "يستخدم في بعض مهام النسخ التلقائي.",
              placeholder: "60"
            })
          ]
        }),
        jsxs("div", {
          className: "flex flex-wrap items-center justify-between gap-3 rounded-xl va-surface-subtle border p-3",
          children: [
            jsx("p", { className: "text-sm text-[var(--va-text-muted)]", children: settings.lastBackupAt ? `آخر نسخة: ${formatDateTime(settings.lastBackupAt)}` : "لا توجد نسخة احتياطية مسجلة بعد." }),
            jsx("button", { type: "button", onClick: () => setCurrentPage?.("backup"), className: "btn btn-primary", children: "فتح مركز البيانات" })
          ]
        })
      ]
    })
  });

  const renderSecurity = () => jsx(SettingsCard, {
    title: "الأمان",
    description: "حماية المدير، مهلة الجلسة، ومحاولات الدخول.",
    icon: jsx(ShieldCheck, { className: "h-5 w-5 va-accent-text" }),
    children: jsxs("div", {
      className: "space-y-3",
      children: [
        isPasswordSet && jsx(TextInputRow, { label: "كلمة المرور الحالية", value: oldPassword, onChange: setOldPassword, dir: "ltr", type: "password" }),
        jsx(TextInputRow, { label: "كلمة المرور الجديدة", value: newPassword, onChange: setNewPassword, dir: "ltr", type: "password" }),
        jsx(TextInputRow, { label: "تأكيد كلمة المرور", value: confirmPassword, onChange: setConfirmPassword, dir: "ltr", type: "password" }),
        passwordError && jsx("p", { className: "rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200", children: passwordError }),
        jsxs("div", {
          className: "flex flex-wrap items-center gap-2",
          children: [
            jsx("button", { type: "button", onClick: handlePasswordSave, disabled: passwordSave.isSaving, className: "btn btn-primary", children: isPasswordSet ? "تحديث كلمة المرور" : "تعيين كلمة المرور" }),
            jsx("button", { type: "button", onClick: lockApp, className: "rounded-xl border border-[var(--va-border-soft)] px-4 py-2 text-sm text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: "قفل التطبيق الآن" }),
            jsx(SaveIndicator, { state: passwordSave.state, onRetry: handlePasswordSave })
          ]
        }),
        jsxs("div", {
          className: "grid gap-3 md:grid-cols-2",
          children: [
            jsx(TextInputRow, {
              label: "مهلة الجلسة بالدقائق",
              value: String(settings.sessionTimeout || 30),
              onChange: (value) => saveSettings({ sessionTimeout: Math.max(1, Number(value) || 30) }),
              dir: "ltr"
            }),
            jsx(SelectRow, {
              label: "محاولات الدخول قبل القفل",
              value: String(authStore.maxLoginAttempts || 5),
              onChange: (value) => authStore.updateSecuritySettings?.(Number(value), authStore.lockoutDurationMs),
              options: [3, 5, 8, 10, 20].map((value) => ({ value: String(value), label: `${formatNumber(value)} محاولات` }))
            })
          ]
        }),
        jsx(ToggleRow, { label: "تفعيل مهلة الجلسة", checked: !!settings.enableSessionTimeout, onChange: (checked) => saveSettings({ enableSessionTimeout: checked }, "تم تحديث مهلة الجلسة") }),
        jsx(ToggleRow, { label: "تحذيرات المحتوى", checked: !!settings.contentWarningsEnabled, onChange: (checked) => saveSettings({ contentWarningsEnabled: checked }, "تم تحديث تحذيرات المحتوى") }),
        jsxs("div", {
          className: "mt-4 pt-4 border-t border-[var(--va-border-soft)]",
          children: [
            jsx("h3", { className: "mb-3 text-sm font-semibold text-[var(--va-text)]", children: "المصادقة الثنائية (2FA)" }),
            jsx(TwoFactorSettings, {})
          ]
        })
      ]
    })
  });

  const renderShortcuts = () => jsx(SettingsCard, {
    title: "اختصارات لوحة المفاتيح",
    description: "مدير كامل حسب الفئة مع منع التعارضات وتعطيل الاختصارات عند الحاجة.",
    icon: jsx(Keyboard, { className: "h-5 w-5 va-accent-text" }),
    children: jsx(ShortcutManager, { settings, onSave: saveSettings, showToast })
  });

  const renderMaintenance = () => jsxs("div", {
    className: "space-y-4",
    children: [
      jsx(LocalStorageEngineSettings, {}),
      jsx(SettingsCard, {
        title: "حالة الخادم الحيّة",
        description: "فحص سريع للاتصال بالخادم وقاعدة البيانات كما يظهر في شريط السياق.",
        icon: jsx(ServerStatusBadge, { compact: true }),
        children: jsx("div", { className: "flex flex-wrap items-center gap-2", dir: "rtl", children: jsx(ServerStatusBadge, {}) })
      }),
      jsx(FileStoreSettings, {}),
      jsx(FirebaseBackendSettings, {}),
      jsx(DatabaseSettings, {}),
      jsx(SettingsCard, {
        title: "فحص النظام",
        description: "فحص IndexedDB والمساحة والحالة العامة. SQLite مؤجل لهذه النسخة.",
        icon: jsx(Database, { className: "h-5 w-5 va-accent-text" }),
        aside: jsx("span", { className: cx("rounded-full border px-3 py-1 text-xs", sqliteError ? "border-amber-500/20 bg-amber-500/10 text-amber-200" : "va-accent-border va-accent-bg-soft va-accent-text-on-soft"), children: sqliteError ? "تحقق التخزين" : "IndexedDB محلي" }),
        children: jsxs("div", {
          className: "space-y-3",
          children: [
            sqliteError && jsx("p", { className: "rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200", children: sqliteError }),
            jsx("p", { className: "text-sm text-[var(--va-text-muted)]", children: settings.systemHealth?.lastCheckAt ? `آخر فحص: ${formatDateTime(settings.systemHealth.lastCheckAt)}` : "لم يتم تشغيل فحص كامل بعد." }),
            jsxs("div", {
              className: "flex flex-wrap items-center gap-2",
              children: [
                jsx("button", { type: "button", onClick: runHealth, disabled: healthRunning, className: "btn btn-primary", children: healthRunning ? "جار الفحص..." : "تشغيل فحص النظام" }),
                jsx(SaveIndicator, { state: healthSave.state, message: healthSave.isSaving ? "جار فحص النظام..." : healthSave.isSaved ? "اكتمل الفحص" : healthSave.isError ? "فشل الفحص" : null, onRetry: runHealth })
              ]
            })
          ]
        })
      }),
      jsx(SettingsCard, {
        title: "الربط الخارجي",
        description: "إعدادات تجريبية للربط المحلي بدون إضافة backend جديد.",
        icon: jsx(Shield, { className: "h-5 w-5 va-accent-text" }),
        children: jsxs("div", {
          className: "space-y-3",
          children: [
            jsx(ToggleRow, { label: "تفعيل الربط الخارجي", checked: !!settings.externalDb?.enabled, onChange: (checked) => saveSettings({ externalDb: { ...(settings.externalDb || {}), enabled: checked, mode: checked ? "bridge" : "disabled" } }, "تم تحديث الربط الخارجي") }),
            jsx(TextInputRow, {
              label: "عنوان الجسر المحلي",
              value: settings.externalDb?.bridgeUrl || "http://127.0.0.1:8766",
              onChange: (value) => saveSettings({ externalDb: { ...(settings.externalDb || {}), bridgeUrl: value } }),
              dir: "ltr",
              description: "يُحفظ كرابط فقط، ولا يتم الاتصال به إلا من عمليات الربط المخصصة."
            })
          ]
        })
      }),
      jsx(SettingsCard, {
        title: "الإشعارات",
        description: "هدوء الإشعارات، مدة الاحتفاظ، وما يظهر كتنبيه عابر أثناء العمل.",
        icon: jsx(Bell, { className: "h-5 w-5 va-accent-text" }),
        children: jsxs("div", {
          className: "space-y-3",
          children: [
            jsx(ToggleRow, {
              label: "إبقاء التنبيهات المهمة",
              description: "التنبيهات المهمة تبقى في المركز حتى لو اختفى toast العابر.",
              checked: !!settings.notifications?.persistImportant,
              onChange: (checked) => patchNotifications({ persistImportant: checked })
            }),
            jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: [
              jsx(TextInputRow, {
                label: "مدة toast بالميلي ثانية",
                value: String(settings.notifications?.durationMs || 5500),
                onChange: (value) => patchNotifications({ durationMs: Math.max(1000, Number(value) || 5500) }),
                dir: "ltr",
                description: "ينطبق على التنبيهات العابرة فقط."
              }),
              jsx(TextInputRow, {
                label: "مدة الاحتفاظ بالأيام",
                value: String(settings.notifications?.retentionDays || 30),
                onChange: (value) => patchNotifications({ retentionDays: Math.max(1, Math.min(365, Number(value) || 30)) }),
                dir: "ltr",
                description: "يُستخدم عند إضافة إشعارات جديدة للسجل."
              })
            ] }),
            jsxs("div", { className: "rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3", children: [
              jsx("p", { className: "text-sm font-semibold text-[var(--va-text)]", children: "كتم فئات من toast" }),
              jsx("p", { className: "mt-1 text-xs leading-6 text-[var(--va-text-muted)]", children: "الكتم يمنع ظهور التنبيه العابر، لكنه يبقي الإشعار داخل المركز للرجوع إليه." }),
              jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: NOTIFICATION_CATEGORIES.map((category) => jsx(ToggleRow, {
                label: NOTIFICATION_CATEGORY_LABELS[category] || category,
                checked: !(settings.notifications?.mutedCategories || []).includes(category),
                onChange: (enabled) => toggleMutedCategory(category, !enabled)
              }, category)) })
            ] }),
            jsxs("div", { className: "rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3", children: [
              jsx("p", { className: "text-sm font-semibold text-[var(--va-text)]", children: "أنواع تظهر كـ toast" }),
              jsx("div", { className: "mt-3 grid gap-2 sm:grid-cols-2", children: Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => jsx(ToggleRow, {
                label,
                checked: settings.notifications?.toastByType?.[type] !== false,
                onChange: (enabled) => toggleToastType(type, enabled)
              }, type)) })
            ] }),
            jsx("div", { className: "rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3", children: jsx(NotificationPreferences, {}) })
          ]
        })
      }),
      jsx(SettingsCard, {
        title: "المشاركة العامة",
        description: "القيم الافتراضية لروابط المراجعة العامة.",
        icon: jsx(Archive, { className: "h-5 w-5 va-accent-text" }),
        children: jsx(TextInputRow, {
          label: "مدة صلاحية الرابط بالأيام",
          value: String(settings.sharing?.defaultExpiryDays || 30),
          onChange: (value) => saveSettings({ sharing: { ...(settings.sharing || {}), defaultExpiryDays: Math.max(1, Math.min(365, Number(value) || 30)) } }, "تم تحديث المشاركة"),
          dir: "ltr",
          description: "تستخدم عند إنشاء روابط مشاركة جديدة من المجموعات."
        })
      })
    ]
  });

  const renderWebhooks = () => jsxs("div", {
    className: "space-y-6",
    children: [
      jsx(SettingsCard, {
        title: "Webhooks الصادرة",
        description: "يُطلق الخادم طلب POST إلى العناوين المسجّلة عند إنشاء السجلات أو تحديثها أو حذفها، مع توقيع HMAC-SHA256.",
        icon: jsx("span", { className: "text-xs font-mono text-[var(--va-text-muted)]", children: "POST" }),
        children: jsx(WebhooksSettings, {})
      }),
      jsx(SettingsCard, {
        title: "مفاتيح API",
        description: "مفاتيح برمجية للقراءة الخارجية، منفصلة عن جلسات المستخدم. يظهر المفتاح مرة واحدة فقط عند الإنشاء.",
        icon: jsx("span", { className: "text-xs font-mono text-[var(--va-text-muted)]", children: "API" }),
        children: jsx(ApiKeysSettings, {})
      })
    ]
  });

  const renderPermissions = () => jsx(SettingsCard, {
    title: "صلاحيات الحقول (Field ACL)",
    description: "حدّد أي الأدوار تستطيع رؤية كل حقل مخصص. الحقول غير المقيّدة مرئية للجميع. يُطبَّق القيد في جلب السجلات على الخادم.",
    icon: jsx("span", { className: "text-xs text-[var(--va-text-muted)]", children: "🔒" }),
    children: jsx(FieldPermissionsSettings, {})
  });

  const tabContent = {
    general: renderGeneral,
    appearance: renderAppearance,
    data: renderData,
    cloud: () => jsx(CloudControlTab, {}),
    ai: renderAi,
    security: renderSecurity,
    shortcuts: renderShortcuts,
    webhooks: renderWebhooks,
    permissions: renderPermissions,
    maintenance: renderMaintenance
  };

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(Lightbulb, { className: "h-6 w-6 va-accent-text" }),
        title: "الإعدادات",
        description: "إعدادات مقسمة حسب المهمة: عام، أمان، مظهر، بيانات، ذكاء، اختصارات، وصيانة.",
        actions: jsxs("div", {
          className: "flex flex-wrap gap-2",
          children: [
            jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2 text-xs text-[var(--va-text-muted)]", children: `التبويب: ${tabState.activeLabel}` }),
            jsx("span", { className: "rounded-full border va-accent-border va-accent-bg-soft px-3 py-2 text-xs va-accent-text-on-soft", children: "حفظ مباشر" })
          ]
        })
      }),
      jsxs("div", {
        className: "space-y-5",
        children: [
          jsx(SettingsTabs, { activeTab, onTabChange: setActiveTab }),
          jsx("div", { className: "min-w-0", children: tabContent[activeTab]?.() || renderGeneral() })
        ]
      })
    ]
  });
}

SettingsPage.pageId = "settings";
SettingsPage.migrationStatus = "native";

export default SettingsPage;
