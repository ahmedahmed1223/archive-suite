/**
 * i18next initialization for Archive Suite.
 * Arabic (ar) is the default and only fully-translated language.
 * This module sets up the infrastructure for future multi-language support.
 */
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar";
import en from "./locales/en";
import fr from "./locales/fr";

const savedLang =
  typeof localStorage !== "undefined"
    ? localStorage.getItem("archive_lang") || "ar"
    : "ar";

i18next.use(initReactI18next).init({
  lng: savedLang,
  fallbackLng: "ar",
  debug: false,
  interpolation: {
    escapeValue: false, // React already escapes
  },
  resources: {
    ar: { translation: ar },
    en: { translation: en },
    fr: { translation: fr },
  },
});

export default i18next;
