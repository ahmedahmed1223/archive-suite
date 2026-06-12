import { applyDaisyTheme, getStoredDaisyTheme } from "../features/theme/daisyThemes.js";

export function applyInitialDaisyTheme() {
  return applyDaisyTheme(getStoredDaisyTheme());
}
