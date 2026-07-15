// V1-210B: Windows Native runtime adapter. The lifecycle engine is shared
// with Linux in native-runtime-adapter.mjs; this module contributes the
// Windows install steps (ACLs for the virtual service accounts, firewall
// rule for archive-http) and the Windows service topology.
import { createNativeRuntimeAdapter, createNativeServiceRemover, serviceInstallSteps } from "./native-runtime-adapter.mjs";
import { WINDOWS_SERVICES } from "./windows-services.mjs";

// Ordered install steps after host-preflight. Each maps to one injected
// effect; a failure marks the manifest with exactly this step name so repair
// can resume from it.
export const WINDOWS_INSTALL_STEPS = ["data-services-ready", "acl-applied", "firewall-applied", "services-installed", "services-started"];

export function createWindowsNativeRuntimeAdapter({ services = WINDOWS_SERVICES, serviceControl, applyAcls, applyFirewallRules, ...rest } = {}) {
  return createNativeRuntimeAdapter({
    services,
    serviceControl,
    installSteps: [
      { step: "acl-applied", run: () => (applyAcls ? applyAcls() : { status: 0 }) },
      { step: "firewall-applied", run: () => (applyFirewallRules ? applyFirewallRules() : { status: 0 }) },
      ...serviceInstallSteps({ services, serviceControl }),
    ],
    ...rest,
  });
}

export const createWindowsServiceRemover = createNativeServiceRemover;
