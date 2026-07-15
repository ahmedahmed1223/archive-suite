// Shared interactive-choice layer for Setup. It deliberately builds only the
// declarative candidate; validation and all policy decisions remain in
// setup-config.mjs so interactive and file-driven flows cannot drift.

import { parseWizardChoices } from "./wizard-choice-parser.mjs";

// Numbering intentionally includes implicit core: 2/media/ocr resolves to
// media and 3/edge/tls/public resolves to edge. Keep this list and the help
// text aligned; generic optional indexing would make 2 mean edge instead.
const PROFILE_CHOICES = ["core", "media", "edge"];
const CAPABILITY_CHOICES = ["ocr", "ai", "observability"];

const PROFILE_ALIASES = Object.freeze({
  media: "media",
  "media processing": "media",
  ocr: "media",
  tls: "edge",
  "public tls": "edge",
  public: "edge",
  ingress: "edge",
});

const CAPABILITY_ALIASES = Object.freeze({
  ocr: "ocr",
  ai: "ai",
  "artificial intelligence": "ai",
  monitoring: "observability",
  observability: "observability",
});

export const WIZARD_RUNTIME_PROMPTS = Object.freeze({
  mode: "Runtime mode (docker/native) — Docker is the supported release path; Native is planning-only for now",
  platform: "Platform id — choose the contract platform matching your runtime mode and machine",
  source: "Deployment source (online/offline/local) — local builds this checkout; online downloads signed images; offline needs a verified bundle",
  access: "Access mode (local/intranet/public) — public requires edge/TLS, and edge is reserved for public access only",
  storage: "Local storage path — do not use a URL or credentials; it will be recorded for install",
  profiles: "Optional runtime profiles — core is always enabled; media is for media/OCR, edge is for public TLS",
  capabilities: "Optional capabilities — ocr/ai/observability are not Compose profiles and don't enable services on their own",
});

const CHOICE_HELP = Object.freeze({
  profiles: [
    "Optional runtime profiles (core is always enabled):",
    "  1) core — required and already enabled; you do not need to select it.",
    "  2) media — media processing and OCR workloads; validate capacity first.",
    "  3) edge — public TLS ingress; select it explicitly only for public access.",
    "  Enter names or numbers separated by commas, +, ;, or |. Type all or none.",
    "  Aliases: ocr = media; tls or public = edge. This choice never adds edge automatically.",
  ].join("\n"),
  capabilities: [
    "Optional capabilities (these do not enable Docker services by themselves):",
    "  1) ocr — planned OCR workloads.",
    "  2) ai — planned optional AI workloads.",
    "  3) observability — local logs, diagnostics, and readiness reporting.",
    "  Enter names or numbers separated by commas, +, ;, or |. Type all or none.",
  ].join("\n"),
});

async function collectChoice({ ask, log, prompt, defaultValue, options, aliases, help }) {
  log(help);
  for (;;) {
    const parsed = parseWizardChoices(await ask(prompt, defaultValue), { options, aliases, allowAll: true, allowNone: true });
    if (Array.isArray(parsed)) return parsed;
    log(`Choice not accepted: ${parsed.message}`);
  }
}

export async function requestWizardConfirmation({ ask, log = () => {} }) {
  for (;;) {
    const answer = String(await ask(`Save and install: \x1b[32m[y/yes/c/confirm]\x1b[0m · change choices: \x1b[33m[back]\x1b[0m · quit: \x1b[31m[q]\x1b[0m`, "")).trim().toLowerCase();
    if (["y", "yes", "c", "confirm"].includes(answer)) return "confirm";
    if (answer === "back") return "back";
    if (answer === "q") return "quit";
    log("Choose y, yes, c, or confirm to install; back to change choices; or q to quit. No changes have been made.");
  }
}

// Keep the confirmation decision and the only provisioning callback in one
// path. This makes back/quit mechanically incapable of reaching .env writes
// or Docker operations, while the Control Center supplies the real callback.
export async function runGuidedProvisioningFlow({ ask, log = () => {}, configuration, provision }) {
  const action = await requestWizardConfirmation({ ask, log });
  if (action !== "confirm") return { action, result: null };
  return { action, result: await provision(configuration) };
}

export async function collectWizardRuntimeChoices({ ask, log = () => {}, existing = {}, contract, platformId }) {
  const defaultPlatform = existing.ARCHIVE_PLATFORM || platformId;
  const mode = await ask(WIZARD_RUNTIME_PROMPTS.mode, existing.ARCHIVE_MODE || "docker");
  const platform = await ask(WIZARD_RUNTIME_PROMPTS.platform, defaultPlatform);
  const selectedPlatform = contract.platforms.find((candidate) => candidate.id === platform);
  const defaultFamily = selectedPlatform?.dataPathFamily || (process.platform === "win32" ? "windows" : "linux");
  const source = await ask(WIZARD_RUNTIME_PROMPTS.source, existing.ARCHIVE_SETUP_SOURCE || "online");
  const access = await ask(WIZARD_RUNTIME_PROMPTS.access, existing.ACCESS_MODE || "local");
  const storagePath = await ask(WIZARD_RUNTIME_PROMPTS.storage, existing.ARCHIVE_STORAGE_PATH || contract.dataPaths[defaultFamily].storage);
  const optionalProfiles = await collectChoice({
    ask, log, prompt: WIZARD_RUNTIME_PROMPTS.profiles, defaultValue: existing.ARCHIVE_COMPOSE_PROFILES || "none",
    options: PROFILE_CHOICES, aliases: PROFILE_ALIASES, help: CHOICE_HELP.profiles,
  });
  const optionalCapabilities = await collectChoice({
    ask, log, prompt: WIZARD_RUNTIME_PROMPTS.capabilities, defaultValue: existing.ARCHIVE_CAPABILITIES || "none",
    options: CAPABILITY_CHOICES, aliases: CAPABILITY_ALIASES, help: CHOICE_HELP.capabilities,
  });
  return {
    candidate: {
      schemaVersion: "1.0",
      mode,
      platform,
      source,
      intent: "fresh",
      access,
      runtimeProfiles: ["core", ...optionalProfiles.filter((profile) => profile !== "core")],
      capabilities: optionalCapabilities,
      dataServices: { postgres: { enabled: true }, redis: { enabled: true } },
      storage: { driver: "local", path: storagePath },
    },
  };
}
