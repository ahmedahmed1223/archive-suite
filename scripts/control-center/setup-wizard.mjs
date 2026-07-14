// Shared interactive-choice layer for Setup. It deliberately builds only the
// declarative candidate; validation and all policy decisions remain in
// setup-config.mjs so interactive and file-driven flows cannot drift.

const splitChoice = (value) => String(value).split(",").map((item) => item.trim()).filter(Boolean);

export const WIZARD_RUNTIME_PROMPTS = Object.freeze({
  mode: "نمط التشغيل (docker/native) — Docker هو مسار الإصدار المدعوم؛ Native للتخطيط فقط حالياً",
  platform: "معرّف المنصة — اختر منصة العقد المطابقة لنمط التشغيل والجهاز",
  source: "مصدر الإصدار (online/offline) — online ينزّل الصور الموقعة، وoffline يحتاج حزمة موثقة",
  access: "نمط الوصول (local/intranet/public) — public يتطلب edge/TLS، وedge مخصص للوصول public فقط",
  storage: "مسار التخزين المحلي — لا تستخدم URL أو بيانات اعتماد؛ سيُسجّل للتركيب",
  profiles: "ملفات التشغيل الاختيارية — core مفعل دائماً؛ media للوسائط/OCR، وedge لـTLS العام",
  capabilities: "القدرات الاختيارية — ocr/ai/observability ليست ملفات Compose ولا تُفعّل الخدمات وحدها",
});

export async function collectWizardRuntimeChoices({ ask, existing = {}, contract, platformId }) {
  const defaultPlatform = existing.ARCHIVE_PLATFORM || platformId;
  const mode = await ask(WIZARD_RUNTIME_PROMPTS.mode, existing.ARCHIVE_MODE || "docker");
  const platform = await ask(WIZARD_RUNTIME_PROMPTS.platform, defaultPlatform);
  const selectedPlatform = contract.platforms.find((candidate) => candidate.id === platform);
  const defaultFamily = selectedPlatform?.dataPathFamily || (process.platform === "win32" ? "windows" : "linux");
  const source = await ask(WIZARD_RUNTIME_PROMPTS.source, existing.ARCHIVE_SETUP_SOURCE || "online");
  const access = await ask(WIZARD_RUNTIME_PROMPTS.access, existing.ACCESS_MODE || "local");
  const storagePath = await ask(WIZARD_RUNTIME_PROMPTS.storage, existing.ARCHIVE_STORAGE_PATH || contract.dataPaths[defaultFamily].storage);
  const optionalProfiles = await ask(WIZARD_RUNTIME_PROMPTS.profiles, existing.ARCHIVE_COMPOSE_PROFILES || "");
  const optionalCapabilities = await ask(WIZARD_RUNTIME_PROMPTS.capabilities, existing.ARCHIVE_CAPABILITIES || "");
  return {
    candidate: {
      schemaVersion: "1.0",
      mode,
      platform,
      source,
      intent: "fresh",
      access,
      runtimeProfiles: ["core", ...splitChoice(optionalProfiles)],
      capabilities: splitChoice(optionalCapabilities),
      dataServices: { postgres: { enabled: true }, redis: { enabled: true } },
      storage: { driver: "local", path: storagePath },
    },
  };
}
