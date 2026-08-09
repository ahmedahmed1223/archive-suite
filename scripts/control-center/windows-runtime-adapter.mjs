// V1-210B: Windows Native runtime adapter. The lifecycle engine is shared
// with Linux in native-runtime-adapter.mjs; this module contributes the
// Windows install steps (ACLs for the virtual service accounts, firewall
// rule for archive-http) and the Windows service topology.
import { createNativeRuntimeAdapter, createNativeServiceRemover, serviceInstallSteps } from "./native-runtime-adapter.mjs";
import { WINDOWS_SERVICES } from "./windows-services.mjs";

// Ordered install steps after host-preflight. Each maps to one injected
// effect; a failure marks the manifest with exactly this step name so repair
// can resume from it. Services must be installed (registered with the SCM)
// before ACLs are applied: NT SERVICE\<id> is a virtual account tied to a
// real registered Windows service, and icacls cannot resolve it (real error:
// 1332, ERROR_NONE_MAPPED) until that registration exists. ACLs still apply
// before services start, so the running process has its permissions already
// granted.
export const WINDOWS_INSTALL_STEPS = ["data-services-ready", "services-installed", "acl-applied", "app-configured", "database-migrated", "firewall-applied", "services-started"];

export function createWindowsNativeRuntimeAdapter({ services = WINDOWS_SERVICES, serviceControl, applyAcls, applyFirewallRules, writeAppConfig, migrateDatabase, ...rest } = {}) {
  const [servicesInstalledStep, servicesStartedStep] = serviceInstallSteps({ services, serviceControl });
  return createNativeRuntimeAdapter({
    services,
    serviceControl,
    installSteps: [
      servicesInstalledStep,
      { step: "acl-applied", run: () => (applyAcls ? applyAcls() : { status: 0 }) },
      // Written after acl-applied so the new Caddyfile/.env inherit the
      // install root's grant at creation time rather than racing it.
      { step: "app-configured", run: () => (writeAppConfig ? writeAppConfig() : { status: 0 }) },
      { step: "database-migrated", run: () => (migrateDatabase ? migrateDatabase() : { status: 0 }) },
      { step: "firewall-applied", run: () => (applyFirewallRules ? applyFirewallRules() : { status: 0 }) },
      servicesStartedStep,
    ],
    ...rest,
  });
}

export const createWindowsServiceRemover = createNativeServiceRemover;
