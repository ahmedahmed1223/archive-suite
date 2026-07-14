// Shared interactive-choice layer for Setup. It deliberately builds only the
// declarative candidate; validation and all policy decisions remain in
// setup-config.mjs so interactive and file-driven flows cannot drift.

const splitChoice = (value) => String(value).split(",").map((item) => item.trim()).filter(Boolean);

export const WIZARD_RUNTIME_PROMPTS = Object.freeze({
  mode: "Runtime mode (docker/native) — Docker is the supported release path; Native is planning-only for now",
  platform: "Platform id — choose the contract platform matching your runtime mode and machine",
  source: "Release source (online/offline) — online downloads signed images; offline needs a verified bundle",
  access: "Access mode (local/intranet/public) — public requires edge/TLS, and edge is reserved for public access only",
  storage: "Local storage path — do not use a URL or credentials; it will be recorded for install",
  profiles: "Optional runtime profiles — core is always enabled; media is for media/OCR, edge is for public TLS",
  capabilities: "Optional capabilities — ocr/ai/observability are not Compose profiles and don't enable services on their own",
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
