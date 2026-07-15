// V1-211B: Linux Native runtime adapter. The lifecycle engine is shared with
// Windows in native-runtime-adapter.mjs; this module contributes the Linux
// install steps — install-root ownership for the non-interactive service
// user, logrotate, and an OPTIONAL firewall step (V1-211B: firewall is
// opt-in on Linux) — plus the systemd service topology. The adapter never
// touches system resources the manifest does not own.
import { createNativeRuntimeAdapter, createNativeServiceRemover, serviceInstallSteps } from "./native-runtime-adapter.mjs";
import { LINUX_SERVICES } from "./linux-services.mjs";

export const LINUX_INSTALL_STEPS = ["data-services-ready", "ownership-applied", "logrotate-applied", "firewall-applied", "services-installed", "services-started"];

export function createLinuxNativeRuntimeAdapter({ services = LINUX_SERVICES, serviceControl, applyOwnership, applyLogrotate, applyFirewallRules, ...rest } = {}) {
  return createNativeRuntimeAdapter({
    services,
    serviceControl,
    installSteps: [
      { step: "ownership-applied", run: () => (applyOwnership ? applyOwnership() : { status: 0 }) },
      { step: "logrotate-applied", run: () => (applyLogrotate ? applyLogrotate() : { status: 0 }) },
      // ponytail: firewall stays a no-op unless the operator opted in — the
      // platform contract makes it optional on Linux.
      { step: "firewall-applied", run: () => (applyFirewallRules ? applyFirewallRules() : { status: 0 }) },
      ...serviceInstallSteps({ services, serviceControl }),
    ],
    ...rest,
  });
}

export const createLinuxServiceRemover = createNativeServiceRemover;
