const numberParam = (defaultValue, min, max) => ({ kind: "number", defaultValue, min, max });
const colorParam = (defaultValue) => ({ kind: "color", defaultValue });

export const FILTER_DEFINITIONS = Object.freeze({
  brightness: {
    label: "Brightness",
    params: { amount: numberParam(0, -1, 1) },
    preview: true,
    ffmpeg: "eq=brightness"
  },
  contrast: {
    label: "Contrast",
    params: { amount: numberParam(1, 0, 3) },
    preview: true,
    ffmpeg: "eq=contrast"
  },
  saturation: {
    label: "Saturation",
    params: { amount: numberParam(1, 0, 3) },
    preview: true,
    ffmpeg: "eq=saturation"
  },
  grayscale: {
    label: "Grayscale",
    params: { amount: numberParam(1, 0, 1) },
    preview: true,
    ffmpeg: "hue=s=0"
  },
  sepia: {
    label: "Sepia",
    params: { amount: numberParam(1, 0, 1) },
    preview: true,
    ffmpeg: "colorchannelmixer=sepia"
  },
  blur: {
    label: "Blur",
    params: { radius: numberParam(0, 0, 50) },
    preview: true,
    ffmpeg: "gblur=sigma"
  },
  temperature: {
    label: "Temperature",
    params: {
      amount: numberParam(0, -1, 1),
      tint: numberParam(0, -1, 1)
    },
    preview: false,
    ffmpeg: "colorbalance"
  },
  vignette: {
    label: "Vignette",
    params: {
      amount: numberParam(0.5, 0, 1),
      softness: numberParam(0.5, 0, 1)
    },
    preview: false,
    ffmpeg: "vignette"
  },
  sharpen: {
    label: "Sharpen",
    params: { amount: numberParam(1, 0, 3) },
    preview: false,
    ffmpeg: "unsharp"
  },
  chromaKey: {
    label: "Chroma key",
    params: {
      color: colorParam("#00ff00"),
      threshold: numberParam(0.2, 0, 1),
      softness: numberParam(0.1, 0, 1)
    },
    preview: false,
    ffmpeg: "chromakey"
  }
});

function normalizeParam(value, definition) {
  if (definition.kind === "color") {
    const color = String(value || definition.defaultValue).trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : definition.defaultValue;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) return definition.defaultValue;
  return Math.max(definition.min, Math.min(definition.max, number));
}

export function normalizeClipFilter(filter = {}, fallbackOrder = 0, fallbackId) {
  const type = String(filter.type || "").trim();
  const definition = FILTER_DEFINITIONS[type];
  if (!definition) return null;
  const params = Object.fromEntries(Object.entries(definition.params).map(([name, paramDefinition]) => [
    name,
    normalizeParam(filter.params?.[name], paramDefinition)
  ]));
  const normalized = {
    id: String(filter.id || fallbackId || `${type}-${fallbackOrder + 1}`),
    type,
    enabled: filter.enabled === undefined ? true : Boolean(filter.enabled),
    order: Number.isInteger(filter.order) ? filter.order : fallbackOrder,
    params
  };
  if (!definition.preview) normalized.exportOnly = true;
  return normalized;
}

export function normalizeClipFilters(filters = []) {
  const counts = new Map();
  return (Array.isArray(filters) ? filters : [])
    .map((filter, index) => {
      const type = String(filter?.type || "").trim();
      const count = (counts.get(type) || 0) + 1;
      counts.set(type, count);
      return normalizeClipFilter(filter, index, `${type}-${count}`);
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order)
    .map((filter, order) => ({ ...filter, order }));
}

export function isPreviewSupported(filterOrType) {
  const type = typeof filterOrType === "string" ? filterOrType : filterOrType?.type;
  return Boolean(FILTER_DEFINITIONS[type]?.preview);
}

function formatNumber(value) {
  return Number(Number(value).toFixed(4)).toString();
}

function cssValue(filter) {
  const amount = filter.params?.amount;
  if (filter.type === "brightness") return `brightness(${formatNumber(1 + amount)})`;
  if (filter.type === "contrast") return `contrast(${formatNumber(amount)})`;
  if (filter.type === "saturation") return `saturate(${formatNumber(amount)})`;
  if (filter.type === "grayscale") return `grayscale(${formatNumber(amount)})`;
  if (filter.type === "sepia") return `sepia(${formatNumber(amount)})`;
  if (filter.type === "blur") return `blur(${formatNumber(filter.params?.radius)}px)`;
  return "";
}

export function buildCssFilter(filters = []) {
  return normalizeClipFilters(filters)
    .filter((filter) => filter.enabled && isPreviewSupported(filter))
    .map(cssValue)
    .filter(Boolean)
    .join(" ");
}
