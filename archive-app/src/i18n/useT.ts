/**
 * Re-export useTranslation for convenience.
 * Usage:
 *   import { useT } from "../i18n/useT.js";
 *   const { t } = useT();
 *   <button>{t("actions.save")}</button>
 */
export { useTranslation as useT } from "react-i18next";
export { default as i18n } from "./index";
