export const SUPPORTED_LOCALES = ["ar", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export type TextDirection = "rtl" | "ltr";

export type DictionaryShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : DictionaryShape<T[Key]>;
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as AppLocale);
}
