// V1-210C: Windows Native data services. The rules are identical for every
// Native platform, so the implementation lives in native-data-services.mjs
// (shared with Linux / V1-211C); these aliases keep the Windows wiring and
// its tests on their original names.
export {
  resolveNativeDataPlan as resolveWindowsDataPlan,
  createNativeDataGate as createWindowsDataGate,
} from "./native-data-services.mjs";
