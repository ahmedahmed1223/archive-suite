export function normalizeArabicSearchText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatDateTime(dateStr: string, numberSystem = "latn") {
  try {
    const formatter = new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      numberingSystem: numberSystem
    });
    return formatter.format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function formatNumber(number: number, numberSystem = "latn") {
  try {
    return new Intl.NumberFormat("ar-EG", {
      numberingSystem: numberSystem
    }).format(number);
  } catch {
    return String(number);
  }
}

export function formatDuration(duration: string | null | undefined) {
  if (!duration || typeof duration !== "string") return "—";
  const parts = duration.split(":").map(Number);
  if (parts.length !== 3) return duration;
  const [h, m, s] = parts;
  if (h > 0) {
    return `${h} س ${m} د`;
  }
  if (m > 0) {
    return `${m} د ${s} ث`;
  }
  return `${s} ث`;
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 بايت";
  const units = ["بايت", "ك.ب", "م.ب", "ج.ب"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
